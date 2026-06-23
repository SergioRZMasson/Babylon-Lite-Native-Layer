// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene48.ts (esbuild, target es2017)
// Scene 48 — Physics Center of Mass — tags: physics, procedural, std
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene48-physics-center-of-mass.js

const PHYSICS_FPS = 60;
const FRICTION = 0.2;
const RESTITUTION = 0.3;
const KICK_DELAY_MS = 2e3;
const CAPTURE_STEPS_AFTER_KICK = 10;
const KICK_FORCE = { x: 0, y: 0, z: 400 };
const REST_Y = 2.05;
const BOXES = [
  { position: { x: 0, y: REST_Y, z: 0 }, centerOfMass: { x: 0, y: 0, z: 0 } },
  { position: { x: 4, y: REST_Y, z: 0 }, centerOfMass: { x: 0, y: 2, z: 0 } },
  { position: { x: 8, y: REST_Y, z: 0 }, centerOfMass: { x: 0, y: -2, z: 0 } }
];
function createMaterial(color, alpha = 1) {
  const material = createStandardMaterial();
  material.diffuseColor = color;
  material.specularColor = [0.08, 0.08, 0.08];
  material.alpha = alpha;
  return material;
}
function quatRotate(qx, qy, qz, qw, v) {
  const tx = 2 * (qy * v.z - qz * v.y);
  const ty = 2 * (qz * v.x - qx * v.z);
  const tz = 2 * (qx * v.y - qy * v.x);
  return {
    x: v.x + qw * tx + (qy * tz - qz * ty),
    y: v.y + qw * ty + (qz * tx - qx * tz),
    z: v.z + qw * tz + (qx * ty - qy * tx)
  };
}
async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const captureMode = new URLSearchParams(location.search).has("capture");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  scene.fixedDeltaMs = 1e3 / PHYSICS_FPS;
  scene.camera = createFreeCamera({ x: 4, y: 9, z: -22 }, { x: 4, y: 2, z: 2 });
  const hemi = createHemisphericLight([0, 1, 0]);
  hemi.intensity = 0.7;
  addToScene(scene, hemi);
  const dir = createDirectionalLight([0, -1, 1], 0.2);
  addToScene(scene, dir);
  const ground = createGround(engine, { width: 40, height: 40, subdivisions: 2 });
  ground.material = createMaterial([0.6, 0.6, 0.6]);
  addToScene(scene, ground);
  const hknp = await HavokPhysics({ locateFile: () => "/HavokPhysics.wasm" });
  const world = createHavokWorld(scene, hknp, { x: 0, y: -10, z: 0 });
  const groundBody = createPhysicsBody(world, ground, PhysicsMotionType.STATIC);
  const groundShape = createPhysicsShape(world, {
    type: PhysicsShapeType.BOX,
    parameters: { center: { x: 0, y: 0, z: 0 }, extents: { x: 40, y: 0.1, z: 40 } }
  });
  setPhysicsBodyShape(world, groundBody, groundShape);
  setPhysicsShapeMaterial(world, groundShape, FRICTION, RESTITUTION);
  const entries = BOXES.map((spec) => {
    const mesh = createBox(engine, 1);
    mesh.scaling.set(1, 4, 1);
    mesh.material = createMaterial([0.3, 0.5, 0.9], 0.8);
    mesh.position.set(spec.position.x, spec.position.y, spec.position.z);
    addToScene(scene, mesh);
    const body = createPhysicsBody(world, mesh, PhysicsMotionType.DYNAMIC, true);
    const shape = createPhysicsShape(world, {
      type: PhysicsShapeType.BOX,
      parameters: { center: { x: 0, y: 0, z: 0 }, extents: { x: 1, y: 4, z: 1 } }
    });
    setPhysicsBodyShape(world, body, shape);
    setPhysicsShapeMaterial(world, shape, FRICTION, RESTITUTION);
    setPhysicsBodyMassProperties(world, body, { mass: 1, centerOfMass: spec.centerOfMass });
    const comSphere = createSphere(engine, { diameter: 0.2, segments: 16 });
    comSphere.material = createMaterial([1, 0, 0]);
    comSphere.position.set(spec.position.x + spec.centerOfMass.x, spec.position.y + spec.centerOfMass.y, spec.position.z + spec.centerOfMass.z);
    addToScene(scene, comSphere);
    return { mesh, body, comSphere, com: spec.centerOfMass };
  });
  let simulatedFrames = 0;
  let kickPending = false;
  let kicked = false;
  let kickFrame = 0;
  let captureQueued = false;
  onBeforeRender(scene, () => {
    canvas.dataset.drawCalls = String(engine.drawCallCount);
  });
  onPhysicsAfterStep(world, () => {
    simulatedFrames++;
    if (kickPending && !kicked) {
      for (const entry of entries) {
        const p = entry.mesh.position;
        applyPhysicsBodyForce(world, entry.body, KICK_FORCE, { x: p.x, y: p.y, z: p.z });
      }
      kicked = true;
      kickFrame = simulatedFrames;
      kickPending = false;
    }
    for (const entry of entries) {
      const p = entry.mesh.position;
      const q = entry.mesh.rotationQuaternion;
      const r = quatRotate(q.x, q.y, q.z, q.w, entry.com);
      entry.comSphere.position.set(p.x + r.x, p.y + r.y, p.z + r.z);
    }
    if (kicked && !captureQueued && simulatedFrames >= kickFrame + CAPTURE_STEPS_AFTER_KICK) {
      captureQueued = true;
      window.setTimeout(() => {
        canvas.dataset.captureReady = "true";
        if (captureMode) {
          stopEngine(engine);
        }
      }, 0);
    }
  });
  await registerScene(scene);
  await startEngine(engine);
  window.setTimeout(() => {
    kickPending = true;
  }, KICK_DELAY_MS);
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
