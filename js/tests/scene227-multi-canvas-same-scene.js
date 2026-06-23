// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene227.ts (esbuild, target es2017)
// Scene 227 — Multi-Canvas (Same Scene) — tags: multi-canvas, surface, demo, std
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene227-multi-canvas-same-scene.js

async function main() {
  const __initStart = performance.now();
  const renderCanvas = document.getElementById("renderCanvas");
  const canvasB = document.getElementById("canvasB");
  const engine = await createEngine(renderCanvas);
  const surfaceB = createSurface(engine, canvasB);
  const groundMat = createStandardMaterial();
  groundMat.diffuseColor = [0.4, 0.45, 0.5];
  const ground = createGround(engine, { width: 6, height: 6 });
  ground.material = groundMat;
  const boxMat = createStandardMaterial();
  boxMat.diffuseColor = [0.85, 0.35, 0.25];
  const box = createBox(engine, 1.2);
  box.position.set(0, 0.8, 0);
  box.material = boxMat;
  const light = createHemisphericLight([0, 1, 0], 1);
  const sceneA = createSceneContext(engine);
  sceneA.camera = createArcRotateCamera(-Math.PI / 2, Math.PI / 2.5, 6, { x: 0, y: 0.6, z: 0 });
  attachControl(sceneA.camera, renderCanvas, sceneA);
  addToScene(sceneA, light);
  addToScene(sceneA, ground);
  addToScene(sceneA, box);
  const sceneB = createSceneContext(surfaceB);
  sceneB.camera = createArcRotateCamera(-Math.PI / 4, Math.PI / 3.5, 6, { x: 0, y: 0.6, z: 0 });
  attachControl(sceneB.camera, canvasB, sceneB);
  addToScene(sceneB, light);
  addToScene(sceneB, ground);
  addToScene(sceneB, box);
  await registerScene(sceneA);
  await registerScene(sceneB);
  await startEngine(engine);
  renderCanvas.dataset.drawCalls = String(engine.drawCallCount);
  renderCanvas.dataset.initMs = String(performance.now() - __initStart);
  renderCanvas.dataset.ready = "true";
  canvasB.dataset.ready = "true";
}
main().catch(console.error);
