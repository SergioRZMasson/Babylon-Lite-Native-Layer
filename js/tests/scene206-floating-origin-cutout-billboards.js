// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene206.ts (esbuild, target es2017)
// Scene 206 - LWR Cutout Billboards — tags: hpm, lwr, floating-origin, sprites, billboards, depth
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene206-floating-origin-cutout-billboards.js

const OFFSET = 5e6;
const CAMERA_ALPHA = -Math.PI / 2;
const CAMERA_BETA = 1.52797;
const CAMERA_RADIUS = 7.00643;
const CAMERA_TARGET = { x: OFFSET, y: 0.75, z: OFFSET + 1 };
async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas, { useHighPrecisionMatrix: true, useFloatingOrigin: true });
  const scene = createSceneContext(engine);
  scene.clearColor = { r: 0.09, g: 0.11, b: 0.14, a: 1 };
  const cam = createArcRotateCamera(CAMERA_ALPHA, CAMERA_BETA, CAMERA_RADIUS, CAMERA_TARGET);
  cam.fov = 0.72;
  cam.nearPlane = 0.5;
  cam.farPlane = 80;
  scene.camera = cam;
  addToScene(scene, createHemisphericLight([0, 1, 0], 0.9));
  const addBoxAt = (position, scale, color) => {
    const box = createBox(engine, 1);
    box.position.set(position[0], position[1], position[2]);
    box.scaling.set(scale[0], scale[1], scale[2]);
    const material = createStandardMaterial();
    material.diffuseColor = color;
    box.material = material;
    addToScene(scene, box);
  };
  addBoxAt([OFFSET, 0.65, OFFSET + 2.45], [5.2, 2.45, 0.12], [0.18, 0.24, 0.32]);
  addBoxAt([OFFSET - 1.45, 0.7, OFFSET + 2.25], [0.42, 2.15, 0.18], [0.85, 0.22, 0.18]);
  addBoxAt([OFFSET, 0.7, OFFSET + 2.18], [0.42, 2.15, 0.18], [0.22, 0.68, 0.34]);
  addBoxAt([OFFSET + 1.45, 0.7, OFFSET + 2.25], [0.42, 2.15, 0.18], [0.28, 0.45, 0.92]);
  addBoxAt([OFFSET, -0.75, OFFSET + 0.95], [4.8, 0.16, 3.4], [0.38, 0.34, 0.27]);
  addBoxAt([OFFSET + 1.3, 0.05, OFFSET - 0.05], [0.95, 0.95, 0.95], [0.63, 0.55, 0.42]);
  const atlas = await loadSpriteAtlas(engine, getCutoutSpriteAtlasDataUrl(), {
    gridSize: [CUTOUT_SPRITE_ATLAS_INFO.cellWidthPx, CUTOUT_SPRITE_ATLAS_INFO.cellHeightPx],
    sampling: "nearest"
  });
  const billboards = createFacingBillboardSystem(atlas, { capacity: 5, blendMode: billboardBlendCutout, alphaCutoff: 0.5 });
  addBillboardSpriteIndex(billboards, {
    position: [OFFSET, 0.75, OFFSET],
    sizeWorld: [2.35, 2.35],
    frame: 3
  });
  addBillboardSpriteIndex(billboards, {
    position: [OFFSET - 1, 0.65, OFFSET + 1],
    sizeWorld: [1.75, 2.1],
    frame: 0
  });
  addBillboardSpriteIndex(billboards, {
    position: [OFFSET + 1, 0.45, OFFSET + 1],
    sizeWorld: [1.45, 1.55],
    frame: 1,
    rotation: 0.1
  });
  addBillboardSpriteIndex(billboards, {
    position: [OFFSET - 1.5, -0.15, OFFSET - 0.5],
    sizeWorld: [1.25, 1.55],
    frame: 2,
    rotation: -0.12
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
