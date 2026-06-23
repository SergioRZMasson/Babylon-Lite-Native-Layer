// Phase 2A stress scene: a grid of spinning cubes.
//
// Demonstrates the S9 thesis — moving per-frame CPU work (scene walk -> world
// matrices -> cull -> draw) from JS to native. The SAME scene runs two ways,
// selected by `appMode()`:
//
//   cpu=native : JS describes the scene once (scene.addNode) then scene.start().
//                The native task-graph executor does all per-frame work in C++.
//   cpu=js     : JS keeps the scene and runs the identical four tasks itself each
//                frame (the no-JIT baseline), then submits via gfx.drawInstances.
//
// Both paths use identical math and the same camera, so they render identically;
// only *where* the per-frame CPU work runs differs. Compare with --frames + --bench.

const MODE = (typeof appMode === "function") ? appMode() : "native";
let GRID = (typeof appGridSize === "function") ? appGridSize() : 0;
if (!GRID || GRID <= 0) { GRID = 40; }

console.log("[js] stress.js mode=" + MODE + " grid=" + GRID + " (" + (GRID * GRID) + " cubes)");

// ---- column-major 4x4 helpers (match src/scene.cpp exactly) ----
function composeLocal(m, px, py, pz, s, ax, ay, az, angle) {
    const c = Math.cos(angle), sn = Math.sin(angle), t = 1 - c;
    m[0] = (c + ax * ax * t) * s;       m[1] = (ay * ax * t + az * sn) * s; m[2] = (az * ax * t - ay * sn) * s; m[3] = 0;
    m[4] = (ax * ay * t - az * sn) * s; m[5] = (c + ay * ay * t) * s;       m[6] = (az * ay * t + ax * sn) * s; m[7] = 0;
    m[8] = (ax * az * t + ay * sn) * s; m[9] = (ay * az * t - ax * sn) * s; m[10] = (c + az * az * t) * s;      m[11] = 0;
    m[12] = px; m[13] = py; m[14] = pz; m[15] = 1;
}
function extractFrustum(vp) {
    const r0 = [vp[0], vp[4], vp[8], vp[12]];
    const r1 = [vp[1], vp[5], vp[9], vp[13]];
    const r2 = [vp[2], vp[6], vp[10], vp[14]];
    const r3 = [vp[3], vp[7], vp[11], vp[15]];
    const raw = [
        [r3[0] + r0[0], r3[1] + r0[1], r3[2] + r0[2], r3[3] + r0[3]],
        [r3[0] - r0[0], r3[1] - r0[1], r3[2] - r0[2], r3[3] - r0[3]],
        [r3[0] + r1[0], r3[1] + r1[1], r3[2] + r1[2], r3[3] + r1[3]],
        [r3[0] - r1[0], r3[1] - r1[1], r3[2] - r1[2], r3[3] - r1[3]],
        [r2[0], r2[1], r2[2], r2[3]],
        [r3[0] - r2[0], r3[1] - r2[1], r3[2] - r2[2], r3[3] - r2[3]],
    ];
    for (let i = 0; i < 6; i++) {
        const p = raw[i];
        const inv = 1 / Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]);
        p[0] *= inv; p[1] *= inv; p[2] *= inv; p[3] *= inv;
    }
    return raw;
}

// ---- cube geometry (per-face normals; 24 verts / 36 indices) ----
function buildCube(h) {
    const faces = [
        { n: [1, 0, 0], v: [[h, -h, -h], [h, h, -h], [h, h, h], [h, -h, h]] },
        { n: [-1, 0, 0], v: [[-h, -h, h], [-h, h, h], [-h, h, -h], [-h, -h, -h]] },
        { n: [0, 1, 0], v: [[-h, h, -h], [-h, h, h], [h, h, h], [h, h, -h]] },
        { n: [0, -1, 0], v: [[-h, -h, h], [-h, -h, -h], [h, -h, -h], [h, -h, h]] },
        { n: [0, 0, 1], v: [[h, -h, h], [h, h, h], [-h, h, h], [-h, -h, h]] },
        { n: [0, 0, -1], v: [[-h, -h, -h], [-h, h, -h], [h, h, -h], [h, -h, -h]] },
    ];
    const positions = new Float32Array(72), normals = new Float32Array(72), indices = new Uint16Array(36);
    let vi = 0, ii = 0;
    for (let f = 0; f < 6; f++) {
        const base = vi;
        for (let k = 0; k < 4; k++) {
            positions.set(faces[f].v[k], vi * 3);
            normals.set(faces[f].n, vi * 3);
            vi++;
        }
        indices[ii++] = base; indices[ii++] = base + 1; indices[ii++] = base + 2;
        indices[ii++] = base; indices[ii++] = base + 2; indices[ii++] = base + 3;
    }
    return { positions, normals, indices };
}

const cube = buildCube(1.0);
const meshId = gfx.createMesh(cube.positions, cube.normals, cube.indices);

// ---- scene definition (deterministic; identical for both modes) ----
const SPACING = 2.4;
const SCALE = 0.55;
const RADIUS = SCALE * 1.732;
const half = (GRID - 1) * 0.5;
const N = GRID * GRID;

// Per-node parameters (kept in JS for the js-mode path; also pushed to native).
const npx = new Float32Array(N), npy = new Float32Array(N), npz = new Float32Array(N);
const nax = new Float32Array(N), nay = new Float32Array(N), naz = new Float32Array(N);
const nspeed = new Float32Array(N), nphase = new Float32Array(N);

let idx = 0;
for (let z = 0; z < GRID; z++) {
    for (let x = 0; x < GRID; x++) {
        const px = (x - half) * SPACING;
        const pz = (z - half) * SPACING;
        const py = Math.sin(x * 0.5 + z * 0.3) * 1.5;
        // Deterministic spin axis + speed (normalized to match native addNode).
        let ax = Math.sin(idx * 0.7), ay = 1.0, az = Math.cos(idx * 0.4);
        const al = Math.sqrt(ax * ax + ay * ay + az * az) || 1;
        ax /= al; ay /= al; az /= al;
        npx[idx] = px; npy[idx] = py; npz[idx] = pz;
        nax[idx] = ax; nay[idx] = ay; naz[idx] = az;
        nspeed[idx] = 0.5 + (idx % 5) * 0.25;
        nphase[idx] = idx * 0.3;
        idx++;
    }
}

// Camera: above-and-back, looking at the grid centre. Some cubes fall outside the
// frustum so culling has work to do.
const span = GRID * SPACING;
gfx.setCamera(span * 0.35, span * 0.55, -span * 0.55, /*target*/ 0, 0, 0, /*fov*/ 55, /*near*/ 0.5, /*far*/ span * 3);
gfx.setClearColor(0.05, 0.06, 0.09, 1.0);

if (MODE === "native") {
    // Hand the scene to the native executor; do no per-frame work in JS.
    for (let i = 0; i < N; i++) {
        scene.addNode(meshId, -1, npx[i], npy[i], npz[i], SCALE, nax[i], nay[i], naz[i], nspeed[i], nphase[i], RADIUS);
    }
    scene.start();
    console.log("[js] handed " + N + " nodes to the native task-graph executor");
} else {
    // js mode: run the identical four tasks in JS each frame.
    if (typeof benchNodes === "function") { benchNodes(N); }
    const worlds = new Float32Array(N * 16); // packed visible world matrices
    const tmp = new Float32Array(16);
    const hasPerf = (typeof perfNow === "function") && (typeof benchCpu === "function");
    setFrameCallback(function (timeMs) {
        const t = timeMs / 1000;
        const t0 = hasPerf ? perfNow() : 0;
        const frustum = extractFrustum(gfx.getViewProj());
        let vis = 0;
        for (let i = 0; i < N; i++) {
            // Task animate + world (flat hierarchy: world = local).
            composeLocal(tmp, npx[i], npy[i], npz[i], SCALE, nax[i], nay[i], naz[i], nphase[i] + nspeed[i] * t);
            // Task cull: world-space center is the translation column.
            const cx = tmp[12], cy = tmp[13], cz = tmp[14];
            let inside = true;
            for (let p = 0; p < 6; p++) {
                const pl = frustum[p];
                if (pl[0] * cx + pl[1] * cy + pl[2] * cz + pl[3] < -RADIUS) { inside = false; break; }
            }
            if (inside) {
                worlds.set(tmp, vis * 16);
                vis++;
            }
        }
        // Report the pure scene-traversal time (excludes the draw submission below).
        if (hasPerf) { benchCpu(perfNow() - t0, vis); }
        // Task draw: one JS->C++ crossing for all visible instances.
        gfx.drawInstances(meshId, worlds, vis);
    });
    console.log("[js] js-mode: per-frame scene walk runs in JS over " + N + " nodes");
}
