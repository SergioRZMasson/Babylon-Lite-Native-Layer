// bench-csm-boombox — Cedric's native-lite-benchmark, ported to our native Babylon-Lite
// mirror so the workload matches his harness for a side-by-side comparison.
//
// Workload (identical to lab/lite/src/demos/native-lite-benchmark.ts):
//   - Khronos BoomBox (PBR) loaded ONCE, deep-cloned into a 20x20 = 400 grid of INDIVIDUAL
//     meshes (one draw call each, sharing the source GPU buffers — NO instancing).
//   - A directional "sun" with a 4-cascade CSM (2048) casting shadows onto a ground plane.
//   - HDR image-based lighting (.env) + an auto-framed ArcRotate camera.

import {
    addToScene, attachControl, cloneTransformNode, createArcRotateCamera,
    createCsmDirectionalShadowGenerator, createDirectionalLight, createEngine, createGround,
    createHemisphericLight, createSceneContext, createStandardMaterial, getContainerMeshes,
    loadEnvironment, loadGltf, registerSceneWithShadowSupport, setShadowTaskCasterMeshes,
    startEngine,
} from "babylon-lite";

const GRID = 20;          // 20x20 = 400 clones
const MODEL_SCALE = 10;   // BoomBox is authored tiny; absolute-size knob

const BOOMBOX_URL = "https://playground.babylonjs.com/scenes/BoomBox.glb";
const ENV_URL = "https://assets.babylonjs.com/core/environments/environmentSpecular.env";
const SKYBOX_URL = "https://assets.babylonjs.com/core/environments/backgroundSkybox.dds";

async function main(): Promise<void> {
    const canvas = document.getElementById("renderCanvas");

    const engine = await createEngine(canvas);
    const scene = createSceneContext(engine);
    scene.clearColor = { r: 0.6, g: 0.7, b: 0.85, a: 1 };

    // ── Load the BoomBox once + image-based lighting ────────────────────────
    const container = await loadGltf(engine, BOOMBOX_URL);
    await loadEnvironment(scene, ENV_URL, { skyboxUrl: SKYBOX_URL, skyboxSize: 4000, skipGround: true });

    // ── Derive grid spacing / ground / camera from the model's world AABB ────
    const templateRoot = container.entities[0];
    const min = container.boundMin, max = container.boundMax;
    const sizeX = (max[0] - min[0]) * MODEL_SCALE;
    const sizeZ = (max[2] - min[2]) * MODEL_SCALE;
    const footprint = Math.max(sizeX, sizeZ);
    const spacing = footprint * 1.4;
    const bottomY = min[1] * MODEL_SCALE;
    const centerY = ((min[1] + max[1]) * 0.5) * MODEL_SCALE;

    // Clone the BoomBox into a 20x20 grid of INDIVIDUAL meshes (each its own draw call,
    // sharing the source GPU buffers). The template is never added, so only the 400 render.
    const half = (GRID - 1) / 2;
    const clones: any[] = [];
    for (let i = 0; i < GRID; i++) {
        for (let j = 0; j < GRID; j++) {
            const clone = cloneTransformNode(templateRoot);
            clone.position.set((i - half) * spacing, 0, (j - half) * spacing);
            clone.scaling.set(MODEL_SCALE, MODEL_SCALE, MODEL_SCALE);
            addToScene(scene, clone);
            clones.push(clone);
        }
    }

    // Every clone's meshes cast shadows.
    const casterMeshes = getContainerMeshes({ entities: clones });

    // ── Ground (shadow receiver) ────────────────────────────────────────────
    const groundSize = GRID * spacing + footprint * 2;
    const ground = createGround(engine, { width: groundSize, height: groundSize, subdivisions: 1 });
    const groundMat = createStandardMaterial();
    groundMat.diffuseColor = [0.55, 0.55, 0.6];
    groundMat.specularColor = [0, 0, 0];
    ground.material = groundMat;
    ground.position.set(0, bottomY - 0.05, 0);
    ground.receiveShadows = true;
    addToScene(scene, ground);

    // ── Lights ──────────────────────────────────────────────────────────────
    addToScene(scene, createHemisphericLight([0, 1, 0], 0.5));
    const sun = createDirectionalLight([-0.4, -1, -0.55], 1.0);
    sun.diffuse = [1.0, 0.97, 0.9];
    addToScene(scene, sun);

    // Cascaded shadow map — handles the wide spread of cloned casters.
    sun.shadowGenerator = createCsmDirectionalShadowGenerator(engine, sun, {
        mapSize: 2048, numCascades: 4, lambda: 0.7, bias: 0.0008,
    });
    setShadowTaskCasterMeshes(sun.shadowGenerator, casterMeshes);

    // ── Camera framed to fit the whole grid ─────────────────────────────────
    const gridHalfExtent = half * spacing + footprint * 0.5;
    const radius = gridHalfExtent * 2.6;
    const cam = createArcRotateCamera(Math.PI / 4, Math.PI / 3.2, radius, { x: 0, y: centerY, z: 0 });
    cam.nearPlane = Math.max(0.5, radius * 0.01);
    cam.farPlane = radius * 6;
    scene.camera = cam;
    attachControl(cam, canvas, scene);

    await registerSceneWithShadowSupport(scene);
    await startEngine(engine);
    console.log("[bench-csm-boombox] 400 BoomBox + 4-cascade CSM ready (native bgfx)");
}

main().catch(function (err) {
    console.error("[bench-csm-boombox] fatal:", err && err.stack ? err.stack : err);
});
