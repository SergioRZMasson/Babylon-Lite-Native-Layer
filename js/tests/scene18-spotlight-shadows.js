// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene18.ts (esbuild, target es2017)
// Scene 18 — PCF Shadows — tags: std, procedural, shadow
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene18-spotlight-shadows.js

async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  const cam = createFreeCamera({ x: 0, y: 10, z: -20 }, { x: 0, y: 0, z: 0 });
  cam.nearPlane = 1;
  cam.farPlane = 1e4;
  scene.camera = cam;
  attachFreeControl(cam, canvas, scene);
  const ground = createGround(engine, { width: 24, height: 60 });
  const groundMat = createStandardMaterial();
  groundMat.diffuseTexture = await loadTexture2D(engine, "https://playground.babylonjs.com/textures/ground.jpg");
  groundMat.specularColor = [0, 0, 0];
  groundMat.emissiveColor = [0.2, 0.2, 0.2];
  ground.material = groundMat;
  ground.receiveShadows = true;
  addToScene(scene, ground);
  const box = createBox(engine, 5);
  box.position.set(0, 5, 0);
  const boxMat = createStandardMaterial();
  boxMat.diffuseColor = [1, 0, 0];
  boxMat.specularColor = [0.5, 0, 0];
  box.material = boxMat;
  addToScene(scene, box);
  const light = createSpotLight([0, 20, -10], [0, -1, 0.3], 1.2, 24);
  addToScene(scene, light);
  light.shadowGenerator = createPcfSpotlightShadowGenerator(engine, light, {
    mapSize: 512,
    near: cam.nearPlane,
    far: cam.farPlane
  });
  setShadowTaskCasterMeshes(light.shadowGenerator, [box]);
  await registerSceneWithShadowSupport(scene);
  await startEngine(engine);
  canvas.dataset.drawCalls = String(engine.drawCallCount);
  canvas.dataset.initMs = String(performance.now() - __initStart);
  canvas.dataset.ready = "true";
}
main().catch(console.error);
