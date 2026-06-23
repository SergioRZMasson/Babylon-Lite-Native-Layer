// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene209.ts (esbuild, target es2017)
// Scene 209 — LWR Physics — tags: hpm, lwr, floating-origin, physics, procedural
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene209-floating-origin-physics.js

const OFFSET = 5e6;
async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas, { useHighPrecisionMatrix: true, useFloatingOrigin: true });
  const scene = createSceneContext(engine);
  scene.camera = createFreeCamera({ x: OFFSET, y: 5, z: OFFSET - 10 }, { x: OFFSET, y: 0, z: OFFSET });
  const light = createHemisphericLight([0, 1, 0]);
  light.intensity = 0.7;
  addToScene(scene, light);
  const sphere = createSphere(engine, { diameter: 2, segments: 32 });
  sphere.material = createStandardMaterial();
  sphere.position.set(OFFSET, 4, OFFSET);
  addToScene(scene, sphere);
  const ground = createGround(engine, { width: 10, height: 10 });
  ground.material = createStandardMaterial();
  ground.position.set(OFFSET, 0, OFFSET);
  addToScene(scene, ground);
  const hknp = await HavokPhysics({ locateFile: () => "/HavokPhysics.wasm" });
  const world = createHavokWorld(scene, hknp, { x: 0, y: -9.8, z: 0 });
  await enableHavokFloatingOrigin(world);
  createPhysicsAggregate(world, sphere, PhysicsShapeType.SPHERE, {
    mass: 1,
    restitution: 0.75
  });
  createPhysicsAggregate(world, ground, PhysicsShapeType.BOX, {
    mass: 0
  });
  let settleFrames = 0;
  onBeforeRender(scene, () => {
    canvas.dataset.drawCalls = String(engine.drawCallCount);
    const y = sphere.position.y;
    if (Math.abs(y - 1) < 0.05) {
      settleFrames++;
      if (settleFrames > 30) {
        canvas.dataset.initMs = String(performance.now() - __initStart);
        canvas.dataset.useHighPrecisionMatrix = String(engine.useHighPrecisionMatrix);
        canvas.dataset.useFloatingOrigin = "true";
        canvas.dataset.offset = String(OFFSET);
        canvas.dataset.ready = "true";
      }
    } else {
      settleFrames = 0;
    }
  });
  await registerScene(scene);
  await startEngine(engine);
}
main().catch((err) => {
  console.error(err);
});
