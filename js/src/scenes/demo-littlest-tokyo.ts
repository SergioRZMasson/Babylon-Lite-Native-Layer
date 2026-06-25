// Demo — Littlest Tokyo (animated glTF showcase), native-layer adaptation of
// lab/lite/src/demos/littlest-tokyo.ts. Renders Glen Fox's "Littlest Tokyo" diorama:
// uncompressed glTF geometry + skin, PBR materials lit by an environment cube (IBL), with
// the model's looping animation (cars, train, drifting smoke) playing on load.
//
// Differences from the web demo (browser-only bits the native layer doesn't need): no
// Draco/meshopt decoder bases (this LittlestTokyo.glb is uncompressed); the visible HDR
// skybox + on-screen progress/auto-rotate UI are omitted; IBL uses the local
// environmentSpecular.env (the web demo used environment.dds).
//
// Model: "Littlest Tokyo" by Glen Fox — CC-BY 4.0 (https://artstation.com/artwork/1AGwX).

import { createEngine, createSceneContext, createArcRotateCamera, attachControl, loadGltf, loadEnvironment, addToScene, playAnimation, onBeforeRender, registerScene, startEngine } from "babylon-lite";

const CAM = { alpha: 2.3, beta: 1.12, radius: 700, target: { x: 86, y: -100, z: -26 }, fov: 0.8 };
const AUTO_ROTATE_SPEED = 0.12; // radians / second

async function main() {
    const canvas = document.getElementById("renderCanvas");

    const engine = await createEngine(canvas);
    const scene = createSceneContext(engine);

    const cam = createArcRotateCamera(CAM.alpha, CAM.beta, CAM.radius, CAM.target);
    cam.fov = CAM.fov;
    cam.nearPlane = 1;
    cam.farPlane = 5000;
    scene.camera = cam;
    attachControl(cam, canvas, scene);

    await Promise.all([
        loadGltf(engine, "https://playground.babylonjs.com/scenes/LittlestTokyo.glb").then(function (asset) {
            addToScene(scene, asset);
            const groups = asset.animationGroups || [];
            for (let i = 0; i < groups.length; i++) {
                groups[i].loopAnimation = true;
                playAnimation(groups[i]);
            }
        }),
        loadEnvironment(scene, "https://assets.babylonjs.com/core/environments/environmentSpecular.env", {}),
    ]);

    // Gentle auto-orbit (matches the web demo's showcase feel).
    let last = performance.now();
    onBeforeRender(scene, function () {
        const now = performance.now();
        cam.alpha += (AUTO_ROTATE_SPEED * (now - last)) / 1000;
        last = now;
    });

    await registerScene(scene);
    await startEngine(engine);
    console.log("[tokyo] Littlest Tokyo started (native PBR + IBL via bgfx)");
}

main().catch(function (err) {
    console.error("[tokyo] fatal:", err && err.stack ? err.stack : err);
});
