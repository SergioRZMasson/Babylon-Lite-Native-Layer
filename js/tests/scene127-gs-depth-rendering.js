// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene127.ts (esbuild, target es2017)
// Scene 127 — Gaussian Splatting Depth Rendering — tags: gaussian-splatting, depth-rendering
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene127-gs-depth-rendering.js

const SPLAT_URL = "https://raw.githubusercontent.com/CedricGuillemet/dump/master/Halo_Believe.splat";
const NEAR = 0.03;
const FAR = 15;
async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  scene.clearColor = { r: 1, g: 1, b: 1, a: 1 };
  const camera = createArcRotateCamera(-Math.PI / 2, Math.PI / 2.5, 10, { x: 0, y: 1, z: 0 });
  camera.nearPlane = NEAR;
  camera.farPlane = FAR;
  scene.camera = camera;
  attachControl(camera, canvas, scene);
  const depthMaterial = createLinearDepthMaterial({ near: NEAR, far: FAR });
  const box = createBox(engine, 2);
  box.position.x = -2;
  box.material = depthMaterial;
  addToScene(scene, box);
  const sphere = createSphere(engine, { diameter: 2 });
  sphere.position.x = 2;
  sphere.material = depthMaterial;
  addToScene(scene, sphere);
  const ground = createGround(engine, { width: 6, height: 6 });
  ground.position.y = -1;
  ground.material = depthMaterial;
  addToScene(scene, ground);
  const splat = await loadSplat(scene, SPLAT_URL, [gsLinearDepthFragment]);
  splat.position.y = 3;
  splat.position.z = 0;
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
