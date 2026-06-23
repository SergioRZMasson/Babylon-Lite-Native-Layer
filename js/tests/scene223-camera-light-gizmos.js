// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene223.ts (esbuild, target es2017)
// Scene 223 — Camera + Light Gizmos — tags: std, gizmo, display
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene223-camera-light-gizmos.js

async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  scene.clearColor = { r: 0.2, g: 0.2, b: 0.3, a: 1 };
  const mainCamera = createArcRotateCamera(-Math.PI / 2, Math.PI / 3, 18, { x: 0, y: 1.5, z: 0 });
  mainCamera.nearPlane = 0.1;
  mainCamera.farPlane = 100;
  scene.camera = mainCamera;
  attachControl(mainCamera, canvas, scene);
  const groundMat = createStandardMaterial();
  groundMat.diffuseColor = [0.5, 0.5, 0.55];
  const ground = createGround(engine, { width: 20, height: 14 });
  ground.material = groundMat;
  addToScene(scene, ground);
  const Y = 2;
  const hemiLight = createHemisphericLight([0, 1, 0]);
  hemiLight.intensity = 0.7;
  addToScene(scene, hemiLight);
  const pointLight = createPointLight([-2.5, Y, 0]);
  pointLight.diffuse = [1, 0.85, 0.4];
  pointLight.intensity = 0.3;
  addToScene(scene, pointLight);
  const spotLight = createSpotLight([2.5, Y, 0], [0, -1, 1e-4], Math.PI / 3, 2, 0.4);
  spotLight.diffuse = [0.5, 0.7, 1];
  addToScene(scene, spotLight);
  const dirLight = createDirectionalLight([0.25, -1, 0.25], 0.3);
  dirLight.position.set(7, Y, 0);
  addToScene(scene, dirLight);
  const subjectCamera = createFreeCamera({ x: 0, y: 3, z: -5 }, { x: 0, y: 0.5, z: 0 });
  subjectCamera.nearPlane = 1;
  subjectCamera.farPlane = 10;
  await registerScene(scene);
  const utilityLayer = createUtilityLayer(engine, scene);
  const cameraGizmo = createCameraGizmo(engine, utilityLayer);
  attachCameraGizmoToCamera(cameraGizmo, subjectCamera);
  const hemiGizmo = createLightGizmo(engine, utilityLayer);
  attachLightGizmoToLight(hemiGizmo, hemiLight);
  hemiGizmo.root.position.set(-7, Y, 0);
  const pointGizmo = createLightGizmo(engine, utilityLayer);
  attachLightGizmoToLight(pointGizmo, pointLight);
  const spotGizmo = createLightGizmo(engine, utilityLayer);
  attachLightGizmoToLight(spotGizmo, spotLight);
  const dirGizmo = createLightGizmo(engine, utilityLayer);
  attachLightGizmoToLight(dirGizmo, dirLight);
  await registerUtilityLayer(utilityLayer);
  window.__scene223 = {
    mainCamera,
    subjectCamera,
    hemiLight,
    pointLight,
    spotLight,
    dirLight,
    cameraGizmo,
    hemiGizmo,
    pointGizmo,
    spotGizmo,
    dirGizmo
  };
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
