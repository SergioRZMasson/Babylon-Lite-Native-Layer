// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene61.ts (esbuild, target es2017)
// Scene 61 — NME Normal As Color — tags: nme, procedural
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene61-nme-normal.js

async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  scene.clearColor = { r: 0, g: 0, b: 0, a: 1 };
  scene.camera = createArcRotateCamera(-Math.PI / 2, Math.PI / 2, 5, { x: 0, y: 0, z: 0 });
  scene.camera.nearPlane = 1;
  scene.camera.farPlane = 1e4;
  attachControl(scene.camera, canvas, scene);
  const material = await parseNodeMaterialFromSnippet(engine, "", { json: SCENE61_NME_JSON });
  const sphere = createSphere(engine);
  sphere.material = material;
  addToScene(scene, sphere);
  await registerScene(scene);
  await startEngine(engine);
  canvas.dataset.drawCalls = String(engine.drawCallCount);
  canvas.dataset.initMs = String(performance.now() - __initStart);
  canvas.dataset.ready = "true";
}
main().catch(console.error);
