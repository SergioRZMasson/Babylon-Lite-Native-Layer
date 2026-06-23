// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene205.ts (esbuild, target es2017)
// Scene 205 - LWR Facing Billboards — tags: hpm, lwr, floating-origin, sprites, billboards, depth
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene205-floating-origin-facing-billboards.js

const OFFSET = 5e6;
const CAMERA_ALPHA = -Math.PI / 3;
async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas, { useHighPrecisionMatrix: true, useFloatingOrigin: true });
  const scene = createSceneContext(engine);
  scene.clearColor = { r: 0.16, g: 0.18, b: 0.22, a: 1 };
  const cam = createArcRotateCamera(CAMERA_ALPHA, 1.35, 8, { x: OFFSET + 0.2, y: 0.05, z: OFFSET });
  cam.nearPlane = 1;
  cam.farPlane = 100;
  scene.camera = cam;
  addToScene(scene, createHemisphericLight([0, 1, 0], 0.9));
  const centerBox = createBox(engine, 1.65);
  centerBox.position.set(OFFSET, -0.05, OFFSET - 1.05);
  const centerMaterial = createStandardMaterial();
  centerMaterial.diffuseColor = [0.5, 0.55, 0.62];
  centerBox.material = centerMaterial;
  addToScene(scene, centerBox);
  const sideBox = createBox(engine, 0.85);
  sideBox.position.set(OFFSET + 1.65, -0.65, OFFSET + 0.55);
  const sideMaterial = createStandardMaterial();
  sideMaterial.diffuseColor = [0.26, 0.42, 0.72];
  sideBox.material = sideMaterial;
  addToScene(scene, sideBox);
  const atlas = await loadSpriteAtlas(engine, getSpriteAtlasDataUrl(), {
    gridSize: [SPRITE_ATLAS_INFO.cellWidthPx, SPRITE_ATLAS_INFO.cellHeightPx],
    sampling: "linear"
  });
  const billboards = createFacingBillboardSystem(atlas, { capacity: 6 });
  addBillboardSpriteIndex(billboards, {
    position: [OFFSET - 1.5, 0.7, OFFSET - 2],
    sizeWorld: [1.25, 0.8],
    frame: 8,
    color: [1, 1, 1, 0.95]
  });
  addBillboardSpriteIndex(billboards, {
    position: [OFFSET, 0.05, OFFSET],
    sizeWorld: [1.65, 1.05],
    frame: 13,
    color: [1, 1, 1, 0.9]
  });
  addBillboardSpriteIndex(billboards, {
    position: [OFFSET + 1.5, -0.25, OFFSET + 1.5],
    sizeWorld: [1.35, 0.95],
    frame: 18,
    color: [1, 1, 1, 0.88],
    flipX: true
  });
  addBillboardSpriteIndex(billboards, {
    position: [OFFSET - 0.5, -0.95, OFFSET + 1],
    sizeWorld: [0.95, 1.25],
    frame: 26,
    pivot: [0.5, 0.62],
    color: [1, 1, 1, 0.82],
    flipY: true
  });
  addFacingBillboardSystem(scene, billboards);
  await registerScene(scene);
  await startEngine(engine);
  canvas.dataset.drawCalls = String(engine.drawCallCount);
  canvas.dataset.initMs = String(performance.now() - __initStart);
  canvas.dataset.useHighPrecisionMatrix = String(engine.useHighPrecisionMatrix);
  canvas.dataset.useFloatingOrigin = "true";
  canvas.dataset.offset = String(OFFSET);
  canvas.dataset.ready = "true";
}
main().catch((err) => {
  console.error(err);
});
