// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene147.ts (esbuild, target es2017)
// Scene 147 — Circle of Confusion — tags: frame-graph, geometry-renderer, post-process, circle-of-confusion, depth-of-field
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene147-circle-of-confusion.js

const POWERPLANT_URL = "https://assets.babylonjs.com/meshes/PowerPlant/powerplant.glb";
async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine, { defaultRenderTask: false });
  addToScene(scene, createHemisphericLight([0, 1, 0], 1.5));
  addToScene(scene, await loadGltf(engine, POWERPLANT_URL));
  const camera = createDefaultCamera(scene);
  camera.alpha = -3.12;
  camera.beta = 1.3;
  camera.radius = 75.63;
  attachControl(camera, canvas, scene);
  const sampleCount = 1;
  const colorTarget = createRenderTarget({
    lbl: "scene147-color",
    format: engine.format,
    samples: sampleCount,
    size: engine
  });
  const scRT = engine.scRT;
  const geomTask = createGeometryRendererTask(
    {
      name: "scene147-geom",
      samples: sampleCount,
      textureDescriptions: [{ type: GeometryTextureType.NORMALIZED_VIEW_DEPTH }]
    },
    engine,
    scene
  );
  const sceneTask = createRenderTask(
    {
      name: "scene147-scene",
      rt: colorTarget,
      depth: geomTask.geometryDepthTexture,
      clrColor: scene.clearColor,
      clr: true
    },
    engine,
    scene
  );
  const cocTask = createCircleOfConfusionPostProcessTask(
    {
      name: "scene147-coc",
      sourceTexture: colorTarget,
      depthTexture: geomTask.geometryNormalizedViewDepthTexture,
      camera,
      lensSize: 50,
      focalLength: 50,
      fStop: 0.04,
      focusDistance: 8e4,
      targetTexture: scRT
    },
    engine,
    scene
  );
  addTask(scene, geomTask);
  addTask(scene, sceneTask);
  addTask(scene, cocTask);
  await registerScene(scene);
  await startEngine(engine);
  canvas.dataset.drawCalls = String(engine.drawCallCount);
  canvas.dataset.initMs = String(performance.now() - __initStart);
  canvas.dataset.ready = "true";
}
main().catch((err) => {
  console.error(err);
  const canvas = document.getElementById("renderCanvas");
  if (canvas) {
    canvas.dataset.error = String(err);
  }
});
