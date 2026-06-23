// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene219.ts (esbuild, target es2017)
// Scene 219 — Per-instance VAT — tags: vat, animation, skeleton, instancing, pbr, gltf
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene219-vat-instanced.js

function findSkinned(node) {
  var _a;
  const m = node;
  if (m.skeleton) {
    return m;
  }
  for (const c of (_a = node.children) != null ? _a : []) {
    const hit = findSkinned(c);
    if (hit) {
      return hit;
    }
  }
  return null;
}
function frozenParams(swim, frame) {
  return new Float32Array([swim.fromRow, swim.fromRow + swim.frameCount - 1, frame, 0]);
}
async function main() {
  var _a, _b;
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  scene.clearColor = { r: 0.14, g: 0.14, b: 0.16, a: 1 };
  const container = await loadGltf(engine, "https://models.babylonjs.com/shark.glb");
  addToScene(scene, container);
  const root = container.entities[0];
  const mesh = findSkinned(root);
  const groups = (_a = container.animationGroups) != null ? _a : [];
  let handle = null;
  let swim = null;
  if (mesh && groups.length > 0) {
    const baked = bakeVat(engine, mesh, groups);
    handle = attachVat(engine, mesh, baked, "swimming");
    swim = (_b = baked.clips["swimming"]) != null ? _b : null;
    const identity = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    setThinInstances(mesh, identity, 1);
    if (swim) {
      handle.setInstances(new Float32Array([swim.fromRow, swim.fromRow + swim.frameCount - 1, 0, swim.fps]));
    }
    canvas.dataset.vatBones = String(baked.boneCount);
    canvas.dataset.vatFrames = String(baked.frameCount);
  }
  const cam = createDefaultCamera(scene);
  cam.alpha = 0;
  cam.beta = Math.PI / 2.2;
  attachControl(cam, canvas, scene);
  addToScene(scene, createHemisphericLight([0, 1, 0], 1));
  const params = new URLSearchParams(window.location.search);
  const seekTimeParam = parseFloat(params.get("seekTime") || "");
  const freezing = !isNaN(seekTimeParam) && seekTimeParam >= 0;
  let frameCount = 0;
  let seekDone = false;
  let last = performance.now();
  onBeforeRender(scene, () => {
    frameCount++;
    canvas.dataset.frameCount = String(frameCount);
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1e3);
    last = now;
    if (freezing) {
      if (frameCount === 10 && !seekDone && handle && swim) {
        handle.setInstances(frozenParams(swim, Math.round(seekTimeParam * 60)));
        handle.update(0);
        seekDone = true;
        canvas.dataset.animationFrozen = "true";
      }
      return;
    }
    handle == null ? void 0 : handle.update(dt);
  });
  await registerScene(scene);
  await startEngine(engine);
  canvas.dataset.drawCalls = String(engine.drawCallCount);
  canvas.dataset.initMs = String(performance.now() - __initStart);
  canvas.dataset.ready = "true";
}
main().catch(console.error);
