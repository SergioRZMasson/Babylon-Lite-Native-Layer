// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene40.ts (esbuild, target es2017)
// Scene 40 — Physics — tags: std, procedural, physics
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene40-physics.js

const PHYSICS_FPS = 60;
function readCaptureAfterFrames() {
  const params = new URLSearchParams(window.location.search);
  const frameValue = params.get("captureFrame");
  if (frameValue !== null) {
    const frame = Number(frameValue);
    return Number.isFinite(frame) && frame >= 0 ? Math.round(frame) : null;
  }
  const value = params.get("captureAfter");
  if (value === null) {
    return null;
  }
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? Math.round(seconds * PHYSICS_FPS) : null;
}
async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  scene.fixedDeltaMs = 1e3 / PHYSICS_FPS;
  const captureAfterFrames = readCaptureAfterFrames();
  scene.camera = createFreeCamera({ x: 0, y: 5, z: -10 }, { x: 0, y: 0, z: 0 });
  const light = createHemisphericLight([0, 1, 0]);
  light.intensity = 0.7;
  addToScene(scene, light);
  const sphere = createSphere(engine, { diameter: 2, segments: 32 });
  sphere.material = createStandardMaterial();
  sphere.position.set(0, 4, 0);
  addToScene(scene, sphere);
  const ground = createGround(engine, { width: 10, height: 10 });
  ground.material = createStandardMaterial();
  addToScene(scene, ground);
  onBeforeRender(scene, () => {
    canvas.dataset.drawCalls = String(engine.drawCallCount);
  });
  let simulatedFrames = 0;
  let captureQueued = false;
  const hknp = await HavokPhysics({ locateFile: () => "/HavokPhysics.wasm" });
  const world = createHavokWorld(scene, hknp, { x: 0, y: -9.8, z: 0 });
  onPhysicsAfterStep(world, () => {
    simulatedFrames++;
    if (captureAfterFrames !== null && !captureQueued && simulatedFrames >= captureAfterFrames) {
      captureQueued = true;
      window.setTimeout(() => {
        canvas.dataset.captureReady = "true";
        stopEngine(engine);
      }, 0);
    }
  });
  createPhysicsAggregate(world, sphere, PhysicsShapeType.SPHERE, {
    mass: 1,
    restitution: 0.75
  });
  createPhysicsAggregate(world, ground, PhysicsShapeType.BOX, {
    mass: 0
  });
  await registerScene(scene);
  await startEngine(engine);
  canvas.dataset.initMs = String(performance.now() - __initStart);
  canvas.dataset.ready = "true";
}
main().catch((err) => {
  const canvas = document.getElementById("renderCanvas");
  if (canvas) {
    canvas.dataset.error = err instanceof Error ? err.message : String(err);
  }
  console.error(err);
});
