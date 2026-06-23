// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene211.ts (esbuild, target es2017)
// Scene 211 — BrainStem Meshopt — tags: pbr, gltf, meshopt, quantization, skeleton, animation
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene211-meshopt-brainstem.js

const MODEL_URL = "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/BrainStem/glTF-Meshopt-EXT/BrainStem.gltf";
async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  addToScene(scene, await loadGltf(engine, MODEL_URL));
  const cam = createArcRotateCamera(Math.PI / 2, Math.PI / 2.2, 4.5, { x: -0.045, y: 0.043, z: 0.917 });
  scene.camera = cam;
  attachControl(cam, canvas, scene);
  addToScene(scene, createHemisphericLight([0, 1, 0], 1));
  scene.fixedDeltaMs = 16;
  const params = new URLSearchParams(window.location.search);
  const shouldFreeze = params.has("freeze");
  const seekTimeParam = parseFloat(params.get("seekTime") || "");
  let frameCount = 0;
  let seekDone = false;
  onBeforeRender(scene, () => {
    frameCount++;
    canvas.dataset.frameCount = String(frameCount);
    if (!isNaN(seekTimeParam) && seekTimeParam > 0 && frameCount === 10 && !seekDone) {
      const seekFrame = seekTimeParam * 60;
      for (const g of scene.animationGroups) {
        goToFrame(g, seekFrame);
      }
      seekDone = true;
      canvas.dataset.animationFrozen = "true";
    }
    if (shouldFreeze && !seekDone && frameCount === 300) {
      for (const g of scene.animationGroups) {
        pauseAnimation(g);
      }
      canvas.dataset.animationFrozen = "true";
    }
  });
  await registerScene(scene);
  await startEngine(engine);
  canvas.dataset.drawCalls = String(engine.drawCallCount);
  canvas.dataset.initMs = String(performance.now() - __initStart);
  canvas.dataset.ready = "true";
}
main().catch(console.error);
