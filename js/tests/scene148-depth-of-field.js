// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene148.ts (esbuild, target es2017)
// Scene 148 — Depth of Field — tags: frame-graph, geometry-renderer, post-process, depth-of-field, blur
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene148-depth-of-field.js

const POWERPLANT_URL = "https://assets.babylonjs.com/meshes/PowerPlant/powerplant.glb";
async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine, { defaultRenderTask: false });
  addToScene(scene, await loadGltf(engine, POWERPLANT_URL));
  scene.lights.length = 0;
  addToScene(scene, createHemisphericLight([0, 1, 0], 2));
  const camera = createDefaultCamera(scene);
  camera.alpha = -2.646;
  camera.beta = 1.313;
  camera.radius = 109.071;
  attachControl(camera, canvas, scene);
  const sampleCount = 4;
  const colorTarget = createRenderTarget({
    lbl: "scene148-color",
    format: engine.format,
    dFormat: "depth24plus-stencil8",
    samples: sampleCount,
    size: engine
  });
  const colorResolveTarget = createRenderTarget({
    lbl: "scene148-color-resolve",
    format: engine.format,
    samples: 1,
    size: engine
  });
  const scRT = engine.scRT;
  const geomTask = createGeometryRendererTask(
    {
      name: "scene148-geom",
      samples: 1,
      textureDescriptions: [{ type: GeometryTextureType.VIEW_DEPTH, format: "r16float", clearValue: { r: 0, g: 0, b: 0, a: 0 } }]
    },
    engine,
    scene
  );
  const sceneTask = createRenderTask(
    {
      name: "scene148-scene",
      rt: colorTarget,
      rst: colorResolveTarget,
      clrColor: scene.clearColor,
      clr: true
    },
    engine,
    scene
  );
  const dofTask = createDepthOfFieldPostProcessTask(
    {
      name: "scene148-dof",
      sourceTexture: colorResolveTarget,
      depthTexture: geomTask.geometryViewDepthTexture,
      camera,
      blurLevel: DepthOfFieldBlurLevel.High,
      depthNotNormalized: true,
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
  addTask(scene, dofTask);
  await registerScene(scene);
  dofTask.updateUniforms();
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
