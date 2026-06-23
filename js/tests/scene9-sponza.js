// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene9.ts (esbuild, target es2017)
// Scene 9 — Sponza (.babylon) — tags: std, babylon
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene9-sponza.js

async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  addToScene(scene, await loadBabylon(engine, "https://www.babylonjs.com/Scenes/Sponza/Sponza.babylon", { loadCamera: false }));
  scene.camera = createArcRotateCamera(
    0,
    // alpha — looking down +X
    Math.PI / 2.2,
    // beta  — slightly above horizon
    0.01,
    // radius — nearly at target (first-person view)
    { x: 5.0855, y: 2.492, z: 0.1654 }
  );
  scene.camera.nearPlane = 0.1;
  scene.camera.farPlane = 1e4;
  attachControl(scene.camera, canvas, scene);
  await registerScene(scene);
  await startEngine(engine);
  canvas.dataset.drawCalls = String(engine.drawCallCount);
  canvas.dataset.initMs = String(performance.now() - __initStart);
  canvas.dataset.ready = "true";
}
main().catch(console.error);
