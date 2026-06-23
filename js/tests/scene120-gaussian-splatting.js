// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene120.ts (esbuild, target es2017)
// Scene 120 — Gaussian Splatting — tags: gaussian-splatting, ply
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene120-gaussian-splatting.js

const SPLAT_URL = "https://assets.babylonjs.com/splats/Halo_Believe.ply";
async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  scene.clearColor = { r: 0, g: 0, b: 0, a: 1 };
  const camera = createArcRotateCamera(-Math.PI / 2, Math.PI / 2.5, 6, { x: 0, y: 0, z: 0 });
  camera.nearPlane = 0.1;
  camera.farPlane = 100;
  scene.camera = camera;
  attachControl(camera, canvas, scene);
  const splat = await loadSplat(scene, SPLAT_URL);
  await registerScene(scene);
  await startEngine(engine);
  await splat.firstSortReady;
  await new Promise((r) => requestAnimationFrame(() => r()));
  canvas.dataset.drawCalls = String(engine.drawCallCount);
  canvas.dataset.initMs = String(performance.now() - __initStart);
  canvas.dataset.ready = "true";
}
main().catch((err) => {
  console.error(err);
});
