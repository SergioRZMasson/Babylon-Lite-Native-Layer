// Skeletal animation demo — Fox.glb (24-bone skeleton, 3 clips: Survey/Walk/Run).
// Demonstrates selecting a single animation: glTF groups auto-play on add, so we stop all
// then play just the "Walk" clip. Skinning (joint sampling → bone palette → GPU skinning)
// runs natively in C++.

import { createEngine, createSceneContext, loadGltf, addToScene, stopAnimation, playAnimation, createDefaultCamera, createHemisphericLight, attachControl, registerScene, startEngine } from "babylon-lite";

async function main() {
    const canvas = document.getElementById("renderCanvas");
    const engine = await createEngine(canvas);
    const scene = createSceneContext(engine);
    scene.clearColor = { r: 0.1, g: 0.11, b: 0.14, a: 1 };

    addToScene(scene, await loadGltf(engine, "Fox.glb"));

    // Play only the Walk clip (index 1: Survey, Walk, Run).
    for (let i = 0; i < scene.animationGroups.length; i++) { stopAnimation(scene.animationGroups[i]); }
    if (scene.animationGroups[1]) { playAnimation(scene.animationGroups[1]); }

    const cam = createDefaultCamera(scene);
    attachControl(cam, canvas, scene);
    addToScene(scene, createHemisphericLight([0.4, 1, 0.6], 1.1));

    await registerScene(scene);
    await startEngine(engine);
    console.log("[skin] Fox started; animationGroups=" + scene.animationGroups.length);
}

main().catch(function (err) {
    console.error("[skin] fatal:", err && err.stack ? err.stack : err);
});
