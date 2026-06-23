// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene53.ts (esbuild, target es2017)
// Scene 53 — Depth-Hosted Sprites Mixed With 3D — tags: sprites, 2d, depth
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene53-depth-hosted-sprites.js

const DESIGN_HEIGHT = 720;
const SPRITE_SIZE = 180;
const SPRITE_SPACING = 200;
async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  scene.camera = createArcRotateCamera(-Math.PI / 2, Math.PI / 2, 8, { x: 0, y: 0, z: 0 });
  scene.camera.nearPlane = 1;
  scene.camera.farPlane = 100;
  addToScene(scene, createHemisphericLight([0, 1, 0], 1));
  const frontBox = createBox(engine, 2);
  frontBox.position.set(-1.5, 0, -2);
  const frontMat = createStandardMaterial();
  frontMat.diffuseColor = [0.85, 0.25, 0.25];
  frontBox.material = frontMat;
  addToScene(scene, frontBox);
  const backBox = createBox(engine, 2);
  backBox.position.set(1.5, 0, 2);
  const backMat = createStandardMaterial();
  backMat.diffuseColor = [0.25, 0.4, 0.85];
  backBox.material = backMat;
  addToScene(scene, backBox);
  const atlas = await loadSpriteAtlas(engine, getSpriteAtlasDataUrl(), {
    gridSize: [SPRITE_ATLAS_INFO.cellWidthPx, SPRITE_ATLAS_INFO.cellHeightPx],
    sampling: "linear"
  });
  const sprites = createSprite2DLayer(atlas, {
    capacity: 4,
    depth: "test-write"
  });
  const spriteIndices = addPerInstanceZSprites(sprites, canvas);
  let lastLayoutWidth = canvas.width;
  let lastLayoutHeight = canvas.height;
  onBeforeRender(scene, () => {
    if (canvas.width === lastLayoutWidth && canvas.height === lastLayoutHeight) {
      return;
    }
    lastLayoutWidth = canvas.width;
    lastLayoutHeight = canvas.height;
    updatePerInstanceZSprites(sprites, spriteIndices, canvas);
  });
  addDepthHostedSpriteLayer(scene, sprites);
  await registerScene(scene);
  await startEngine(engine);
  canvas.dataset.drawCalls = String(engine.drawCallCount);
  canvas.dataset.initMs = String(performance.now() - __initStart);
  canvas.dataset.ready = "true";
}
function addPerInstanceZSprites(layer, canvas) {
  const layout = getSpriteLayout(canvas);
  const a = addSprite2DIndex(layer, {
    positionPx: layout.a.position,
    sizePx: layout.size,
    frame: 24,
    // tally digit "0"
    color: [1, 0.95, 0.4, 1],
    z: 0.6
  });
  const b = addSprite2DIndex(layer, {
    positionPx: layout.b.position,
    sizePx: layout.size,
    frame: 25,
    // tally digit "1"
    color: [0.4, 0.9, 1, 1],
    z: 0.87
  });
  const c = addSprite2DIndex(layer, {
    positionPx: layout.c.position,
    sizePx: layout.size,
    frame: 26,
    // tally digit "2"
    color: [1, 0.5, 0.9, 1],
    z: 0.95
  });
  return [a, b, c];
}
function updatePerInstanceZSprites(layer, [a, b, c], canvas) {
  const layout = getSpriteLayout(canvas);
  updateSprite2DIndex(layer, a, { positionPx: layout.a.position, sizePx: layout.size });
  updateSprite2DIndex(layer, b, { positionPx: layout.b.position, sizePx: layout.size });
  updateSprite2DIndex(layer, c, { positionPx: layout.c.position, sizePx: layout.size });
}
function getSpriteLayout(canvas) {
  const scale = canvas.height / DESIGN_HEIGHT;
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const size = SPRITE_SIZE * scale;
  const dx = SPRITE_SPACING * scale;
  return {
    a: { position: [cx - dx, cy] },
    b: { position: [cx, cy] },
    c: { position: [cx + dx, cy] },
    size: [size, size]
  };
}
main().catch((err) => {
  console.error(err);
});
