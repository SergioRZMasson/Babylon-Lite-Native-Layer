// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene105.ts (esbuild, target es2017)
// Scene 105 — Character Controller + Moving Platform — tags: standard, gltf, physics, character-controller, lightmap
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene105-moving-platform.js

var __defProp = Object.defineProperty;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};

const PHYSICS_FPS = 60;
const LEVEL_URL = "https://raw.githubusercontent.com/CedricGuillemet/dump/master/CharController/levelTest.glb";
const LIGHTMAP_URL = "https://raw.githubusercontent.com/CedricGuillemet/dump/master/CharController/lightmap.jpg";
const CAPTURE_FRAMES = 105;
const CHARACTER_START = { x: 3, y: 0.3, z: -8 };
const CAPSULE_HEIGHT = 1.8;
const CAPSULE_RADIUS = 0.6;
const AUTOTEST_INPUT = { x: 0.57, y: -0.5, z: 2 };
const IDLE_INPUT = { x: 0, y: -0.5, z: 0 };
const CUBES = [
  { x: 5.1167, y: -0.2178, z: -8.9338 },
  { x: 5.1167, y: -0.2178, z: -10.194 },
  { x: 5.1167, y: 0.7922, z: -9.5777 },
  { x: 5.1167, y: -0.2178, z: -11.4473 },
  { x: 5.2025, y: 0.7852, z: -10.9095 },
  { x: 5.0466, y: 1.7915, z: -10.2446 }
];
const CUBE_COLOR = [0.45, 0.55, 0.85];
const PLATFORM_POS = { x: -4, y: 0, z: -12 };
const PLATFORM_SIZE = { w: 4, h: 0.2, d: 4 };
const PLATFORM_ROT_PER_STEP = 5e-3;
const PLATFORM_TIME_PER_STEP = 1 / PHYSICS_FPS;
const OBSTACLES = [
  { x: -1.02, y: -0.1, z: -11.41 },
  { x: -1.54, y: -0.1, z: -10.45 },
  { x: -2.1, y: -0.1, z: -11.4 }
];
function readCaptureFrames() {
  const params = new URLSearchParams(window.location.search);
  const value = params.get("captureFrame");
  if (value !== null) {
    const frame = Number(value);
    return Number.isFinite(frame) && frame >= 0 ? Math.round(frame) : CAPTURE_FRAMES;
  }
  return CAPTURE_FRAMES;
}
function updateCameraFollow(camera, target) {
  let fx = camera.target.x - camera.position.x;
  let fz = camera.target.z - camera.position.z;
  const flen = Math.hypot(fx, fz) || 1;
  fx /= flen;
  fz /= flen;
  camera.target.set(
    camera.target.x + (target.x - camera.target.x) * 0.1,
    camera.target.y + (target.y - camera.target.y) * 0.1,
    camera.target.z + (target.z - camera.target.z) * 0.1
  );
  const dist = Math.hypot(camera.position.x - target.x, camera.position.y - target.y, camera.position.z - target.z);
  const amount = (Math.min(dist - 6, 0) + Math.max(dist - 9, 0)) * 0.04;
  camera.position.set(camera.position.x + fx * amount, camera.position.y + (target.y + 2 - camera.position.y) * 0.04, camera.position.z + fz * amount);
}
function makeMaterial(color) {
  const mat = createStandardMaterial();
  mat.diffuseColor = color;
  mat.specularColor = [0.04, 0.04, 0.04];
  return mat;
}
function wireKeyboardInput(input) {
  window.addEventListener("keydown", (e) => {
    switch (e.key) {
      case "w":
      case "ArrowUp":
        input.z = 1;
        break;
      case "s":
      case "ArrowDown":
        input.z = -1;
        break;
      case "a":
      case "ArrowLeft":
        input.x = -1;
        break;
      case "d":
      case "ArrowRight":
        input.x = 1;
        break;
      case " ":
        input.y = 1;
        break;
    }
  });
  window.addEventListener("keyup", (e) => {
    switch (e.key) {
      case "w":
      case "s":
      case "ArrowUp":
      case "ArrowDown":
        input.z = 0;
        break;
      case "a":
      case "d":
      case "ArrowLeft":
      case "ArrowRight":
        input.x = 0;
        break;
      case " ":
        input.y = -0.5;
        break;
    }
  });
}
function isMeshNode(node) {
  return typeof node === "object" && node !== null && "_gpu" in node;
}
function hasChildren(node) {
  return typeof node === "object" && node !== null && "children" in node && Array.isArray(node.children);
}
function collectByOwner(node, ownerName, out) {
  var _a;
  for (const child of node.children) {
    if (isMeshNode(child)) {
      const list = (_a = out.get(ownerName)) != null ? _a : [];
      list.push(child);
      out.set(ownerName, list);
    }
    if (hasChildren(child)) {
      collectByOwner(child, isMeshNode(child) ? ownerName : child.name, out);
    }
  }
}
function buildOwnerMap(container) {
  const out = /* @__PURE__ */ new Map();
  for (const entity of container.entities) {
    if (hasChildren(entity)) {
      collectByOwner(entity, entity.name, out);
    }
  }
  return out;
}
function collectAllMeshes(node, out) {
  if (isMeshNode(node)) {
    out.push(node);
  }
  if (hasChildren(node)) {
    for (const child of node.children) {
      collectAllMeshes(child, out);
    }
  }
}
function buildLevelCollider(world, levelMeshes) {
  const flip = createTransformNode("levelFlip", 0, 0, 0, 0, 0, 0, 1, -1, 1, 1);
  for (const mesh of levelMeshes) {
    const clone = cloneTransformNode(mesh);
    clone.position.set(0, 0, 0);
    clone.scaling.set(1, 1, 1);
    clone.rotationQuaternion.set(0, 0, 0, 1);
    clone.parent = flip;
    flip.children.push(clone);
  }
  const shape = createPhysicsShape(world, { type: PhysicsShapeType.MESH, mesh: flip, includeChildMeshes: true });
  const body = createPhysicsBody(world, flip, PhysicsMotionType.STATIC);
  setPhysicsBodyShape(world, body, shape);
}
async function main() {
  var _a;
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  scene.fixedDeltaMs = 1e3 / PHYSICS_FPS;
  const autoTest = new URLSearchParams(window.location.search).has("captureFrame");
  const captureFrames = readCaptureFrames();
  const camera = createFreeCamera({ x: 5, y: 5, z: -5 }, CHARACTER_START);
  scene.camera = camera;
  const light = createHemisphericLight([0, 1, 0]);
  light.intensity = 0.7;
  addToScene(scene, light);
  const hknp = await HavokPhysics({ locateFile: () => "/HavokPhysics.wasm" });
  const world = createHavokWorld(scene, hknp, { x: 0, y: -9.8, z: 0 });
  const container = await loadGltf(engine, LEVEL_URL);
  const owners = buildOwnerMap(container);
  const levelMeshes = (_a = owners.get("level")) != null ? _a : [];
  const levelSet = new Set(levelMeshes);
  const lightmap = await loadTexture2D(engine, LIGHTMAP_URL);
  lightmap.uAng = Math.PI;
  const allMeshes = [];
  for (const entity of container.entities) {
    collectAllMeshes(entity, allMeshes);
  }
  for (const mesh of allMeshes) {
    const isLevel = levelSet.has(mesh);
    if (isLevel) {
      const pbr = mesh.material;
      const mat = createStandardMaterial();
      if (pbr.baseColorTexture) {
        mat.diffuseTexture = pbr.baseColorTexture;
      }
      mat.specularColor = [0, 0, 0];
      mat.lightmapTexture = lightmap;
      mat.useLightmapAsShadowmap = true;
      mat.lightmapLevel = 3.2;
      mat.lightmapCoordIndex = 1;
      mesh.material = mat;
    } else {
      mesh.material = makeMaterial(CUBE_COLOR);
      mesh.visible = false;
    }
  }
  addToScene(scene, container);
  buildLevelCollider(world, levelMeshes);
  const boxMass = 0.1;
  CUBES.forEach((p, i) => {
    const box = createBox(engine, 1);
    box.name = "cube" + i;
    box.position.set(p.x, p.y, p.z);
    box.material = makeMaterial(CUBE_COLOR);
    addToScene(scene, box);
    createPhysicsAggregate(world, box, PhysicsShapeType.BOX, { mass: boxMass });
  });
  OBSTACLES.forEach((p, i) => {
    const box = createBox(engine, 1);
    box.name = "obstacle" + i;
    box.position.set(p.x, p.y, p.z);
    box.material = makeMaterial(CUBE_COLOR);
    addToScene(scene, box);
    createPhysicsAggregate(world, box, PhysicsShapeType.BOX, { mass: boxMass });
  });
  const platform = createBox(engine, 1);
  platform.name = "movingPlatform";
  platform.scaling.set(PLATFORM_SIZE.w, PLATFORM_SIZE.h, PLATFORM_SIZE.d);
  platform.position.set(PLATFORM_POS.x, PLATFORM_POS.y, PLATFORM_POS.z);
  platform.material = makeMaterial(CUBE_COLOR);
  addToScene(scene, platform);
  const platformAgg = createPhysicsAggregate(world, platform, PhysicsShapeType.BOX, {
    mass: 0,
    extents: { x: PLATFORM_SIZE.w, y: PLATFORM_SIZE.h, z: PLATFORM_SIZE.d }
  });
  setPhysicsBodyMotionType(world, platformAgg.body, PhysicsMotionType.ANIMATED);
  if (!autoTest) {
    const fixedMesh = createBox(engine, 2);
    fixedMesh.position.set(19.0498, -0.4281, -11.6688);
    fixedMesh.rotationQuaternion.set(0, 0, -0.70710678, 0.70710678);
    fixedMesh.scaling.set(0.2782, 0.0667, 0.6894);
    fixedMesh.material = makeMaterial(CUBE_COLOR);
    addToScene(scene, fixedMesh);
    const fixed = createPhysicsAggregate(world, fixedMesh, PhysicsShapeType.BOX, {
      mass: 0,
      extents: { x: 2 * 0.2782, y: 2 * 0.0667, z: 2 * 0.6894 }
    });
    const planeMesh = createBox(engine, 2);
    planeMesh.position.set(19.045139, 0.071943, -11.6688);
    planeMesh.rotationQuaternion.set(0.713661, 0.700491, 0, 0);
    planeMesh.scaling.set(0.03, 3, 1);
    planeMesh.material = makeMaterial(CUBE_COLOR);
    addToScene(scene, planeMesh);
    const plane = createPhysicsAggregate(world, planeMesh, PhysicsShapeType.BOX, {
      mass: 0.1,
      extents: { x: 2 * 0.03, y: 2 * 3, z: 2 * 1 }
    });
    createPhysicsConstraint(world, fixed.body, plane.body, PhysicsConstraintType.HINGE, {
      // Pivots have their X negated vs the playground because the bodies live in the -X
      // reflected world (anchors then coincide as in PG #WO0H1U#165). Axes have X=0 so are unchanged.
      pivotA: { x: -0.75, y: 0, z: 0 },
      pivotB: { x: 0.25, y: 0, z: 0 },
      axisA: { x: 0, y: 0, z: -1 },
      axisB: { x: 0, y: 0, z: 1 }
    });
  }
  const displayCapsule = createCapsule(engine, { height: CAPSULE_HEIGHT, radius: CAPSULE_RADIUS });
  displayCapsule.material = makeMaterial([0.85, 0.55, 0.2]);
  displayCapsule.position.set(CHARACTER_START.x, CHARACTER_START.y, CHARACTER_START.z);
  addToScene(scene, displayCapsule);
  const character = createPhysicsCharacterController(world, CHARACTER_START, { capsuleHeight: CAPSULE_HEIGHT, capsuleRadius: CAPSULE_RADIUS });
  const collisions = [];
  character.onTriggerCollisionObservable.add((event) => {
    const pos = event.impulsePosition;
    console.log(`Character collision : ${event.collider.node.name} at (${pos.x}, ${pos.y}, ${pos.z})`);
    if (autoTest) {
      collisions.push({ collider: event.collider.node.name, impulsePosition: { x: round(pos.x), y: round(pos.y), z: round(pos.z) } });
    }
  });
  const inputDirection = autoTest ? __spreadValues({}, AUTOTEST_INPUT) : __spreadValues({}, IDLE_INPUT);
  if (!autoTest) {
    wireKeyboardInput(inputDirection);
  }
  let steps = 0;
  let captureQueued = false;
  let platformTime = 0;
  let platformAngle = 0;
  onPhysicsAfterStep(world, (dt) => {
    platformAngle += PLATFORM_ROT_PER_STEP;
    platformTime += PLATFORM_TIME_PER_STEP;
    const half = platformAngle * 0.5;
    platform.rotationQuaternion.set(0, Math.sin(half), 0, Math.cos(half));
    platform.position.set(PLATFORM_POS.x, Math.sin(platformTime) * 2 + 1.2, PLATFORM_POS.z);
    const yaw = Math.atan2(camera.target.x - camera.position.x, camera.target.z - camera.position.z);
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    const s = dt * 2;
    const displacement = {
      x: (inputDirection.x * cos + inputDirection.z * sin) * s,
      y: inputDirection.y * s,
      z: (-inputDirection.x * sin + inputDirection.z * cos) * s
    };
    character.moveWithCollisions(displacement);
    const p = character.getPosition();
    displayCapsule.position.set(p.x, p.y, p.z);
    updateCameraFollow(camera, p);
    if (!autoTest) {
      return;
    }
    steps++;
    if (!captureQueued && steps >= captureFrames) {
      captureQueued = true;
      window.setTimeout(() => {
        canvas.dataset.charPos = JSON.stringify({ x: round(p.x), y: round(p.y), z: round(p.z) });
        canvas.dataset.collisions = JSON.stringify(collisions);
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
function round(value) {
  return Math.round(value * 1e3) / 1e3;
}
main().catch((err) => {
  const canvas = document.getElementById("renderCanvas");
  if (canvas) {
    canvas.dataset.error = err instanceof Error ? err.message : String(err);
  }
  console.error(err);
});
