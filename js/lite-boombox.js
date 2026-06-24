// Scene 1 — BoomBox — written exactly like the Babylon-Lite web scene
// (lab/lite/src/lite/scene1.ts). The only difference from the web page is the
// missing `import { ... } from "babylon-lite"` line; the prelude installs the same
// API. It loads a glTF PBR model and renders it through the native C++/bgfx engine.
//
// NOTE: loadEnvironment now parses the Babylon `.env` into a prefiltered specular
// cubemap + SH irradiance and lights the PBR materials with real image-based lighting
// (SH diffuse + prefiltered-cube specular + ACES tone mapping). The skybox/ground
// background and HDR (.hdr) path are still stand-ins; reflections + glTF are real.

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
