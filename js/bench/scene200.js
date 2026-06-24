// scene200 — perf bench fixture, ported from Cedric's DawnTest bench scene
// (Samples/webgpu-cross-platform-app/assets/script/src/lite/scene200.ts) to our
// native Babylon-Lite API so the workload matches for a side-by-side comparison.
//
// Workload (identical structure to the DawnTest fixture, THIN_GRID=80):
//   - 80×80 = 6400 thin-instanced torus knots (gold)
//   - 80×80 = 6400 thin-instanced boxes (copper), offset upward
//   - 64-sphere ring (standard material, per-instance colors)
//   - ground plane, hemispheric light, HDR IBL (stubbed natively)
//
// Differences vs DawnTest Lite (documented in .ai/phase8-perf-bench.md):
//   * Our thin instances are drawn one bgfx draw-call per visible instance with
//     per-instance frustum culling (no GPU instancing yet) — heavier CPU side.
//   * Procedural meshes shade with the Standard shader (no PBR+IBL yet), so the
//     per-pixel GPU cost differs. The geometry / instance / draw structure matches.

const THIN_GRID = 80;

function gridMatrices(gridDim, spacing, yJitter) {
    const count = gridDim * gridDim;
    const out = new Float32Array(16 * count);
    let i = 0;
    const half = (gridDim - 1) * 0.5;
    for (let z = 0; z < gridDim; z++) {
        for (let x = 0; x < gridDim; x++) {
            const tx = (x - half) * spacing;
            const tz = (z - half) * spacing;
            const ty = yJitter * Math.sin(x * 0.7 + z * 0.5);
            const m = mat4Compose(tx, ty, tz, 0, 0, 0, 1, 1, 1, 1);
            out.set(m, i * 16);
            i++;
        }
    }
    return out;
}

async function main() {
    const canvas = document.getElementById("renderCanvas");

    const engine = await createEngine(canvas);
    const scene = createSceneContext(engine);
    scene.clearColor = { r: 0.04, g: 0.05, b: 0.08, a: 1 };

    scene.camera = createArcRotateCamera(Math.PI * 0.25, Math.PI * 0.4, 22, { x: 0, y: 1.5, z: 0 });
    scene.camera.nearPlane = 0.5;
    scene.camera.farPlane = 200;
    attachControl(scene.camera, canvas, scene);

    addToScene(scene, createHemisphericLight([0, 1, 0], 0.9));

    await loadHdrEnvironment(scene, "https://playground.babylonjs.com/textures/environment.hdr");

    const goldTex = createSolidTexture2D(engine, 1.0, 0.766, 0.336);
    const copperTex = createSolidTexture2D(engine, 0.95, 0.64, 0.54);
    const ormTex = createSolidTexture2D(engine, 1.0, 0.5, 1.0);

    // Thin-instanced torus knots (gold)
    const torusKnot = createTorus(engine, { diameter: 1.4, thickness: 0.45, tessellation: 48 });
    torusKnot.material = createPbrMaterial({ baseColorTexture: goldTex, ormTexture: ormTex, occlusionStrength: 0 });
    const torusCount = THIN_GRID * THIN_GRID;
    setThinInstances(torusKnot, gridMatrices(THIN_GRID, 1.3, 0.5), torusCount);
    addToScene(scene, torusKnot);

    // Thin-instanced boxes (copper), offset to overlap the torus grid
    const box = createBox(engine);
    box.position.set(0, 4.5, 0);
    box.material = createPbrMaterial({ baseColorTexture: copperTex, ormTexture: ormTex, occlusionStrength: 0 });
    const boxCount = THIN_GRID * THIN_GRID;
    setThinInstances(box, gridMatrices(THIN_GRID, 1.3, 0.5), boxCount);
    addToScene(scene, box);

    // 64-sphere ring (standard material, per-instance colors)
    const sphere = createSphere(engine, { diameter: 0.6, segments: 24 });
    sphere.material = createStandardMaterial();
    const ringCount = 64;
    const ringMatrices = new Float32Array(16 * ringCount);
    const ringColors = new Float32Array(4 * ringCount);
    for (let i = 0; i < ringCount; i++) {
        const a = (i / ringCount) * Math.PI * 2;
        const ringR = 7 + (i % 4) * 0.8;
        const rx = Math.cos(a) * ringR;
        const rz = Math.sin(a) * ringR;
        const ry = 2 + Math.sin(i * 0.31) * 1.5;
        const m = mat4Compose(rx, ry, rz, 0, 0, 0, 1, 1, 1, 1);
        ringMatrices.set(m, i * 16);
        ringColors[i * 4 + 0] = (Math.sin(a) + 1) * 0.5;
        ringColors[i * 4 + 1] = (Math.cos(a) + 1) * 0.5;
        ringColors[i * 4 + 2] = 0.8;
        ringColors[i * 4 + 3] = 1;
    }
    setThinInstances(sphere, ringMatrices, ringCount);
    setThinInstanceColors(sphere, ringColors);
    addToScene(scene, sphere);

    // Ground
    const ground = createGround(engine, { width: 60, height: 60 });
    ground.material = createStandardMaterial();
    addToScene(scene, ground);

    await registerScene(scene);
    await startEngine(engine);
    console.log("[scene200] bench scene ready (native bgfx)");
}

main().catch(function (err) {
    console.error("[scene200] fatal:", err && err.stack ? err.stack : err);
});
