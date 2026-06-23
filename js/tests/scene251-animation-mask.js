// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene251.ts (esbuild, target es2017)
// Scene 251 — Animation Mask (Xbot walk, frozen legs) — tags: gltf, skeleton, animation, animation-mask
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene251-animation-mask.js

const XBOT_URL = "https://playground.babylonjs.com/scenes/Xbot.glb";
const LOWER_BODY_BONES = [
  "mixamorig:LeftUpLeg",
  "mixamorig:LeftLeg",
  "mixamorig:LeftFoot",
  "mixamorig:LeftToeBase",
  "mixamorig:LeftToe_End",
  "mixamorig:RightUpLeg",
  "mixamorig:RightLeg",
  "mixamorig:RightFoot",
  "mixamorig:RightToeBase",
  "mixamorig:RightToe_End"
];
async function main() {
  var _a;
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  scene.clearColor = { r: 0.2, g: 0.2, b: 0.3, a: 1 };
  scene.fixedDeltaMs = 16;
  scene.camera = createArcRotateCamera(Math.PI / 2, Math.PI / 4, 3, { x: 0, y: 1, z: 0 });
  scene.camera.nearPlane = 0.1;
  scene.camera.farPlane = 1e3;
  attachControl(scene.camera, canvas, scene);
  addToScene(scene, createHemisphericLight([0, 1, 0], 0.6));
  addToScene(scene, createDirectionalLight([0, -0.5, -1], 0.8));
  const xbot = await loadGltf(engine, XBOT_URL);
  addToScene(scene, xbot);
  const groups = (_a = xbot.animationGroups) != null ? _a : [];
  const walk = requireGroup(groups, "walk");
  for (const group of groups) {
    stopAnimation(group);
  }
  walk.mask = createAnimationGroupMask(LOWER_BODY_BONES, AnimationGroupMaskMode.Exclude);
  const seekTime = parseFloat(new URLSearchParams(window.location.search).get("seekTime") || "0.5");
  const seekFrame = seekTime * 60;
  await registerScene(scene);
  goToFrame(walk, seekFrame, engine);
  await startEngine(engine);
  canvas.dataset.drawCalls = String(engine.drawCallCount);
  canvas.dataset.initMs = String(performance.now() - __initStart);
  canvas.dataset.animationFrozen = "true";
  canvas.dataset.ready = "true";
}
function requireGroup(groups, name) {
  const group = groups.find((candidate) => candidate.name === name);
  if (!group) {
    throw new Error(`Xbot animation group "${name}" was not found`);
  }
  return group;
}
main().catch(console.error);
