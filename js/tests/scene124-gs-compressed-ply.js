// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene124.ts (esbuild, target es2017)
// Scene 124 — Gaussian Splatting compressed PLY — tags: gaussian-splatting, ply, compressed, sh
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene124-gs-compressed-ply.js

const SPLAT_URL = "https://raw.githubusercontent.com/CedricGuillemet/dump/master/hornedlizard/small_hornedlizard.compressed.ply";
async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  scene.clearColor = { r: 0, g: 0, b: 0, a: 1 };
  const camera = createArcRotateCamera(1.6, 0.5, 3, { x: 0, y: -0.2, z: 0.2 });
  camera.nearPlane = 1e-3;
  camera.farPlane = 1e3;
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
