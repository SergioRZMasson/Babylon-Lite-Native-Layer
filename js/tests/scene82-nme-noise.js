// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene82.ts (esbuild, target es2017)
// Scene 82 — NME Procedural Noise — tags: nme, procedural, noise
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene82-nme-noise.js

async function main() {
  const initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  scene.clearColor = { r: 0, g: 0, b: 0, a: 1 };
  const camera = createArcRotateCamera(-Math.PI / 2, Math.PI / 2, 4, { x: 0, y: 0, z: 0 });
  camera.nearPlane = 0.5;
  camera.farPlane = 100;
  scene.camera = camera;
  attachControl(camera, canvas, scene);
  const material = await parseNodeMaterialFromSnippet(engine, "", { json: SCENE82_NME_JSON });
  const plane = createPlane(engine, { width: 3.2, height: 2.2 });
  plane.material = material;
  addToScene(scene, plane);
  await registerScene(scene);
  await startEngine(engine);
  canvas.dataset.drawCalls = String(engine.drawCallCount);
  canvas.dataset.initMs = String(performance.now() - initStart);
  canvas.dataset.ready = "true";
}
main().catch((err) => {
  console.error(err);
  const canvas = document.getElementById("renderCanvas");
  if (canvas) {
    canvas.dataset.error = String(err);
  }
});
