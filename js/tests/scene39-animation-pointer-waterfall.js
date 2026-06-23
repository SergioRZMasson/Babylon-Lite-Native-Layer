// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene39.ts (esbuild, target es2017)
// Scene 39 — KHR_animation_pointer (Animated Waterfall) — tags: pbr, gltf, env, lights-punctual, texture-transform, animation-pointer
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene39-animation-pointer-waterfall.js

async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  const root = await loadGltf(engine, "https://cx20.github.io/gltf-test/tutorialModels/AnimatedWaterfall/glTF/AnimatedWaterfall.gltf");
  addToScene(scene, root);
  scene.lights.length = 0;
  await loadEnvironment(scene, "https://assets.babylonjs.com/environments/environmentSpecular.env", {
    skipSkybox: true,
    skipGround: true,
    brdfUrl: "/brdf-lut.png"
  });
  const cam = createArcRotateCamera(Math.PI / 2, Math.PI / 2, 21, { x: 0.15, y: 1.6, z: 0.25 });
  cam.fov = 0.8;
  scene.camera = cam;
  attachControl(cam, canvas, scene);
  scene.fixedDeltaMs = 16;
  const params = new URLSearchParams(window.location.search);
  const seekTimeParam = parseFloat(params.get("seekTime") || "");
  let frameCount = 0;
  let seekDone = false;
  onBeforeRender(scene, () => {
    frameCount++;
    canvas.dataset.frameCount = String(frameCount);
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
