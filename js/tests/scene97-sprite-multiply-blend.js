// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene97.ts (esbuild, target es2017)
// Scene 97 — Sprite Multiply Blend — tags: sprites, 2d, blend
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene97-sprite-multiply-blend.js

const SCENE97_CLEAR = { r: 0.82, g: 0.8, b: 0.86, a: 1 };
async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const atlas = await loadSpriteAtlas(engine, getSpriteAtlasDataUrl(), {
    gridSize: [SPRITE_ATLAS_INFO.cellWidthPx, SPRITE_ATLAS_INFO.cellHeightPx],
    sampling: "linear"
  });
  const layer = createSprite2DLayer(atlas, { capacity: 256, depth: "none", blendMode: spriteBlendMultiply });
  addDeterministicSpriteGrid(layer, canvas, { frameForIndex: (index) => 8 + index % 16 });
  const sr = createSpriteRenderer(engine, {
    layers: [layer],
    clearValue: SCENE97_CLEAR
  });
  registerSpriteRenderer(sr);
  await startEngine(engine);
  canvas.dataset.drawCalls = String(engine.drawCallCount);
  canvas.dataset.initMs = String(performance.now() - __initStart);
  canvas.dataset.ready = "true";
}
main().catch((err) => {
  console.error(err);
});
