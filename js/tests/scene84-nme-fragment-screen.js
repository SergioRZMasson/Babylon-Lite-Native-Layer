// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene84.ts (esbuild, target es2017)
// Scene 84 — NME Fragment Screen — tags: nme, procedural, screen, depth
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene84-nme-fragment-screen.js

async function main() {
  const initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  scene.clearColor = { r: 0, g: 0, b: 0, a: 1 };
  const camera = createArcRotateCamera(-Math.PI / 2, Math.PI / 2, 4, { x: 0, y: 0, z: 0 });
  camera.nearPlane = 0.1;
  camera.farPlane = 100;
  scene.camera = camera;
  attachControl(camera, canvas, scene);
  const light = createHemisphericLight([0, 1, 0], 1);
  addToScene(scene, light);
  const material = await parseNodeMaterialFromSnippet(engine, "", { json: SCENE84_NME_JSON });
  const screenPlane = createPlane(engine, { width: 3.2, height: 2.2 });
  screenPlane.material = material;
  addToScene(scene, screenPlane);
  const backMat = createStandardMaterial();
  backMat.disableLighting = true;
  backMat.emissiveColor = [0.02, 0.14, 0.55];
  const background = createPlane(engine, { width: 3.2, height: 2.2 });
  background.position.set(0, 0, -0.2);
  background.material = backMat;
  addToScene(scene, background);
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
