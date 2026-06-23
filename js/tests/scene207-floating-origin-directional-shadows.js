// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene207.ts (esbuild, target es2017)
// Scene 207 - LWR Directional Shadows — tags: hpm, lwr, floating-origin, shadow, procedural, std
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene207-floating-origin-directional-shadows.js

const OFFSET = 5e6;
async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas, { useHighPrecisionMatrix: true, useFloatingOrigin: true });
  const scene = createSceneContext(engine);
  scene.clearColor = { r: 0.05, g: 0.05, b: 0.08, a: 1 };
  const cam = createArcRotateCamera(1, 0.62, 15, { x: OFFSET, y: 1, z: OFFSET });
  cam.nearPlane = 0.5;
  cam.farPlane = 500;
  scene.camera = cam;
  const hemi = createHemisphericLight([0, 1, 0], 0.2);
  addToScene(scene, hemi);
  const light = createDirectionalLight([-1, -2, -1], 0.9);
  light.position.set(OFFSET + 20, 40, OFFSET + 20);
  light.diffuse = [1, 0.97, 0.9];
  addToScene(scene, light);
  const sphere = createSphere(engine, { diameter: 3, segments: 32 });
  const sphereMat = createStandardMaterial();
  sphereMat.diffuseColor = [0.8, 0.8, 0.85];
  sphereMat.specularColor = [0.4, 0.4, 0.4];
  sphere.material = sphereMat;
  sphere.position.set(OFFSET, 2, OFFSET);
  addToScene(scene, sphere);
  const casters = [sphere];
  const boxPositions = [
    [-5, -4],
    [5, 4],
    [-4, 5]
  ];
  for (let i = 0; i < boxPositions.length; i++) {
    const [dx, dz] = boxPositions[i];
    const box = createBox(engine, 2);
    const boxMat = createStandardMaterial();
    boxMat.diffuseColor = [0.35 + i * 0.2, 0.45, 0.7 - i * 0.15];
    boxMat.specularColor = [0.3, 0.3, 0.3];
    box.material = boxMat;
    box.position.set(OFFSET + dx, 1, OFFSET + dz);
    addToScene(scene, box);
    casters.push(box);
  }
  const ground = createGround(engine, { width: 100, height: 100, subdivisions: 1 });
  const groundMat = createStandardMaterial();
  groundMat.diffuseColor = [0.45, 0.45, 0.5];
  groundMat.specularColor = [0, 0, 0];
  ground.material = groundMat;
  ground.position.set(OFFSET, 0, OFFSET);
  ground.receiveShadows = true;
  addToScene(scene, ground);
  const sg = createPcfDirectionalShadowGenerator(engine, light, {
    mapSize: 1024,
    orthoMinZ: 1,
    orthoMaxZ: 200
  });
  setShadowTaskCasterMeshes(sg, casters);
  light.shadowGenerator = sg;
  await registerSceneWithShadowSupport(scene);
  await startEngine(engine);
  canvas.dataset.drawCalls = String(engine.drawCallCount);
  canvas.dataset.initMs = String(performance.now() - __initStart);
  canvas.dataset.useHighPrecisionMatrix = String(engine.useHighPrecisionMatrix);
  canvas.dataset.useFloatingOrigin = "true";
  canvas.dataset.offset = String(OFFSET);
  canvas.dataset.ready = "true";
}
main().catch((err) => {
  console.error(err);
});
