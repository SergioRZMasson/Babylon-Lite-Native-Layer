// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene222.ts (esbuild, target es2017)
// Scene 222 — Composite Gizmos — tags: std, gizmo, interactive, composite
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene222-composite-gizmos.js

function rotationYawPitchRoll(yaw, pitch, roll) {
  const halfRoll = roll * 0.5, halfPitch = pitch * 0.5, halfYaw = yaw * 0.5;
  const sinRoll = Math.sin(halfRoll), cosRoll = Math.cos(halfRoll);
  const sinPitch = Math.sin(halfPitch), cosPitch = Math.cos(halfPitch);
  const sinYaw = Math.sin(halfYaw), cosYaw = Math.cos(halfYaw);
  return [
    cosYaw * sinPitch * cosRoll + sinYaw * cosPitch * sinRoll,
    sinYaw * cosPitch * cosRoll - cosYaw * sinPitch * sinRoll,
    cosYaw * cosPitch * sinRoll - sinYaw * sinPitch * cosRoll,
    cosYaw * cosPitch * cosRoll + sinYaw * sinPitch * sinRoll
  ];
}
async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  scene.clearColor = { r: 0.2, g: 0.2, b: 0.3, a: 1 };
  const camera = createArcRotateCamera(-Math.PI / 2, Math.PI / 3.5, 14, { x: 0, y: 0, z: 0 });
  camera.nearPlane = 0.1;
  camera.farPlane = 100;
  scene.camera = camera;
  attachControl(camera, canvas, scene, {
    shouldHandlePointerDown: () => !isGizmoInteracting(canvas),
    isExternalDragActive: () => isGizmoDragging(canvas),
    isExternalPickPending: () => isGizmoPickPending(canvas)
  });
  const light = createHemisphericLight([0, 1, 0]);
  light.intensity = 0.9;
  addToScene(scene, light);
  const groundMat = createStandardMaterial();
  groundMat.diffuseColor = [0.5, 0.5, 0.55];
  groundMat.specularColor = [0, 0, 0];
  const ground = createGround(engine, { width: 14, height: 14 });
  ground.material = groundMat;
  addToScene(scene, ground);
  const makeParentedCube = (name, parentT, parentR, color) => {
    const [qx, qy, qz, qw] = rotationYawPitchRoll(parentR.y, parentR.x, parentR.z);
    const parent = createTransformNode(name + "Parent", parentT.x, parentT.y, parentT.z, qx, qy, qz, qw);
    const cube = createBox(engine, 1);
    cube.name = name;
    const mat = createStandardMaterial();
    mat.diffuseColor = color;
    cube.material = mat;
    cube.parent = parent;
    addToScene(scene, cube);
    return { parent, cube };
  };
  const cube1 = makeParentedCube("cube1", { x: -4.5, y: 0.5, z: 0 }, { x: 0, y: 0.4, z: 0 }, [0.8, 0.25, 0.25]);
  const cube2 = makeParentedCube("cube2", { x: 0, y: 0.5, z: 0 }, { x: 0.3, y: -0.5, z: 0.2 }, [0.25, 0.8, 0.25]);
  const cube3 = makeParentedCube("cube3", { x: 4.5, y: 0.5, z: 0 }, { x: -0.3, y: 0.7, z: -0.4 }, [0.25, 0.25, 0.8]);
  await registerScene(scene);
  const utilityLayer = createUtilityLayer(engine, scene);
  const positionGizmo = createPositionGizmo(engine, utilityLayer);
  attachPositionGizmoToNode(positionGizmo, cube1.cube);
  setPositionGizmoLocalCoordinates(positionGizmo, true);
  const rotationGizmo = createRotationGizmo(engine, utilityLayer);
  attachRotationGizmoToNode(rotationGizmo, cube2.cube);
  setRotationGizmoLocalCoordinates(rotationGizmo, true);
  const scaleGizmo = createScaleGizmo(engine, utilityLayer);
  attachScaleGizmoToNode(scaleGizmo, cube3.cube);
  window.__scene222 = {
    cube1Pos: () => ({ x: cube1.cube.position.x, y: cube1.cube.position.y, z: cube1.cube.position.z }),
    cube1WorldPos: () => {
      const wm = cube1.cube.worldMatrix;
      return { x: wm[12], y: wm[13], z: wm[14] };
    },
    cube2Quat: () => ({ x: cube2.cube.rotationQuaternion.x, y: cube2.cube.rotationQuaternion.y, z: cube2.cube.rotationQuaternion.z, w: cube2.cube.rotationQuaternion.w }),
    cube3Scale: () => ({ x: cube3.cube.scaling.x, y: cube3.cube.scaling.y, z: cube3.cube.scaling.z }),
    posGizmoRoot: () => ({ x: positionGizmo.xGizmo.root.position.x, y: positionGizmo.xGizmo.root.position.y, z: positionGizmo.xGizmo.root.position.z }),
    rotGizmoRoot: () => ({ x: rotationGizmo.xGizmo.root.position.x, y: rotationGizmo.xGizmo.root.position.y, z: rotationGizmo.xGizmo.root.position.z }),
    scaleGizmoRoot: () => ({ x: scaleGizmo.xGizmo.root.position.x, y: scaleGizmo.xGizmo.root.position.y, z: scaleGizmo.xGizmo.root.position.z }),
    scaleGizmoScale: () => ({ x: scaleGizmo.xGizmo.root.scaling.x, y: scaleGizmo.xGizmo.root.scaling.y, z: scaleGizmo.xGizmo.root.scaling.z }),
    // Diagnostic: gizmo X-arrow root rotation quaternion — confirms whether
    // local-coord mode is being applied (the X arrow should rotate with
    // the attached node's parent transform).
    posXGizmoQuat: () => ({
      x: positionGizmo.xGizmo.root.rotationQuaternion.x,
      y: positionGizmo.xGizmo.root.rotationQuaternion.y,
      z: positionGizmo.xGizmo.root.rotationQuaternion.z,
      w: positionGizmo.xGizmo.root.rotationQuaternion.w,
      useLocal: positionGizmo.xGizmo.useLocalCoordinates
    }),
    probePick: async (x, y) => {
      var _a, _b;
      const { createGpuPicker, pickAsync } = await import("babylon-lite");
      const picker = createGpuPicker(utilityLayer.scene);
      const info = await pickAsync(picker, x, y);
      return info.hit ? (_b = (_a = info.pickedMesh) == null ? void 0 : _a.name) != null ? _b : "<unnamed>" : "miss";
    },
    setLocalMode: (useLocal) => {
      setPositionGizmoLocalCoordinates(positionGizmo, useLocal);
      setRotationGizmoLocalCoordinates(rotationGizmo, useLocal);
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
