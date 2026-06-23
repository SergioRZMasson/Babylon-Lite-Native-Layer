// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene247.ts (esbuild, target es2017)
// Scene 247 — TeapotsGalore — tags: gltf
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene247-teapots-galore.js

async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  const root = await loadGltf(engine, "https://cx20.github.io/gltf-test/tutorialModels/TeapotsGalore/glTF/TeapotsGalore.gltf");
  addToScene(scene, root);
  scene.clearColor = { r: 0.2, g: 0.2, b: 0.3, a: 1 };
  await loadEnvironment(scene, "https://assets.babylonjs.com/environments/environmentSpecular.env", { skipSkybox: true, skipGround: true, brdfUrl: "/brdf-lut.png" });
  const cam = createArcRotateCamera(1.5707963, 0.15, 1440.14, { x: 0, y: 6.649, z: 0 });
  cam.fov = 0.8;
  cam.nearPlane = 1440.14 * 0.01;
  cam.farPlane = 1440.14 * 1e3;
  scene.camera = cam;
  attachControl(cam, canvas, scene);
  await registerScene(scene);
  await startEngine(engine);
  window.__scene = scene;
  canvas.dataset.camAlpha = String(cam.alpha);
  canvas.dataset.camRadius = String(cam.radius);
  canvas.dataset.initMs = String(performance.now() - __initStart);
  canvas.dataset.ready = "true";
}
main().catch(console.error);
