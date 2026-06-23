// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene151.ts (esbuild, target es2017)
// Scene 151 — Manual Transform Animation — tags: std, procedural, anim
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene151-manual-transform.js

const FRAME_RATE = 12;
const END_FRAME = 2 * FRAME_RATE;
const HALF_PI_QUAT = Math.SQRT1_2;
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
  addToScene(scene, box);
  const manager = createAnimationManager();
  const transformClip = createPropertyAnimationClip(
    "manualTransform",
    [
      {
        path: "position",
        keys: [
          { frame: 0, value: [1.5, 0, 0] },
          { frame: FRAME_RATE, value: [-1.5, 0.75, 0] },
          { frame: END_FRAME, value: [1.5, 0, 0] }
        ]
      },
      {
        path: "scaling",
        keys: [
          { frame: 0, value: [1, 1, 1] },
          { frame: FRAME_RATE, value: [1.45, 0.7, 1.2] },
          { frame: END_FRAME, value: [1, 1, 1] }
        ]
      },
      {
        path: "rotationQuaternion",
        keys: [
          { frame: 0, value: [0, 0, 0, 1] },
          { frame: FRAME_RATE, value: [0, HALF_PI_QUAT, 0, HALF_PI_QUAT] },
          { frame: END_FRAME, value: [0, 1, 0, 0] }
        ]
      }
    ],
    { frameRate: FRAME_RATE }
  );
  const group = createPropertyAnimationGroup(manager, box, transformClip, { fromFrame: 0, toFrame: END_FRAME, loop: true });
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
