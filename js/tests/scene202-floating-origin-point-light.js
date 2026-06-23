// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene202.ts (esbuild, target es2017)
// Scene 202 - LWR Point Light — tags: hpm, lwr, floating-origin, point-light, procedural, std
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene202-floating-origin-point-light.js

const OFFSET = 5e6;
async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas, { useHighPrecisionMatrix: true, useFloatingOrigin: true });
  const scene = createSceneContext(engine);
  scene.clearColor = { r: 0.05, g: 0.05, b: 0.08, a: 1 };
  const cam = createArcRotateCamera(Math.PI / 4, Math.PI / 3, 14, { x: OFFSET, y: 1, z: OFFSET });
  cam.nearPlane = 0.5;
  cam.farPlane = 500;
  scene.camera = cam;
  const hemi = createHemisphericLight([0, 1, 0], 0.15);
  addToScene(scene, hemi);
  const point = createPointLight([OFFSET + 4, 6, OFFSET - 2], 1);
  point.diffuse = [1, 0.95, 0.8];
  point.specular = [1, 1, 1];
  point.range = 100;
  addToScene(scene, point);
  const ground = createGround(engine, { width: 40, height: 40, subdivisions: 1 });
  const groundMat = createStandardMaterial();
  groundMat.diffuseColor = [0.3, 0.3, 0.34];
  groundMat.specularColor = [0.2, 0.2, 0.2];
  ground.material = groundMat;
  ground.position.set(OFFSET, 0, OFFSET);
  addToScene(scene, ground);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const box = createBox(engine, 1);
      const boxMat = createStandardMaterial();
      boxMat.diffuseColor = [0.35 + i / 2 * 0.5, 0.4, 0.35 + j / 2 * 0.5];
      boxMat.specularColor = [0.5, 0.5, 0.5];
      box.material = boxMat;
      box.position.set(OFFSET + (i - 1) * 5, 1, OFFSET + (j - 1) * 5);
      addToScene(scene, box);
    }
  }
  const sphere = createSphere(engine, { diameter: 3, segments: 32 });
  const sphereMat = createStandardMaterial();
  sphereMat.diffuseColor = [0.8, 0.8, 0.85];
  sphereMat.specularColor = [0.9, 0.9, 0.9];
  sphere.material = sphereMat;
  sphere.position.set(OFFSET, 2.5, OFFSET);
  addToScene(scene, sphere);
  await registerScene(scene);
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
