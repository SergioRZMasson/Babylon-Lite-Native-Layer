// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene125.ts (esbuild, target es2017)
// Scene 125 — Gaussian Splatting bakeCurrentTransformIntoVertices — tags: gaussian-splatting, bake-transform
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene125-gs-bake-transform.js

const SPLAT_URL = "https://raw.githubusercontent.com/CedricGuillemet/dump/master/Halo_Believe.splat";
async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  scene.clearColor = { r: 0, g: 0, b: 0, a: 1 };
  const camera = createArcRotateCamera(4.57, 1.29, 18, { x: 0, y: 0, z: 0 });
  camera.nearPlane = 0.1;
  camera.farPlane = 100;
  scene.camera = camera;
  attachControl(camera, canvas, scene);
  const splat = await loadSplat(scene, SPLAT_URL);
  splat.position.y = 1.7;
  splat.scaling.x = 10;
  splat.scaling.y = 10;
  splat.scaling.z = 10;
  splat.rotation.z = Math.PI * 0.75;
  splat.rotation.x = Math.PI * 0.25;
  bakeCurrentTransformIntoVertices(splat);
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
