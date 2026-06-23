// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene65.ts (esbuild, target es2017)
// Scene 65 — NME Shadow Receive — tags: nme, procedural, shadows
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene65-nme-shadow.js

async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  scene.clearColor = { r: 0, g: 0, b: 0, a: 1 };
  scene.camera = createArcRotateCamera(-Math.PI / 2.3, Math.PI / 2.5, 8, { x: 0, y: 1, z: 0 });
  scene.camera.nearPlane = 1;
  scene.camera.farPlane = 1e3;
  attachControl(scene.camera, canvas, scene);
  const light = createDirectionalLight([-1, -2, -1], 1);
  light.position.set(5, 10, 5);
  addToScene(scene, light);
  const sphere = createSphere(engine);
  sphere.position.set(0, 1.5, 0);
  const ground = createGround(engine, { width: 10, height: 10, subdivisions: 2 });
  ground.receiveShadows = true;
  light.shadowGenerator = createEsmDirectionalShadowGenerator(engine, light, {
    mapSize: 1024,
    depthScale: 50,
    bias: 5e-5,
    blurKernel: 64,
    blurScale: 2,
    darkness: 0,
    frustumEdgeFalloff: 0,
    orthoMinZ: scene.camera.nearPlane,
    orthoMaxZ: scene.camera.farPlane
  });
  setShadowTaskCasterMeshes(light.shadowGenerator, [sphere]);
  const material = await parseNodeMaterialFromSnippet(engine, "", {
    json: SCENE65_NME_JSON,
    shadowGenerators: [light.shadowGenerator]
  });
  sphere.material = material;
  ground.material = material;
  addToScene(scene, sphere);
  addToScene(scene, ground);
  await registerSceneWithShadowSupport(scene);
  await startEngine(engine);
  canvas.dataset.drawCalls = String(engine.drawCallCount);
  canvas.dataset.initMs = String(performance.now() - __initStart);
  canvas.dataset.ready = "true";
}
main().catch(console.error);
