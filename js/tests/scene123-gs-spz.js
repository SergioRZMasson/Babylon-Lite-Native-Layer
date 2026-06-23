// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene123.ts (esbuild, target es2017)
// Scene 123 — Gaussian Splatting SPZ — tags: gaussian-splatting, spz, sh
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene123-gs-spz.js

const SPLAT_URL = "https://raw.githubusercontent.com/CedricGuillemet/dump/master/hornedlizard/hornedlizard.spz";
async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  scene.clearColor = { r: 0, g: 0, b: 0, a: 1 };
  const camera = createArcRotateCamera(4.6, 0.956, 3, { x: 0, y: -0.2, z: 0.2 });
  camera.nearPlane = 1e-3;
  camera.farPlane = 1e3;
  scene.camera = camera;
  attachControl(camera, canvas, scene);
  const splat = await loadSPZ(scene, SPLAT_URL);
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
