// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene66.ts (esbuild, target es2017)
// Scene 66 — NME Full Playground (AT7YY5#6) — tags: nme, procedural, shadows, morph, reflection
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene66-nme-big.js

async function main() {
  var _a;
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  scene.clearColor = { r: 0, g: 0, b: 0, a: 1 };
  scene.camera = createArcRotateCamera(1.14, 0.95, 10, { x: 0, y: 0, z: 0 });
  scene.camera.nearPlane = 1;
  scene.camera.farPlane = 1e3;
  attachControl(scene.camera, canvas, scene);
  const light = createDirectionalLight([1, -1, 1], 0.7);
  addToScene(scene, light);
  const sphere = createSphere(engine, { segments: 16, diameter: 2 });
  sphere.position.set(-1.2, 1, 0);
  const box = createBox(engine, 1);
  box.position.set(1.2, 1, 0);
  const ground = createGround(engine, { width: 6, height: 6, subdivisions: 2 });
  ground.receiveShadows = true;
  const sphereData = createSphereData({ segments: 16, diameter: 2 });
  const deltas = sphereScrambleDeltas(sphereData.vertexCount);
  const freeze = new URLSearchParams(location.search).has("freeze");
  const morph = createMorphTargets(engine, [{ positions: deltas, normals: null }], sphereData.vertexCount, [freeze ? 1 : 0]);
  sphere.morphTargets = morph;
  const sg = createPcfDirectionalShadowGenerator(engine, light, {
    mapSize: 1024,
    orthoMinZ: -10,
    orthoMaxZ: 10
  });
  setShadowTaskCasterMeshes(sg, [sphere, box]);
  light.shadowGenerator = sg;
  const { json, textures } = await getScene66Nme();
  const textureOverrides = {};
  for (const t of textures) {
    const key = sanitizeName(t.name);
    textureOverrides[key] = await loadTexture2D(engine, t.url, {
      invertY: (_a = t.invertY) != null ? _a : true,
      srgb: false
      // NME textures work in gamma space, not linear
    });
  }
  const material = await parseNodeMaterialFromSnippet(engine, "", {
    json,
    textures: textureOverrides,
    shadowGenerators: [sg]
  });
  sphere.material = material;
  box.material = material;
  ground.material = material;
  addToScene(scene, sphere);
  addToScene(scene, box);
  addToScene(scene, ground);
  if (!freeze) {
    const t0 = performance.now();
    const w = new Float32Array([0]);
    onBeforeRender(scene, () => {
      const t = (performance.now() - t0) / SCENE66_MORPH_PERIOD_MS;
      const s = Math.sin(t * Math.PI * 2);
      w[0] = s * s;
      setMorphTargetWeights(engine, morph, w);
    });
  }
  await registerSceneWithShadowSupport(scene);
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
