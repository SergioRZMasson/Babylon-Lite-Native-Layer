// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene49.ts (esbuild, target es2017)
// Scene 49 — Physics Shape Queries — tags: physics, procedural, std
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene49-physics-shape-queries.js

const CAPTURE_STEPS = 5;
const GROUP_Y = 2.5;
const CAM_DIR = { x: 0, y: 0.5, z: -0.866 };
const PROX_NUDGE = 0.08;
const CAST_NUDGE = 0.2;
function nudged(p, amount) {
  return [p.x + CAM_DIR.x * amount, p.y + CAM_DIR.y * amount, p.z + CAM_DIR.z * amount];
}
function makeMaterial(color, emissive) {
  const material = createStandardMaterial();
  material.diffuseColor = color;
  material.specularColor = [0.08, 0.08, 0.08];
  if (emissive) {
    material.emissiveColor = emissive;
  }
  return material;
}
function makeIndicator(mesh, color) {
  mesh.material = makeMaterial([0, 0, 0], color);
}
async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const captureMode = new URLSearchParams(location.search).has("capture");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  const camera = createArcRotateCamera(-Math.PI / 2, Math.PI / 3, 14, { x: 1.2, y: 0, z: 0 });
  scene.camera = camera;
  attachControl(camera, canvas, scene, {
    shouldHandlePointerDown: () => !isGizmoInteracting(canvas),
    isExternalDragActive: () => isGizmoDragging(canvas),
    isExternalPickPending: () => isGizmoPickPending(canvas)
  });
  const hemi = createHemisphericLight([0, 1, 0]);
  hemi.intensity = 0.7;
  addToScene(scene, hemi);
  const hknp = await HavokPhysics({ locateFile: () => "/HavokPhysics.wasm" });
  const world = createHavokWorld(scene, hknp);
  function buildGroup(yOffset) {
    const cylinder = createCylinder(engine, { height: 2, diameter: 1 });
    cylinder.material = makeMaterial([0.85, 0.8, 0.1]);
    cylinder.position.set(-1, yOffset, 0);
    addToScene(scene, cylinder);
    const cylinderShape = createPhysicsShape(world, {
      type: PhysicsShapeType.CYLINDER,
      parameters: { pointA: { x: 0, y: -1, z: 0 }, pointB: { x: 0, y: 1, z: 0 }, radius: 0.5 }
    });
    const capsule = createCapsule(engine, { height: 2, radius: 0.5 });
    capsule.material = makeMaterial([0.2, 0.4, 0.9]);
    capsule.position.set(1, yOffset, 0);
    addToScene(scene, capsule);
    const body = createPhysicsBody(world, capsule, PhysicsMotionType.ANIMATED);
    const capsuleShape = createPhysicsShape(world, {
      type: PhysicsShapeType.CAPSULE,
      parameters: { pointA: { x: 0, y: -0.5, z: 0 }, pointB: { x: 0, y: 0.5, z: 0 }, radius: 0.5 }
    });
    setPhysicsBodyShape(world, body, capsuleShape);
    setPhysicsBodyPreStep(body, true);
    return { cylinder, cylinderShape, capsulePos: { x: 1, y: yOffset, z: 0 } };
  }
  const groupA = buildGroup(GROUP_Y);
  const proxOnCylinder = createSphere(engine, { diameter: 0.15, segments: 16 });
  makeIndicator(proxOnCylinder, [1, 0.5, 0]);
  proxOnCylinder.parent = groupA.cylinder;
  groupA.cylinder.children.push(proxOnCylinder);
  addToScene(scene, proxOnCylinder);
  const proxOnCapsule = createSphere(engine, { diameter: 0.15, segments: 16 });
  makeIndicator(proxOnCapsule, [1, 0, 0]);
  addToScene(scene, proxOnCapsule);
  const groupB = buildGroup(-GROUP_Y);
  const castStart = { x: -1, y: -GROUP_Y, z: 0 };
  const castEnd = { x: 4, y: -GROUP_Y, z: 0 };
  const rayTube = createTube(engine, { path: [castStart, castEnd], radius: 0.02, tessellation: 8 });
  rayTube.material = makeMaterial([0, 0, 0], [0.2, 0.8, 1]);
  addToScene(scene, rayTube);
  const castHit = createSphere(engine, { diameter: 0.15, segments: 16 });
  makeIndicator(castHit, [0, 1, 0]);
  addToScene(scene, castHit);
  let steps = 0;
  let captureQueued = false;
  onPhysicsAfterStep(world, () => {
    canvas.dataset.drawCalls = String(engine.drawCallCount);
    steps++;
    const c1 = groupA.cylinder;
    const prox = shapeProximity(world, {
      shape: groupA.cylinderShape,
      position: { x: c1.position.x, y: c1.position.y, z: c1.position.z },
      rotation: { x: c1.rotationQuaternion.x, y: c1.rotationQuaternion.y, z: c1.rotationQuaternion.z, w: c1.rotationQuaternion.w },
      maxDistance: 10
    });
    if (prox.hasHit) {
      proxOnCylinder.position.set(...nudged(prox.inputHitPoint, PROX_NUDGE));
      proxOnCapsule.position.set(...nudged(prox.hitPoint, PROX_NUDGE));
    }
    const c2 = groupB.cylinder;
    const cast = shapeCast(world, {
      shape: groupB.cylinderShape,
      rotation: { x: c2.rotationQuaternion.x, y: c2.rotationQuaternion.y, z: c2.rotationQuaternion.z, w: c2.rotationQuaternion.w },
      startPosition: castStart,
      endPosition: castEnd
    });
    if (cast.hasHit) {
      castHit.position.set(...nudged(cast.hitPoint, CAST_NUDGE));
    }
    if (!captureQueued && steps >= CAPTURE_STEPS && prox.hasHit && cast.hasHit) {
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
  const utilityLayer = createUtilityLayer(engine, scene);
  await registerUtilityLayer(utilityLayer);
  const picker = createGpuPicker(scene);
  let rotationGizmo = null;
  const cylinders = [groupA.cylinder, groupB.cylinder];
  canvas.addEventListener("pointerdown", async (e) => {
    const info = await pickAsync(picker, e.offsetX, e.offsetY);
    const picked = info.hit ? info.pickedMesh : null;
    const target = picked && cylinders.includes(picked) ? picked : null;
    if (!rotationGizmo) {
      if (!target) {
        return;
      }
      rotationGizmo = createRotationGizmo(engine, utilityLayer);
      setRotationGizmoLocalCoordinates(rotationGizmo, true);
    }
    attachRotationGizmoToNode(rotationGizmo, target);
  });
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
