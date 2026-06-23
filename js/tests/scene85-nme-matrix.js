// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene85.ts (esbuild, target es2017)
// Scene 85 — NME Matrix — tags: nme, procedural, matrix
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene85-nme-matrix.js

async function main() {
  const initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  scene.clearColor = { r: 0.02, g: 0.02, b: 0.035, a: 1 };
  const camera = createArcRotateCamera(-Math.PI / 2, Math.PI / 2, 4, { x: 0, y: 0, z: 0 });
  camera.nearPlane = 0.1;
  camera.farPlane = 100;
  scene.camera = camera;
  attachControl(camera, canvas, scene);
  const material = await parseNodeMaterialFromSnippet(engine, "", { json: SCENE85_NME_JSON });
  const plane = createPlane(engine, { width: 2.4, height: 1.8 });
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
