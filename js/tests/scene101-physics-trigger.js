// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene101.ts (esbuild, target es2017)
// Scene 101 — Physics Trigger Volume — tags: std, procedural, physics
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene101-physics-trigger.js

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
  const ground = createGround(engine, { width: 6, height: 6 });
  ground.material = createStandardMaterial();
  addToScene(scene, ground);
  const triggerVisual = createSphere(engine, { diameter: 4, segments: 32 });
  const triggerMaterial = createStandardMaterial();
  triggerMaterial.diffuseColor = [1, 0, 0];
  triggerMaterial.alpha = 0.7;
  triggerVisual.material = triggerMaterial;
  addToScene(scene, triggerVisual);
  onBeforeRender(scene, () => {
    canvas.dataset.drawCalls = String(engine.drawCallCount);
  });
  let simulatedFrames = 0;
  let captureQueued = false;
  const hknp = await HavokPhysics({ locateFile: () => "/HavokPhysics.wasm" });
  const world = createHavokWorld(scene, hknp);
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
  createPhysicsAggregate(world, sphere, PhysicsShapeType.SPHERE, { mass: 1 });
  createPhysicsAggregate(world, ground, PhysicsShapeType.BOX, { mass: 0, restitution: 1 });
  const triggerShape = createPhysicsShape(world, { type: PhysicsShapeType.SPHERE, parameters: { center: { x: 0, y: 0, z: 0 }, radius: 2 } });
  setPhysicsShapeIsTrigger(world, triggerShape, true);
  const triggerNode = createTransformNode("trigger", 0, 0, 0);
  const triggerBody = createPhysicsBody(world, triggerNode, PhysicsMotionType.STATIC);
  setPhysicsBodyShape(world, triggerBody, triggerShape);
  onPhysicsTrigger(world, (info) => {
    console.log("scene101 trigger", info.type);
    if (info.type === "ENTERED") {
      canvas.dataset.entered = "true";
    }
    if (info.type === "EXITED") {
      canvas.dataset.exited = "true";
    }
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
