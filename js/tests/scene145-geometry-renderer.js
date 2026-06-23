// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene145.ts (esbuild, target es2017)
// Scene 145 — Geometry Renderer Task — tags: frame-graph, geometry-renderer, mrt, babylon
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene145-geometry-renderer.js

const HILLVALLEY_URL = "https://www.babylonjs.com/Scenes/hillvalley/HillValley.babylon";
async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas, {
    // Two MRTs at up to 7 attachments each — well under the WebGPU 8-attachment cap
    // but exceeding the default 32-byte-per-sample limit when 7 attachments are active.
    requiredLimits: { maxColorAttachmentBytesPerSample: 64 }
  });
  const scene = createSceneContext(engine, { defaultRenderTask: false });
  addToScene(scene, await loadBabylon(engine, HILLVALLEY_URL));
  const camera = scene.camera;
  camera.position.set(-26.695675321687403, 2.7769661153192278, 21.145217983348115);
  camera.target.set(-27.038161178180832, 2.7243780642457263, 20.20716786084526);
  attachFreeControl(camera, canvas, scene);
  const samples = engine.msaaSamples;
  const intermediateTarget = createRenderTarget({
    lbl: "scene145-intermediate",
    format: engine.format,
    dFormat: "depth24plus-stencil8",
    samples,
    size: engine
  });
  const ssIntermediate = createRenderTarget({
    lbl: "scene145-ss-intermediate",
    format: engine.format,
    samples: 1,
    size: engine
  });
  const scRT = engine.scRT;
  const realColorTarget = createRenderTarget({
    lbl: "scene145-real-color",
    format: engine.format,
    samples,
    size: engine
  });
  const sceneTask = createRenderTask(
    {
      name: "scene145-scene",
      rt: intermediateTarget,
      clrColor: scene.clearColor,
      clr: true
    },
    engine,
    scene
  );
  const geomTaskA = createGeometryRendererTask(
    {
      name: "scene145-geom-a",
      samples,
      textureDescriptions: [
        { type: GeometryTextureType.IRRADIANCE },
        { type: GeometryTextureType.WORLD_POSITION },
        { type: GeometryTextureType.NORMALIZED_VIEW_DEPTH },
        { type: GeometryTextureType.VIEW_NORMAL },
        { type: GeometryTextureType.WORLD_NORMAL },
        { type: GeometryTextureType.REFLECTIVITY },
        { type: GeometryTextureType.ALBEDO }
      ],
      // Real-color output: the lit material color is written into
      // `realColorTarget` alongside the 7 geometry-data attachments.
      // `targetTextureClearColor` initialises the target so background
      // pixels (sky, etc.) show through with a known colour.
      targetTexture: realColorTarget,
      targetTextureClearColor: { r: 0, g: 0, b: 0, a: 1 }
    },
    engine,
    scene
  );
  const geomTaskB = createGeometryRendererTask(
    {
      name: "scene145-geom-b",
      samples,
      textureDescriptions: [
        { type: GeometryTextureType.LOCAL_POSITION },
        // r16float instead of the default r32float — r32 isn't
        // blendable or MSAA-resolvable in WebGPU, but the geometry
        // pipeline applies per-attachment alpha-blending and the MRT
        // is MSAA-resolved to single-sample wrappers downstream.
        { type: GeometryTextureType.VIEW_DEPTH, format: "r16float" },
        { type: GeometryTextureType.SCREENSPACE_DEPTH },
        { type: GeometryTextureType.LINEAR_VELOCITY }
      ]
    },
    engine,
    scene
  );
  addTaskAtStart(scene, sceneTask);
  addTask(scene, geomTaskA);
  addTask(scene, geomTaskB);
  const bottomImpostors = [
    { name: "normViewDepth", source: geomTaskA.geometryNormalizedViewDepthTexture },
    { name: "viewNormal", source: geomTaskA.geometryViewNormalTexture },
    { name: "worldNormal", source: geomTaskA.geometryWorldNormalTexture },
    { name: "worldPosition", source: geomTaskA.geometryWorldPositionTexture },
    { name: "reflectivity", source: geomTaskA.geometryReflectivityTexture },
    { name: "albedo", source: geomTaskA.geometryAlbedoTexture }
  ];
  const topImpostors = [
    { name: "irradiance", source: geomTaskA.geometryIrradianceTexture },
    { name: "localPosition", source: geomTaskB.geometryLocalPositionTexture },
    { name: "viewDepth", source: geomTaskB.geometryViewDepthTexture },
    { name: "screenspaceDepth", source: geomTaskB.geometryScreenspaceDepthTexture },
    { name: "linearVelocity", source: geomTaskB.geometryLinearVelocityTexture },
    // Real-color attachment written by geomTaskA via its targetTexture.
    // This is the actual lit material color (same shader as the regular
    // scene render) — bundled into the geometry MRT pass so we render
    // 11 geometry textures + the lit colour in one go.
    { name: "realColor", source: geomTaskA.outputTexture }
  ];
  const placeStrip = (strip, y) => {
    const tileW = 1 / strip.length;
    for (let i = 0; i < strip.length; i++) {
      const entry = strip[i];
      addTask(
        scene,
        createCopyToTextureTask(
          {
            name: `scene145-impostor-${entry.name}`,
            sourceTexture: entry.source,
            targetTexture: intermediateTarget,
            viewport: { x: i * tileW, y, width: tileW, height: 0.15 }
          },
          engine,
          scene
        )
      );
    }
  };
  placeStrip(bottomImpostors, 0);
  placeStrip(topImpostors, 0.85);
  if (samples > 1) {
    addTask(
      scene,
      createCopyToTextureTask(
        {
          name: "scene145-resolve",
          sourceTexture: intermediateTarget,
          resolveTexture: ssIntermediate
        },
        engine,
        scene
      )
    );
  }
  addTask(
    scene,
    createCopyToTextureTask(
      {
        name: "scene145-to-swap",
        sourceTexture: samples > 1 ? ssIntermediate : intermediateTarget,
        targetTexture: scRT
      },
      engine,
      scene
    )
  );
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
