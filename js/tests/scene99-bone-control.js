// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene99.ts (esbuild, target es2017)
// Scene 99 — Bone Control — tags: gltf, skeleton, bone-control
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene99-bone-control.js

const XBOT_URL = "https://playground.babylonjs.com/scenes/Xbot.glb";
const HIDDEN_BONE = "mixamorig:LeftArm";
async function main() {
  var _a;
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  scene.clearColor = { r: 0.2, g: 0.2, b: 0.3, a: 1 };
  scene.camera = createArcRotateCamera(-Math.PI / 2, Math.PI / 2.4, 4, { x: 0, y: 1, z: 0 });
  scene.camera.nearPlane = 0.1;
  scene.camera.farPlane = 1e3;
  attachControl(scene.camera, canvas, scene);
  addToScene(scene, createHemisphericLight([0, 1, 0], 0.6));
  addToScene(scene, createDirectionalLight([0, -0.5, -1], 0.8));
  enableBoneControl();
  const xbot = await loadGltf(engine, XBOT_URL);
  for (const entity of xbot.entities) {
    addToScene(scene, entity);
  }
  const skel = (_a = xbot.skeletons) == null ? void 0 : _a[0];
  const arm = skel ? getBoneByName(skel, HIDDEN_BONE) : void 0;
  if (skel && arm) {
    setBoneVisible(skel, arm, false);
  }
  await registerScene(scene);
  await startEngine(engine);
  canvas.dataset.drawCalls = String(engine.drawCallCount);
  canvas.dataset.initMs = String(performance.now() - __initStart);
  canvas.dataset.ready = "true";
}
main().catch(console.error);
