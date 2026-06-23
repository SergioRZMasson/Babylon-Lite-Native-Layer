// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene224.ts (esbuild, target es2017)
// Scene 224 — Bounding Box Gizmo — tags: std, gizmo, interactive, bbox
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene224-bounding-box-gizmo.js

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

async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  scene.clearColor = { r: 0.2, g: 0.2, b: 0.3, a: 1 };
  const camera = createArcRotateCamera(-Math.PI / 2, Math.PI / 3, 14, { x: 0, y: 1, z: 0 });
  camera.nearPlane = 0.1;
  camera.farPlane = 100;
  scene.camera = camera;
  if (!new URLSearchParams(window.location.search).has("nocam")) {
    attachControl(camera, canvas, scene, {
      shouldHandlePointerDown: () => !isGizmoInteracting(canvas),
      isExternalDragActive: () => isGizmoDragging(canvas),
      isExternalPickPending: () => isGizmoPickPending(canvas)
    });
  }
  const light = createHemisphericLight([0, 1, 0]);
  light.intensity = 0.9;
  addToScene(scene, light);
  const groundMat = createStandardMaterial();
  groundMat.diffuseColor = [0.5, 0.5, 0.55];
  const ground = createGround(engine, { width: 14, height: 14 });
  ground.material = groundMat;
  addToScene(scene, ground);
  const root = createTransformNode("groupRoot", 0, 1, 0, 0, 0, 0, 1);
  const colors = [
    [0.8, 0.25, 0.25],
    [0.25, 0.8, 0.25],
    [0.25, 0.25, 0.8],
    [0.85, 0.85, 0.2],
    [0.7, 0.3, 0.85]
  ];
  const offsets = [
    [-1.5, 0, 0],
    [1.5, 0, 0],
    [0, 0, -1.5],
    [0, 0, 1.5],
    [0, 0.9, 0]
  ];
  const sizes = [0.8, 0.6, 0.9, 0.7, 0.5];
  for (let i = 0; i < 5; i++) {
    const cube = createBox(engine, sizes[i]);
    cube.name = `cube${i + 1}`;
    cube.position.set(offsets[i][0], offsets[i][1], offsets[i][2]);
    const mat = createStandardMaterial();
    mat.diffuseColor = colors[i];
    cube.material = mat;
    cube.parent = root;
    addToScene(scene, cube);
  }
  await registerScene(scene);
  const utilityLayer = createUtilityLayer(engine, scene);
  const bbox = createBoundingBoxGizmo(engine, utilityLayer, { color: [1, 1, 0.4] });
  attachBoundingBoxGizmoToNode(bbox, root);
  window.__scene224 = {
    rootPos: () => ({ x: root.position.x, y: root.position.y, z: root.position.z }),
    rootQuat: () => ({ x: root.rotationQuaternion.x, y: root.rotationQuaternion.y, z: root.rotationQuaternion.z, w: root.rotationQuaternion.w }),
    rootScale: () => ({ x: root.scaling.x, y: root.scaling.y, z: root.scaling.z }),
    // Directly drive the group root's TRS, bypassing pointer-drag entirely.
    // Used by the parity spec to put BOTH engines at an identical post-edit
    // pose so the rendered frame compares cleanly (only material / AA noise
    // remains).  Avoids the pointer-drag plumbing gap that produces ~14%
    // over-rotation / over-scale in Lite vs BJS for the same screen drag.
    setRootTrs: (pos, q, scl) => {
      root.position.set(pos.x, pos.y, pos.z);
      root.rotationQuaternion.set(q.x, q.y, q.z, q.w);
      root.scaling.set(scl.x, scl.y, scl.z);
    },
    aabb: () => {
      const b = bbox._aabb;
      return { min: __spreadValues({}, b.min), max: __spreadValues({}, b.max), centre: __spreadValues({}, b.centre), size: __spreadValues({}, b.size) };
    },
    bbox: () => {
      const meshes = bbox._meshes.map((m) => ({
        name: m.name,
        pos: { x: m.position.x, y: m.position.y, z: m.position.z },
        scl: { x: m.scaling.x, y: m.scaling.y, z: m.scaling.z },
        visible: m.visible
      }));
      return { count: meshes.length, meshes: meshes.slice(0, 14) };
    },
    // Project a world-space point to a canvas-relative CSS pixel
    // coordinate using the active camera's view-projection matrix.  The
    // parity spec uses this on BOTH engines to drive each drag by
    // world-space anchors (corner / edge midpoint / body centre) rather
    // than hard-coded screen pixels — so the simulated input actually
    // hits the gizmo handles in each engine's projection.
    worldToScreen: (p) => {
      const aspect = canvas.clientWidth / canvas.clientHeight;
      const vp = getViewProjectionMatrix(camera, aspect);
      const clipX = vp[0] * p.x + vp[4] * p.y + vp[8] * p.z + vp[12];
      const clipY = vp[1] * p.x + vp[5] * p.y + vp[9] * p.z + vp[13];
      const clipW = vp[3] * p.x + vp[7] * p.y + vp[11] * p.z + vp[15];
      const ndcX = clipX / clipW;
      const ndcY = clipY / clipW;
      return {
        x: (ndcX * 0.5 + 0.5) * canvas.clientWidth,
        y: (1 - (ndcY * 0.5 + 0.5)) * canvas.clientHeight
      };
    }
  };
  await registerUtilityLayer(utilityLayer);
  let frame = 0;
  onBeforeRender(scene, () => {
    canvas.dataset.drawCalls = String(engine.drawCallCount);
    frame++;
    if (frame === 3) {
      canvas.dataset.initMs = String(performance.now() - __initStart);
      canvas.dataset.ready = "true";
    }
  });
  await startEngine(engine);
}
main().catch(console.error);
