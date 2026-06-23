// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene106.ts (esbuild, target es2017)
// Scene 106 — Prestep × Motion Types — tags: physics, prestep, motion-types, havok
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene106-prestep-motion-types.js

const PHYSICS_FPS = 60;
const PALETTE = [
  [0.85, 0.25, 0.25],
  // TELEPORT · STATIC
  [0.25, 0.75, 0.3],
  // TELEPORT · ANIMATED
  [0.25, 0.45, 0.85],
  // TELEPORT · DYNAMIC
  [0.9, 0.8, 0.25],
  // ACTION · STATIC
  [0.8, 0.3, 0.8],
  // ACTION · ANIMATED
  [0.25, 0.8, 0.8]
  // ACTION · DYNAMIC
];
const T_PER_STEP = 1e3 / PHYSICS_FPS / 300;
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
  scene.camera = createFreeCamera({ x: -24, y: 30, z: 5 }, { x: 12, y: 0, z: 5 });
  const light = createHemisphericLight([0, 1, 0]);
  light.intensity = 0.7;
  addToScene(scene, light);
  onBeforeRender(scene, () => {
    canvas.dataset.drawCalls = String(engine.drawCallCount);
  });
  let simulatedFrames = 0;
  let captureQueued = false;
  const hknp = await HavokPhysics({ locateFile: () => "/HavokPhysics.wasm" });
  const world = createHavokWorld(scene, hknp, { x: 0, y: -9.8, z: 0 });
  const motions = [PhysicsMotionType.STATIC, PhysicsMotionType.ANIMATED, PhysicsMotionType.DYNAMIC];
  const presteps = [PhysicsPrestepType.TELEPORT, PhysicsPrestepType.ACTION];
  const boxes = [];
  for (let prestep = 0; prestep < 2; prestep++) {
    for (let motion = 0; motion < 3; motion++) {
      const cylinder = createCylinder(engine, { diameter: 2, height: 2 });
      cylinder.position.set(motion * 12, 2, prestep * 12);
      const cylMat = createStandardMaterial();
      cylMat.diffuseColor = PALETTE[prestep * 3 + motion];
      cylinder.material = cylMat;
      addToScene(scene, cylinder);
      createPhysicsAggregate(world, cylinder, PhysicsShapeType.CYLINDER, {
        mass: 1,
        restitution: 0.1,
        friction: 1,
        radius: 1,
        pointA: { x: 0, y: -1, z: 0 },
        pointB: { x: 0, y: 1, z: 0 }
      });
      const box = createBox(engine, 1);
      box.scaling.set(10, 1, 10);
      box.position.set(motion * 12, 0, prestep * 12);
      box.material = createStandardMaterial();
      addToScene(scene, box);
      const boxAggregate = createPhysicsAggregate(world, box, PhysicsShapeType.BOX, {
        mass: motion,
        friction: 1,
        extents: { x: 10, y: 1, z: 10 }
      });
      setPhysicsBodyMotionType(world, boxAggregate.body, motions[motion]);
      setPhysicsBodyPrestepType(boxAggregate.body, presteps[prestep]);
      setPhysicsBodyPreStep(boxAggregate.body, true);
      boxes.push(box);
    }
  }
  let t = 0;
  onPhysicsAfterStep(world, () => {
    const c = Math.cos(t) * 0.03;
    const s = Math.sin(t) * 0.03;
    for (let i = 0; i < boxes.length; i++) {
      const p = boxes[i].position;
      p.set(p.x + c, 0, p.z + s);
    }
    t += T_PER_STEP;
    simulatedFrames++;
    if (captureAfterFrames !== null && !captureQueued && simulatedFrames >= captureAfterFrames) {
      captureQueued = true;
      window.setTimeout(() => {
        canvas.dataset.captureReady = "true";
        stopEngine(engine);
      }, 0);
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
