// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene24.ts (esbuild, target es2017)
// Scene 24 — Hill Valley — tags: std, babylon
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene24-hillvalley.js

async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  addToScene(scene, await loadBabylon(engine, "https://www.babylonjs.com/Scenes/hillvalley/HillValley.babylon"));
  attachFreeControl(scene.camera, canvas, scene);
  await registerScene(scene);
  await startEngine(engine);
  canvas.dataset.drawCalls = String(engine.drawCallCount);
  canvas.dataset.initMs = String(performance.now() - __initStart);
  canvas.dataset.ready = "true";
}
main().catch(console.error);
