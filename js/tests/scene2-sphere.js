// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene2.ts (esbuild, target es2017)
// Scene 2 — Sphere — tags: std, procedural
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene2-sphere.js

async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  scene.camera = createArcRotateCamera(-Math.PI / 2, Math.PI / 2, 5, { x: 0, y: 0, z: 0 });
  scene.camera.nearPlane = 1;
  scene.camera.farPlane = 1e4;
  attachControl(scene.camera, canvas, scene);
  const light = createDirectionalLight([0, -1, 0]);
  light.diffuse = [1, 0, 0];
  light.specular = [0, 1, 0];
  addToScene(scene, light);
  const sphere = createSphere(engine);
  sphere.material = createStandardMaterial();
  addToScene(scene, sphere);
  await registerScene(scene);
  await startEngine(engine);
  canvas.dataset.drawCalls = String(engine.drawCallCount);
  canvas.dataset.initMs = String(performance.now() - __initStart);
  canvas.dataset.ready = "true";
}
main().catch(console.error);
