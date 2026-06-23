// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene5.ts (esbuild, target es2017)
// Scene 5 — Alien Skeleton — tags: pbr, gltf
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene5-alien.js

async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  addToScene(scene, await loadGltf(engine, "https://playground.babylonjs.com/scenes/Alien/Alien.gltf"));
  const cam = createDefaultCamera(scene);
  cam.alpha = Math.PI / 2;
  cam.beta = Math.PI / 2;
  cam.radius = 2;
  cam.target = { x: 0, y: 0, z: 0 };
  attachControl(cam, canvas, scene);
  addToScene(scene, createHemisphericLight([0, 1, 0], 0.7));
  scene.fixedDeltaMs = 16;
  const params = new URLSearchParams(window.location.search);
  const shouldFreeze = params.has("freeze");
  const seekTimeParam = parseFloat(params.get("seekTime") || "");
  let frameCount = 0;
  let seekDone = false;
  onBeforeRender(scene, () => {
    frameCount++;
    canvas.dataset.frameCount = String(frameCount);
    if (!isNaN(seekTimeParam) && seekTimeParam > 0 && frameCount === 10 && !seekDone) {
      const seekFrame = seekTimeParam * 60;
      for (const g of scene.animationGroups) {
        goToFrame(g, seekFrame);
      }
      seekDone = true;
      canvas.dataset.animationFrozen = "true";
    }
    if (shouldFreeze && !seekDone && frameCount === 300) {
      for (const g of scene.animationGroups) {
        pauseAnimation(g);
      }
      canvas.dataset.animationFrozen = "true";
    }
  });
  await registerScene(scene);
  await startEngine(engine);
  canvas.dataset.drawCalls = String(engine.drawCallCount);
  canvas.dataset.initMs = String(performance.now() - __initStart);
  canvas.dataset.ready = "true";
}
main().catch(console.error);
