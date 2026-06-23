// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene149.ts (esbuild, target es2017)
// Scene 149 — Node-Material Geometry Renderer (PowerPlant) — tags: frame-graph, geometry-renderer, mrt, node-material, gltf
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene149-node-geometry-renderer.js

const POWERPLANT_URL = "https://assets.babylonjs.com/meshes/PowerPlant/powerplant.glb";
function collectMeshes(container) {
  var _a;
  const out = [];
  const stack = [...container.entities];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) {
      continue;
    }
    if ("_gpu" in node && "material" in node) {
      out.push(node);
    }
    if ((_a = node.children) == null ? void 0 : _a.length) {
      stack.push(...node.children);
    }
  }
  return out;
}
function resolveAlbedo(engine, mat) {
  var _a, _b, _c, _d, _e;
  const m = mat;
  if (m.baseColorTexture) {
    return m.baseColorTexture;
  }
  if (m.diffuseTexture) {
    return m.diffuseTexture;
  }
  const c = (_b = (_a = m.baseColorFactor) != null ? _a : m.diffuseColor) != null ? _b : [0.8, 0.8, 0.8];
  return createSolidTexture2D(engine, (_c = c[0]) != null ? _c : 0.8, (_d = c[1]) != null ? _d : 0.8, (_e = c[2]) != null ? _e : 0.8, 1);
}
async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas, {
    // Two MRTs at up to 7 attachments each exceed the default 32-byte-per-sample limit.
    requiredLimits: { maxColorAttachmentBytesPerSample: 64 }
  });
  const scene = createSceneContext(engine, { defaultRenderTask: false });
  const loaded = await loadGltf(engine, POWERPLANT_URL);
  const byMaterial = /* @__PURE__ */ new Map();
  for (const mesh of collectMeshes(loaded)) {
    const mat = mesh.material;
    if (!mat) {
      continue;
    }
    let list = byMaterial.get(mat);
    if (!list) {
      list = [];
      byMaterial.set(mat, list);
    }
    list.push(mesh);
  }
  for (const [origMat, meshes] of byMaterial) {
    const nodeMat = await parseNodeMaterialFromSnippet(engine, "", { json: SCENE149_NME_JSON, blockLoader: loadNodeBlockEmitterWithGeometry });
    nodeMat.inputs.albedo.texture = resolveAlbedo(engine, origMat);
    for (const mesh of meshes) {
      mesh.material = nodeMat;
    }
  }
  canvas.dataset.materialCount = String(byMaterial.size);
  addToScene(scene, loaded);
  const camera = createDefaultCamera(scene);
  camera.alpha = -3.12;
  camera.beta = 1.3;
  camera.radius = 75.63;
  scene.camera = camera;
  attachControl(camera, canvas, scene);
  const samples = engine.msaaSamples;
  const intermediateTarget = createRenderTarget({
    lbl: "scene149-intermediate",
    format: engine.format,
    dFormat: "depth24plus-stencil8",
    samples,
    size: engine
  });
  const ssIntermediate = createRenderTarget({
    lbl: "scene149-ss-intermediate",
    format: engine.format,
    samples: 1,
    size: engine
  });
  const scRT = engine.scRT;
  const sceneTask = createRenderTask(
    {
      name: "scene149-scene",
      rt: intermediateTarget,
      clrColor: scene.clearColor,
      clr: true
    },
    engine,
    scene
  );
  const geomTaskA = createGeometryRendererTask(
    {
      name: "scene149-geom-a",
      samples,
      textureDescriptions: [
        { type: GeometryTextureType.IRRADIANCE },
        { type: GeometryTextureType.WORLD_POSITION },
        { type: GeometryTextureType.NORMALIZED_VIEW_DEPTH },
        { type: GeometryTextureType.VIEW_NORMAL },
        { type: GeometryTextureType.WORLD_NORMAL },
        { type: GeometryTextureType.REFLECTIVITY },
        { type: GeometryTextureType.ALBEDO }
      ]
    },
    engine,
    scene
  );
  const geomTaskB = createGeometryRendererTask(
    {
      name: "scene149-geom-b",
      samples,
      textureDescriptions: [
        { type: GeometryTextureType.LOCAL_POSITION },
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
  const impostors = [
    { name: "viewNormal", source: geomTaskA.geometryViewNormalTexture },
    { name: "worldNormal", source: geomTaskA.geometryWorldNormalTexture },
    { name: "worldPosition", source: geomTaskA.geometryWorldPositionTexture },
    { name: "reflectivity", source: geomTaskA.geometryReflectivityTexture },
    { name: "localPosition", source: geomTaskB.geometryLocalPositionTexture },
    { name: "viewDepth", source: geomTaskB.geometryViewDepthTexture },
    { name: "screenspaceDepth", source: geomTaskB.geometryScreenspaceDepthTexture }
  ];
  const placeStrip = (strip, y) => {
    const tileW = 1 / strip.length;
    for (let i = 0; i < strip.length; i++) {
      const entry = strip[i];
      addTask(
        scene,
        createCopyToTextureTask(
          {
            name: `scene149-impostor-${entry.name}`,
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
  placeStrip(impostors, 0);
  if (samples > 1) {
    addTask(
      scene,
      createCopyToTextureTask(
        {
          name: "scene149-resolve",
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
        name: "scene149-to-swap",
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
