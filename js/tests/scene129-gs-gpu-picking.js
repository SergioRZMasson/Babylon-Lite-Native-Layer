// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene129.ts (esbuild, target es2017)
// Scene 129 — Gaussian Splatting GPU Picking — tags: gaussian-splatting, gpu-picking
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene129-gs-gpu-picking.js

const SPLAT_URL = "https://raw.githubusercontent.com/CedricGuillemet/dump/master/Halo_Believe.splat";
const DEFAULT_PICK_X_RATIO = 0.5;
const DEFAULT_PICK_Y_RATIO = 0.6;
function getPickRatios() {
  const params = new URLSearchParams(window.location.search);
  const px = parseFloat(params.get("pickX") || "");
  const py = parseFloat(params.get("pickY") || "");
  return [Number.isFinite(px) ? px : DEFAULT_PICK_X_RATIO, Number.isFinite(py) ? py : DEFAULT_PICK_Y_RATIO];
}
async function main() {
  var _a, _b;
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  scene.clearColor = { r: 0.2, g: 0.2, b: 0.3, a: 1 };
  const camera = createArcRotateCamera(-1, 1, 10, { x: 0, y: 0, z: 0 });
  scene.camera = camera;
  attachControl(camera, canvas, scene);
  addToScene(scene, createHemisphericLight([0, 1, 0], 0.7));
  const sphereMat = createStandardMaterial();
  const sphere = createSphere(engine, { diameter: 1, segments: 32 });
  sphere.name = "sphere";
  sphere.position.y = 0.5;
  sphere.position.z = -1;
  sphere.material = sphereMat;
  addToScene(scene, sphere);
  const groundMat = createStandardMaterial();
  const ground = createGround(engine, { width: 6, height: 6 });
  ground.name = "ground";
  ground.material = groundMat;
  addToScene(scene, ground);
  const splat = await loadSplat(scene, SPLAT_URL);
  splat.name = "renderMesh";
  splat.position.y = 1.7;
  await registerScene(scene);
  await startEngine(engine);
  await splat.firstSortReady;
  await new Promise((r) => requestAnimationFrame(() => r()));
  const picker = createGpuPicker(scene);
  canvas.addEventListener("pointerdown", async (e) => {
    var _a2, _b2;
    const info = await pickAsync(picker, e.offsetX, e.offsetY);
    canvas.dataset.lastPickCss = `${e.offsetX},${e.offsetY}`;
    canvas.dataset.lastPickedHit = info.hit ? (_b2 = (_a2 = info.pickedMesh) == null ? void 0 : _a2.name) != null ? _b2 : "" : "miss";
  });
  const [pickXRatio, pickYRatio] = getPickRatios();
  const pickX = canvas.clientWidth * pickXRatio;
  const pickY = canvas.clientHeight * pickYRatio;
  const pickInfo = await pickAsync(picker, pickX, pickY);
  disposePicker(picker);
  const pickedName = pickInfo.hit ? (_b = (_a = pickInfo.pickedMesh) == null ? void 0 : _a.name) != null ? _b : "" : "miss";
  console.log(`[scene129/lite] GPU pick at (${pickX.toFixed(1)}, ${pickY.toFixed(1)}) \u2192 ${pickedName}`);
  if (pickedName !== "renderMesh") {
    removeFromScene(scene, ground);
  }
  await new Promise((r) => requestAnimationFrame(() => r()));
  canvas.dataset.drawCalls = String(engine.drawCallCount);
  canvas.dataset.initMs = String(performance.now() - __initStart);
  canvas.dataset.pickCss = `${pickX.toPrecision(12)},${pickY.toPrecision(12)}`;
  canvas.dataset.pickedHit = pickedName;
  canvas.dataset.ready = "true";
}
main().catch((err) => {
  console.error(err);
});
