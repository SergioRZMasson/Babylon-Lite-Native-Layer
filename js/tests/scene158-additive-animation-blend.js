// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene158.ts (esbuild, target es2017)
// Scene 158 — Additive Animation Blend — tags: pbr, gltf, anim
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene158-additive-animation-blend.js

const XBOT_URL = "https://playground.babylonjs.com/scenes/Xbot.glb";
const POSE_FRAME = 2;
const POSE_TIME = POSE_FRAME / 60;
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
  for (const entity of xbot.entities) {
    addToScene(scene, entity);
  }
  const manager = createAnimationManager({ engine });
  const groups = (_a = xbot.animationGroups) != null ? _a : [];
  for (const group of groups) {
    stopAnimation(group);
    setAnimationWeight(group, 0);
  }
  const idle = requireGroup(groups, "idle");
  const sadPose = requireGroup(groups, "sad_pose");
  const activeGroups = [idle, sadPose];
  addAnimationGroups(manager, activeGroups);
  idle.loopAnimation = true;
  playAnimation(idle);
  setAnimationWeight(idle, 1);
  setAdditivePose(sadPose, 1);
  enableAnimationBlending(manager);
  const seekTime = parseFloat(new URLSearchParams(window.location.search).get("seekTime") || "");
  if (Number.isFinite(seekTime)) {
    for (const group of activeGroups) {
      group.currentTime = group === sadPose ? POSE_TIME : seekTime;
      pauseAnimation(group);
    }
    canvas.dataset.animationFrozen = "true";
  }
  onBeforeRender(scene, (deltaMs) => updateAnimationManager(manager, deltaMs));
  await registerScene(scene);
  await startEngine(engine);
  canvas.dataset.drawCalls = String(engine.drawCallCount);
  canvas.dataset.initMs = String(performance.now() - __initStart);
  canvas.dataset.ready = "true";
}
function requireGroup(groups, name) {
  const group = groups.find((candidate) => candidate.name === name);
  if (!group) {
    throw new Error(`Xbot animation group "${name}" was not found`);
  }
  return group;
}
function setAdditivePose(group, weight) {
  group.loopAnimation = true;
  playAnimation(group);
  setAnimationAdditive(group, { referenceFrame: 0 });
  setAnimationWeight(group, weight);
  group.currentTime = POSE_TIME;
  pauseAnimation(group);
}
main().catch(console.error);
