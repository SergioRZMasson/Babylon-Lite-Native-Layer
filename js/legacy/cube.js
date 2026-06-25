// Phase 1 JS orchestrator: a lit, spinning cube.
//
// This is the "JS orchestrates, C++ renders" seam (Option C). JavaScript owns:
//   - the cube geometry (data-oriented, the Babylon-Lite way)
//   - the camera placement
//   - the per-frame world matrix (the spin) — exactly what Babylon-Lite computes
//     in JS and uploads each frame
// C++ (bgfx) owns the actual GPU work via gfx.createMesh / setCamera / drawMesh,
// using the Standard-material shader hand-ported from Babylon-Lite's WGSL.

console.log("[js] cube.js loaded");

// ---- Column-major 4x4 matrix helpers (bgfx convention) ----
function mat4Identity() {
    const m = new Float32Array(16);
    m[0] = m[5] = m[10] = m[15] = 1;
    return m;
}
function mat4Multiply(a, b) {
    // returns a * b (column-major)
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) {
        for (let r = 0; r < 4; r++) {
            let s = 0;
            for (let k = 0; k < 4; k++) {
                s += a[k * 4 + r] * b[c * 4 + k];
            }
            o[c * 4 + r] = s;
        }
    }
    return o;
}
function mat4RotateY(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const m = mat4Identity();
    m[0] = c;  m[2] = -s;   // column 0
    m[8] = s;  m[10] = c;   // column 2
    return m;
}
function mat4RotateX(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const m = mat4Identity();
    m[5] = c;  m[6] = s;
    m[9] = -s; m[10] = c;
    return m;
}

// ---- Cube geometry (24 verts, per-face normals; 36 indices) ----
function buildCube(half) {
    const h = half;
    // Each face: 4 verts with a shared normal.
    const faces = [
        // +X
        { n: [1, 0, 0], v: [[h, -h, -h], [h, h, -h], [h, h, h], [h, -h, h]] },
        // -X
        { n: [-1, 0, 0], v: [[-h, -h, h], [-h, h, h], [-h, h, -h], [-h, -h, -h]] },
        // +Y
        { n: [0, 1, 0], v: [[-h, h, -h], [-h, h, h], [h, h, h], [h, h, -h]] },
        // -Y
        { n: [0, -1, 0], v: [[-h, -h, h], [-h, -h, -h], [h, -h, -h], [h, -h, h]] },
        // +Z
        { n: [0, 0, 1], v: [[h, -h, h], [h, h, h], [-h, h, h], [-h, -h, h]] },
        // -Z
        { n: [0, 0, -1], v: [[-h, -h, -h], [-h, h, -h], [h, h, -h], [h, -h, -h]] },
    ];
    const positions = new Float32Array(24 * 3);
    const normals = new Float32Array(24 * 3);
    const indices = new Uint16Array(36);
    let vi = 0;
    let ii = 0;
    for (let f = 0; f < faces.length; f++) {
        const base = vi;
        for (let k = 0; k < 4; k++) {
            positions[vi * 3 + 0] = faces[f].v[k][0];
            positions[vi * 3 + 1] = faces[f].v[k][1];
            positions[vi * 3 + 2] = faces[f].v[k][2];
            normals[vi * 3 + 0] = faces[f].n[0];
            normals[vi * 3 + 1] = faces[f].n[1];
            normals[vi * 3 + 2] = faces[f].n[2];
            vi++;
        }
        // Two triangles per face (CW winding for bgfx CULL_CW front faces).
        indices[ii++] = base + 0;
        indices[ii++] = base + 1;
        indices[ii++] = base + 2;
        indices[ii++] = base + 0;
        indices[ii++] = base + 2;
        indices[ii++] = base + 3;
    }
    return { positions, normals, indices };
}

const cube = buildCube(1.0);
const meshId = gfx.createMesh(cube.positions, cube.normals, cube.indices);
console.log("[js] created cube mesh id =", meshId);

// Background + camera.
gfx.setClearColor(0.05, 0.06, 0.09, 1.0);
gfx.setCamera(3.5, 2.5, -4.0, /*target*/ 0, 0, 0, /*fovYDeg*/ 50, /*near*/ 0.1, /*far*/ 100);

setFrameCallback(function (timeMs, frameNo) {
    const angle = frameNo * 0.02;
    // World matrix = rotateY * rotateX — computed in JS, uploaded to native.
    const world = mat4Multiply(mat4RotateY(angle), mat4RotateX(angle * 0.6));
    gfx.drawMesh(meshId, world);

    if (frameNo === 0) {
        console.log("[js] first cube frame drawn");
    }
});
