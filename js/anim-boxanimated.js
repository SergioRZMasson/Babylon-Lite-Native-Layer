// Animation demo — loads a node-animated glTF (BoxAnimated) and lets the native engine
// drive the animation (keyframe sampling + node world matrices in C++). Mirrors how the
// Babylon-Lite parity animation scenes are written: loadGltf → addToScene auto-plays the
// animation groups; the native renderFrame advances them each frame.

async function main() {
    const canvas = document.getElementById("renderCanvas");
    const engine = await createEngine(canvas);
    const scene = createSceneContext(engine);
    scene.clearColor = { r: 0.08, g: 0.09, b: 0.12, a: 1 };

    addToScene(scene, await loadGltf(engine, "BoxAnimated.glb"));

    const cam = createDefaultCamera(scene);
    attachControl(cam, canvas, scene);
    addToScene(scene, createHemisphericLight([0.3, 1, 0.5], 1.0));

    await registerScene(scene);
    await startEngine(engine);
    console.log("[anim] BoxAnimated started; groups=" + scene.animationGroups.length);
}

main().catch(function (err) {
    console.error("[anim] fatal:", err && err.stack ? err.stack : err);
});
