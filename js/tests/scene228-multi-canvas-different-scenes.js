// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene228.ts (esbuild, target es2017)
// Scene 228 — Multi-Canvas (Different Scenes) — tags: multi-canvas, surface, demo, std
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene228-multi-canvas-different-scenes.js

async function main() {
  const __initStart = performance.now();
  const renderCanvas = document.getElementById("renderCanvas");
  const canvasB = document.getElementById("canvasB");
  const engine = await createEngine(renderCanvas);
  const surfaceB = createSurface(engine, canvasB);
  const sceneA = createSceneContext(engine);
  sceneA.camera = createArcRotateCamera(-Math.PI / 2, Math.PI / 2.2, 9, { x: 0, y: 0, z: 0 });
  attachControl(sceneA.camera, renderCanvas, sceneA);
  sceneA.clearColor = { r: 0.12, g: 0.13, b: 0.18, a: 1 };
  addToScene(sceneA, createHemisphericLight([0, 1, 0], 1));
  const colors = [
    [0.85, 0.35, 0.25],
    [0.3, 0.8, 0.45],
    [0.3, 0.55, 0.95],
    [0.95, 0.8, 0.3],
    [0.75, 0.4, 0.85]
  ];
  for (let i = 0; i < colors.length; i++) {
    const sphere = createSphere(engine, { diameter: 1.2, segments: 16 });
    sphere.position.set((i - (colors.length - 1) / 2) * 1.6, 0, 0);
    const mat = createStandardMaterial();
    mat.diffuseColor = colors[i];
    sphere.material = mat;
    addToScene(sceneA, sphere);
  }
  const sceneB = createSceneContext(surfaceB);
  sceneB.camera = createArcRotateCamera(Math.PI / 4, Math.PI / 3, 6, { x: 0, y: 0, z: 0 });
  attachControl(sceneB.camera, canvasB, sceneB);
  sceneB.clearColor = { r: 0.2, g: 0.15, b: 0.12, a: 1 };
  const dir = createDirectionalLight([-0.4, -1, 0.3]);
  dir.diffuse = [1, 0.9, 0.75];
  addToScene(sceneB, dir);
  addToScene(sceneB, createHemisphericLight([0, 1, 0], 0.25));
  const knot = createTorusKnot(surfaceB.engine, { radius: 1.4, tube: 0.35, radialSegments: 96, tubularSegments: 16 });
  const knotMat = createStandardMaterial();
  knotMat.diffuseColor = [0.85, 0.55, 0.25];
  knotMat.specularColor = [0.9, 0.85, 0.7];
  knot.material = knotMat;
  addToScene(sceneB, knot);
  await registerScene(sceneA);
  await registerScene(sceneB);
  await startEngine(engine);
  renderCanvas.dataset.drawCalls = String(engine.drawCallCount);
  renderCanvas.dataset.initMs = String(performance.now() - __initStart);
  renderCanvas.dataset.ready = "true";
  canvasB.dataset.ready = "true";
}
main().catch(console.error);
