// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene121.ts (esbuild, target es2017)
// Scene 121 — Gaussian Splatting updateData — tags: gaussian-splatting, splat
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene121-gs-update-data.js

const SPLAT_URL = "https://raw.githubusercontent.com/CedricGuillemet/dump/master/Halo_Believe.splat";
async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  scene.clearColor = { r: 0, g: 0, b: 0, a: 1 };
  const camera = createArcRotateCamera(-1, 1, 10, { x: 0, y: 0, z: 0 });
  camera.nearPlane = 0.1;
  camera.farPlane = 100;
  scene.camera = camera;
  attachControl(camera, canvas, scene);
  const gs = await loadSplat(scene, SPLAT_URL);
  await registerScene(scene);
  await startEngine(engine);
  await gs.firstSortReady;
  await new Promise((r) => requestAnimationFrame(() => r()));
  const buf = gs.splatsData;
  const positions = new Float32Array(buf);
  for (let i = 0; i < 3e4; i++) {
    positions[i * 8 + 1] -= 2;
  }
  gs.updateData(buf);
  await new Promise((r) => requestAnimationFrame(() => r()));
  window.__gs = gs;
  canvas.dataset.drawCalls = String(engine.drawCallCount);
  canvas.dataset.initMs = String(performance.now() - __initStart);
  canvas.dataset.ready = "true";
}
main().catch((err) => {
  console.error(err);
});
