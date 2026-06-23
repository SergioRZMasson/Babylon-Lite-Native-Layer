// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene64.ts (esbuild, target es2017)
// Scene 64 — NME Morph Targets — tags: nme, procedural
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene64-nme-morph.js

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
  const material = await parseNodeMaterialFromSnippet(engine, "", { json: SCENE64_NME_JSON });
  const sphereData = createSphereData();
  const vertexCount = sphereData.vertexCount;
  const deltas = new Float32Array(vertexCount * 3);
  for (let i = 0; i < vertexCount; i++) {
    deltas[i * 3 + 1] = SCENE64_MORPH_DELTA_Y;
  }
  const sphere = createSphere(engine);
  const freeze = new URLSearchParams(location.search).has("freeze");
  const morph = createMorphTargets(engine, [{ positions: deltas, normals: null }], vertexCount, [freeze ? 1 : 0]);
  sphere.morphTargets = morph;
  sphere.material = material;
  addToScene(scene, sphere);
  if (!freeze) {
    const t0 = performance.now();
    const weightBuf = new Float32Array([0]);
    onBeforeRender(scene, () => {
      const t = (performance.now() - t0) / SCENE64_MORPH_PERIOD_MS;
      weightBuf[0] = 0.5 - 0.5 * Math.cos(t * Math.PI * 2);
      setMorphTargetWeights(engine, morph, weightBuf);
    });
  }
  await registerScene(scene);
  await startEngine(engine);
  canvas.dataset.drawCalls = String(engine.drawCallCount);
  canvas.dataset.initMs = String(performance.now() - __initStart);
  canvas.dataset.ready = "true";
}
main().catch(console.error);
