// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene140.ts (esbuild, target es2017)
// Scene 140 — NME PCF Alpha Discard Shadows — tags: nme, procedural, shadows, morph, reflection
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene140-nme-pcf-alpha-discard-shadows.js

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
  const params = new URLSearchParams(location.search);
  const shadowHoleProbe = params.has("shadowHoleProbe");
  const noShadows = params.has("noShadows");
  const solidShadowCaster = params.has("solidShadowCaster");
  const manualMorph = params.has("manualMorph");
  const light = createDirectionalLight([1, -1, 1], 0.7);
  addToScene(scene, light);
  const sphere = createSphere(engine, { segments: 16, diameter: 2 });
  sphere.position.set(-1.2, 1, 0);
  const box = createBox(engine, shadowHoleProbe ? 2 : 1);
  box.position.set(shadowHoleProbe ? 0 : 1.2, shadowHoleProbe ? 1.4 : 1, 0);
  const ground = createGround(engine, { width: 6, height: 6, subdivisions: 2 });
  ground.receiveShadows = !noShadows;
  const sphereData = createSphereData({ segments: 16, diameter: 2 });
  const deltas = sphereScrambleDeltas(sphereData.vertexCount);
  const freeze = params.has("freeze");
  const morph = createMorphTargets(engine, [{ positions: deltas, normals: null }], sphereData.vertexCount, [freeze ? 1 : 0]);
  sphere.morphTargets = morph;
  const sg = noShadows ? null : createPcfDirectionalShadowGenerator(engine, light, {
    mapSize: 1024,
    orthoMinZ: -10,
    orthoMaxZ: 10,
    forceRefreshEveryFrame: true
  });
  if (sg) {
    setShadowTaskCasterMeshes(sg, shadowHoleProbe ? [box] : [sphere, box]);
  }
  light.shadowGenerator = sg != null ? sg : void 0;
  const { json, textures } = await getScene66Nme();
  const textureOverrides = {};
  for (const t of textures) {
    const key = sanitizeName(t.name);
    textureOverrides[key] = await loadTexture2D(engine, t.url, {
      invertY: (_a = t.invertY) != null ? _a : true,
      srgb: false
    });
  }
  const casterJson = createScene66FinalAlphaDiscardJson(json);
  const receiverMaterial = await parseNodeMaterialFromSnippet(engine, "", {
    json,
    textures: textureOverrides,
    shadowGenerators: sg ? [sg] : void 0
  });
  const casterMaterial = await parseNodeMaterialFromSnippet(engine, "", {
    json: casterJson,
    textures: textureOverrides,
    shadowGenerators: sg ? [sg] : void 0
  });
  sphere.material = casterMaterial;
  box.material = shadowHoleProbe && solidShadowCaster ? receiverMaterial : casterMaterial;
  ground.material = receiverMaterial;
  if (!shadowHoleProbe) {
    addToScene(scene, sphere);
  }
  addToScene(scene, box);
  addToScene(scene, ground);
  if (manualMorph) {
    const w = new Float32Array([0]);
    const setMorphWeight = (value) => {
      w[0] = value;
      setMorphTargetWeights(engine, morph, w);
    };
    globalThis.__scene140SetMorphWeight = setMorphWeight;
    setMorphWeight(0);
  } else if (!freeze) {
    let t0 = 0;
    const w = new Float32Array([0]);
    const morphStep = params.has("morphStep");
    onBeforeRender(scene, () => {
      if (morphStep) {
        if (canvas.dataset.ready === "true") {
          if (t0 === 0) {
            t0 = performance.now();
          }
          w[0] = performance.now() - t0 >= 700 ? 1 : 0;
        } else {
          w[0] = 0;
        }
      } else {
        if (t0 === 0) {
          t0 = performance.now();
        }
        const t = (performance.now() - t0) / SCENE66_MORPH_PERIOD_MS;
        const s = Math.sin(t * Math.PI * 2);
        w[0] = s * s;
      }
      setMorphTargetWeights(engine, morph, w);
    });
  }
  if (noShadows) {
    await registerScene(scene);
  } else {
    await registerSceneWithShadowSupport(scene);
  }
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
