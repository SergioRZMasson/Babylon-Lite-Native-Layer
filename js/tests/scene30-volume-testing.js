// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene30.ts (esbuild, target es2017)
// Scene 30 — KHR_materials_volume_testing — tags: pbr, gltf, env, transmission, volume
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene30-volume-testing.js

async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  getFrameGraph(scene)._tasks[0]._config.transmission = { copyCount: 1 };
  const cam = createArcRotateCamera(Math.PI / 2, Math.PI / 2, 1.1856086997830126, { x: -0.2914360649171073, y: 0.4, z: 0.3975263311541397 });
  cam.fov = 0.8;
  cam.nearPlane = 0.0697417;
  cam.farPlane = 6974.17;
  scene.camera = cam;
  attachControl(cam, canvas, scene);
  await Promise.all([
    loadGltf(engine, "https://assets.babylonjs.com/meshes/KHR_materials_volume_testing.glb").then((asset) => addToScene(scene, asset)),
    loadEnvironment(scene, "https://assets.babylonjs.com/core/environments/environmentSpecular.env", {
      skipSkybox: true,
      skipGround: true,
      brdfUrl: "/brdf-lut.png"
    })
  ]);
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
