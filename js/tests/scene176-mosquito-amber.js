// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene176.ts (esbuild, target es2017)
// Scene 176 - MosquitoInAmber — tags: pbr, gltf, env, transmission, volume, skybox
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene176-mosquito-amber.js

const MODEL_URL = "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/MosquitoInAmber/glTF/MosquitoInAmber.gltf";
const ENV_URL = "https://assets.babylonjs.com/environments/studio.env";
const CAM = {
  alpha: 1.9445,
  beta: 1.5454,
  radius: 0.1458,
  target: { x: 98e-5, y: 13e-4, z: -713e-5 },
  fov: 0.8
};
async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  getFrameGraph(scene)._tasks[0]._config.transmission = { copyCount: 1 };
  const cam = createArcRotateCamera(CAM.alpha, CAM.beta, CAM.radius, CAM.target);
  cam.fov = CAM.fov;
  cam.nearPlane = CAM.radius * 0.01;
  cam.farPlane = CAM.radius * 1e3;
  scene.camera = cam;
  attachControl(cam, canvas, scene);
  await Promise.all([
    loadGltf(engine, MODEL_URL).then((asset) => addToScene(scene, asset)),
    loadEnvironment(scene, ENV_URL, {
      // IBL only — the visible skybox is a scene-level blurred PBR box below
      // (mirrors BJS createDefaultSkybox(env, true, scale, 0.3) = microSurface 0.7).
      skipSkybox: true,
      skipGround: true,
      brdfUrl: "/brdf-lut.png"
    })
  ]);
  scene.imageProcessing.toneMappingEnabled = false;
  scene.imageProcessing.exposure = 1;
  scene.imageProcessing.contrast = 1;
  const skybox = createBox(engine, (cam.farPlane - cam.nearPlane) / 2);
  skybox.material = createPbrMaterial({
    baseColorTexture: createSolidTexture2D(engine, 1, 1, 1),
    ormTexture: createSolidTexture2D(engine, 1, 0.3, 1),
    // occ=1, rough=0.3, metal=1
    environmentIntensity: 1,
    directIntensity: 0,
    doubleSided: true,
    skyboxMode: true
  });
  const syncSkybox = () => {
    const w = cam.worldMatrix;
    skybox.position.set(w[12], w[13], w[14]);
  };
  syncSkybox();
  onBeforeRender(scene, syncSkybox);
  addToScene(scene, skybox);
  await registerScene(scene);
  await startEngine(engine);
  canvas.dataset.drawCalls = String(engine.drawCallCount);
  canvas.dataset.camAlpha = String(cam.alpha);
  canvas.dataset.camBeta = String(cam.beta);
  canvas.dataset.camRadius = String(cam.radius);
  canvas.dataset.camTarget = `${cam.target.x},${cam.target.y},${cam.target.z}`;
  canvas.dataset.camFov = String(cam.fov);
  canvas.dataset.initMs = String(performance.now() - __initStart);
  canvas.dataset.ready = "true";
}
main().catch(console.error);
