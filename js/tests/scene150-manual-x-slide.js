// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene150.ts (esbuild, target es2017)
// Scene 150 — Manual X Slide Animation — tags: std, procedural, anim
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene150-manual-x-slide.js

const FRAME_RATE = 10;
const END_FRAME = 2 * FRAME_RATE;
async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  scene.clearColor = { r: 0.2, g: 0.2, b: 0.3, a: 1 };
  scene.camera = createArcRotateCamera(-Math.PI / 2, Math.PI / 4, 10, { x: 0, y: 0, z: 0 });
  scene.camera.nearPlane = 1;
  scene.camera.farPlane = 1e4;
  attachControl(scene.camera, canvas, scene);
  addToScene(scene, createDirectionalLight([0, -1, 1], 0.75));
  addToScene(scene, createHemisphericLight([0, 1, 0], 0.5));
  const box = createBox(engine);
  box.material = createStandardMaterial();
  box.position.x = 2;
  addToScene(scene, box);
  const manager = createAnimationManager();
  const xSlide = createPropertyAnimationClip("xSlide", [
    {
      path: "position.x",
      frameRate: FRAME_RATE,
      keys: [
        { frame: 0, value: 2 },
        { frame: FRAME_RATE, value: -2 },
        { frame: END_FRAME, value: 2 }
      ]
    }
  ]);
  const group = createPropertyAnimationGroup(manager, box, xSlide, { fromFrame: 0, toFrame: END_FRAME, loop: true });
  const seekTime = parseFloat(new URLSearchParams(window.location.search).get("seekTime") || "");
  if (Number.isFinite(seekTime)) {
    goToFrame(group, seekTime * FRAME_RATE);
    canvas.dataset.animationFrozen = "true";
  } else {
    startAnimationManager(manager);
  }
  await registerScene(scene);
  await startEngine(engine);
  canvas.dataset.drawCalls = String(engine.drawCallCount);
  canvas.dataset.initMs = String(performance.now() - __initStart);
  canvas.dataset.ready = "true";
}
main().catch(console.error);
