// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene33.ts (esbuild, target es2017)
// Scene 33 — KHR_lights_punctual — tags: pbr, gltf, env, lights-punctual, transmission
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene33-lights-punctual.js

async function main() {
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  getFrameGraph(scene)._tasks[0]._config.transmission = { copyCount: 1 };
  const asset = await loadGltf(engine, "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/LightsPunctualLamp/glTF-Binary/LightsPunctualLamp.glb");
  addToScene(scene, asset);
  await loadEnvironment(scene, "https://assets.babylonjs.com/environments/environmentSpecular.env", {
    skipSkybox: true,
    skipGround: true,
    brdfUrl: "/brdf-lut.png"
  });
  const cam = createDefaultCamera(scene);
  cam.alpha += Math.PI;
  attachControl(cam, canvas, scene);
  await registerScene(scene);
  await startEngine(engine);
  canvas.dataset.ready = "true";
}
main().catch(console.error);
