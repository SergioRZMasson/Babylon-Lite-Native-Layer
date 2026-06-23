// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene243.ts (esbuild, target es2017)
// Scene 243 — MorphStressTest — tags: gltf
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene243-morph-stress-test.js

async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  const root = await loadGltf(engine, "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/MorphStressTest/glTF/MorphStressTest.gltf");
  addToScene(scene, root);
  scene.clearColor = { r: 0.2, g: 0.2, b: 0.3, a: 1 };
  await loadEnvironment(scene, "https://assets.babylonjs.com/environments/environmentSpecular.env", { skipSkybox: true, skipGround: true, brdfUrl: "/brdf-lut.png" });
  const cam = createArcRotateCamera(1.5707963, 1.5707963, 6.25, { x: 0, y: 0.2, z: 0 });
  cam.fov = 0.8;
  cam.nearPlane = 6.25 * 0.01;
  cam.farPlane = 6.25 * 1e3;
  scene.camera = cam;
  attachControl(cam, canvas, scene);
  scene.fixedDeltaMs = 16;
  const params = new URLSearchParams(window.location.search);
  const seekTimeParam = parseFloat(params.get("seekTime") || "");
  let frameCount = 0;
  let seekDone = false;
  onBeforeRender(scene, () => {
    frameCount++;
    if (!isNaN(seekTimeParam) && frameCount === 10 && !seekDone) {
      const seekFrame = seekTimeParam * 60;
      for (const g of scene.animationGroups) {
        goToFrame(g, seekFrame);
        pauseAnimation(g);
      }
      seekDone = true;
      canvas.dataset.animationFrozen = "true";
    }
  });
  await registerScene(scene);
  await startEngine(engine);
  window.__scene = scene;
  canvas.dataset.camAlpha = String(cam.alpha);
  canvas.dataset.camRadius = String(cam.radius);
  canvas.dataset.initMs = String(performance.now() - __initStart);
  canvas.dataset.ready = "true";
}
main().catch(console.error);
