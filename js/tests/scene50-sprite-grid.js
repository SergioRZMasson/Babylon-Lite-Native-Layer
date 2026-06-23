// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene50.ts (esbuild, target es2017)
// Scene 50 — Sprite Grid — tags: sprites, 2d
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene50-sprite-grid.js

async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const atlas = await loadSpriteAtlas(engine, getSpriteAtlasDataUrl(), {
    gridSize: [SPRITE_ATLAS_INFO.cellWidthPx, SPRITE_ATLAS_INFO.cellHeightPx],
    sampling: "linear"
  });
  const layer = createSprite2DLayer(atlas, { capacity: 256, depth: "none" });
  addDeterministicSpriteGrid(layer, canvas, { frameForIndex: (index) => 8 + index % 16 });
  const sr = createSpriteRenderer(engine, {
    layers: [layer],
    clearValue: { r: 0.07, g: 0.08, b: 0.12, a: 1 }
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
