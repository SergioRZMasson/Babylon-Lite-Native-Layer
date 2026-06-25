// Skeletal animation demo — loads a skinned glTF (CesiumMan, a walking figure) and lets
// the native engine drive the skeleton: per-frame keyframe sampling → joint world matrices
// → bone palette (invMeshWorld · jointWorld · IBM) → GPU skinning, all in C++.

import { createEngine, createSceneContext, loadGltf, addToScene, createDefaultCamera, createHemisphericLight, attachControl, registerScene, startEngine } from "babylon-lite";

async function main() {
    const canvas = document.getElementById("renderCanvas");
    const engine = await createEngine(canvas);
    const scene = createSceneContext(engine);
    scene.clearColor = { r: 0.1, g: 0.11, b: 0.14, a: 1 };

    addToScene(scene, await loadGltf(engine, "CesiumMan.glb"));

    const cam = createDefaultCamera(scene);
    attachControl(cam, canvas, scene);
    addToScene(scene, createHemisphericLight([0.4, 1, 0.6], 1.1));

    await registerScene(scene);
    await startEngine(engine);
    console.log("[skin] CesiumMan started; animationGroups=" + scene.animationGroups.length);
}

main().catch(function (err) {
    console.error("[skin] fatal:", err && err.stack ? err.stack : err);
});
