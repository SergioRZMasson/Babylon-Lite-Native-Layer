// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene112.ts (esbuild, target es2017)
// Scene 112 — KHR_texture_basisu Flight Helmet — tags: pbr, gltf, env, basis, transmission
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene112-khr-texture-basisu.js

const MODEL_URL = "https://raw.githubusercontent.com/BabylonJS/Assets/master/meshes/FlightHelmetKTX/FlightHelmet.gltf";
async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  getFrameGraph(scene)._tasks[0]._config.transmission = { copyCount: 1 };
  const helmet = await loadGltf(engine, MODEL_URL);
  addToScene(scene, helmet);
  const groundTextureUrl = "https://assets.babylonjs.com/core/environments/backgroundGround.png";
  const skyboxUrl = "https://assets.babylonjs.com/core/environments/backgroundSkybox.dds";
  await loadEnvironment(scene, "https://assets.babylonjs.com/core/environments/environmentSpecular.env", {
    skipGround: true,
    skipSkybox: true,
    skyboxSize: 1e3,
    brdfUrl: "/brdf-lut.png"
  });
  addDdsEnvironmentBackground(scene, { groundTextureUrl, skyboxUrl, skyboxSize: 1e3, enableNoise: false });
  const cam = createDefaultCamera(scene);
  cam.alpha = Math.PI / 2;
  attachControl(cam, canvas, scene);
  addToScene(scene, createHemisphericLight([0, 1, 0], 1));
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
