// Scene 1 — BoomBox — written exactly like a Babylon-Lite web scene. Loads a glTF PBR
// model and renders it through the native C++/bgfx engine with image-based lighting from
// the `.env` (SH diffuse + prefiltered-cube specular). No WebGPU.

import { createEngine, createSceneContext, createDefaultCamera, loadGltf, loadEnvironment, addToScene, createHemisphericLight, attachControl, registerScene, startEngine } from "babylon-lite";

async function main() {
    const canvas = document.getElementById("renderCanvas");

    const engine = await createEngine(canvas);
    const scene = createSceneContext(engine);

    addToScene(scene, await loadGltf(engine, "https://playground.babylonjs.com/scenes/BoomBox.glb"));
    await loadEnvironment(scene, "https://assets.babylonjs.com/core/environments/environmentSpecular.env", {
        groundTextureUrl: "https://assets.babylonjs.com/core/environments/backgroundGround.png",
        skyboxUrl: "https://assets.babylonjs.com/core/environments/backgroundSkybox.dds",
        skyboxSize: 1000,
        brdfUrl: "/brdf-lut.png",
    });

    const cam = createDefaultCamera(scene);
    cam.alpha = 1.77538207638442;
    attachControl(cam, canvas, scene);

    addToScene(scene, createHemisphericLight([0, 1, 0], 1.0));

    await registerScene(scene);
    await startEngine(engine);
    console.log("[scene1] BoomBox started (native PBR via bgfx)");
}

main().catch(function (err) {
    console.error("[scene1] fatal:", err && err.stack ? err.stack : err);
});
