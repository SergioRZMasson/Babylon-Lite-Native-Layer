// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene102.ts (esbuild, target es2017)
// Scene 102 — Physics Raycast Filtering — tags: std, procedural, physics
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene102-physics-raycast.js

const PHYSICS_FPS = 60;
const CAPTURE_DEFAULT_FRAME = 5;
const COLLIDE_WITH = 2;
const RAY_ORIGIN = { x: 0, y: 1, z: -2 };
const RAY_DIR = { x: 0.1, y: 0, z: 1 };
const RAY_LEN = 8;
const RAY_DEST = { x: RAY_ORIGIN.x + RAY_DIR.x * RAY_LEN, y: RAY_ORIGIN.y + RAY_DIR.y * RAY_LEN, z: RAY_ORIGIN.z + RAY_DIR.z * RAY_LEN };
function readCaptureFrame() {
  const params = new URLSearchParams(window.location.search);
  const frameValue = params.get("captureFrame");
  if (frameValue !== null) {
    const frame = Number(frameValue);
    return Number.isFinite(frame) && frame >= 0 ? Math.round(frame) : CAPTURE_DEFAULT_FRAME;
  }
  return CAPTURE_DEFAULT_FRAME;
}
function makeMaterial(color) {
  const material = createStandardMaterial();
  material.diffuseColor = color;
  material.specularColor = [0, 0, 0];
  return material;
}
function makeSphere(engine, scene, position, color) {
  const sphere = createSphere(engine, { diameter: 0.2, segments: 32 });
  sphere.material = makeMaterial(color);
  sphere.position.set(position.x, position.y, position.z);
  addToScene(scene, sphere);
  return sphere;
}
function addFilteredMeshBox(engine, scene, world, z, color, membership) {
  const box = createBox(engine, 2);
  box.material = makeMaterial(color);
  box.position.set(0, 1, z);
  addToScene(scene, box);
  const shape = createPhysicsShape(world, { type: PhysicsShapeType.MESH, mesh: box });
  setPhysicsShapeFilterMembershipMask(world, shape, membership);
  const body = createPhysicsBody(world, box, PhysicsMotionType.STATIC);
  setPhysicsBodyShape(world, body, shape);
}
async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  scene.fixedDeltaMs = 1e3 / PHYSICS_FPS;
  const captureFrame = readCaptureFrame();
  scene.camera = createArcRotateCamera(-0.5, Math.PI / 3, 20, { x: 0, y: 0, z: 0 });
  const light = createHemisphericLight([0, 1, 0]);
  addToScene(scene, light);
  const hknp = await HavokPhysics({ locateFile: () => "/HavokPhysics.wasm" });
  const world = createHavokWorld(scene, hknp, { x: 0, y: -10, z: 0 });
  addFilteredMeshBox(engine, scene, world, 1, [0.38, 0.75, 0.91], 1);
  addFilteredMeshBox(engine, scene, world, 4, [0.38, 0.91, 0.46], 2);
  const ground = createGround(engine, { width: 10, height: 10 });
  ground.material = makeMaterial([0.2, 0.2, 0.2]);
  addToScene(scene, ground);
  createPhysicsAggregate(world, ground, PhysicsShapeType.BOX, { mass: 0 });
  const rayTube = createTube(engine, { path: [RAY_ORIGIN, RAY_DEST], radius: 0.03, tessellation: 8 });
  const rayMat = makeMaterial([1, 1, 0]);
  rayMat.disableLighting = true;
  rayMat.emissiveColor = [1, 1, 0];
  rayTube.material = rayMat;
  addToScene(scene, rayTube);
  makeSphere(engine, scene, RAY_ORIGIN, [0, 1, 0]);
  makeSphere(engine, scene, RAY_DEST, [1, 0, 0]);
  const hitMarker = makeSphere(engine, scene, RAY_ORIGIN, [1, 1, 0]);
  hitMarker.visible = false;
  let steps = 0;
  let raycastDone = false;
  let captureQueued = false;
  onBeforeRender(scene, () => {
    canvas.dataset.drawCalls = String(engine.drawCallCount);
  });
  onPhysicsAfterStep(world, () => {
    steps++;
    if (!raycastDone) {
      raycastDone = true;
      const result = physicsRaycast(world, RAY_ORIGIN, RAY_DEST, { collideWith: COLLIDE_WITH });
      console.log("scene102 raycast", {
        collideWith: COLLIDE_WITH,
        hasHit: result.hasHit,
        hitPoint: result.hitPoint,
        hitDistance: result.hitDistance,
        triangleIndex: result.triangleIndex
      });
      if (result.hasHit) {
        hitMarker.position.set(result.hitPoint.x, result.hitPoint.y, result.hitPoint.z);
        hitMarker.visible = true;
      }
      canvas.dataset.rayResult = JSON.stringify({
        hasHit: result.hasHit,
        hitPoint: { x: round(result.hitPoint.x), y: round(result.hitPoint.y), z: round(result.hitPoint.z) },
        hitDistance: round(result.hitDistance),
        triangleIndex: result.triangleIndex
      });
    }
    if (!captureQueued && steps >= captureFrame) {
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
function round(v) {
  return Math.round(v * 1e3) / 1e3;
}
main().catch((err) => {
  const canvas = document.getElementById("renderCanvas");
  if (canvas) {
    canvas.dataset.error = err instanceof Error ? err.message : String(err);
  }
  console.error(err);
});
