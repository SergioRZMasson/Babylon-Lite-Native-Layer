// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene96.ts (esbuild, target es2017)
// Scene 96 — Sprite uvOffset Parallax — tags: sprites, 2d, uvoffset
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene96-sprite-uvoffset-parallax.js

async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const atlas = await loadSpriteAtlas(engine, getScrollTileDataUrl(), {
    gridSize: [SCROLL_TILE_SIZE, SCROLL_TILE_SIZE],
    sampling: "nearest",
    textureOptions: { addressModeU: "repeat", addressModeV: "repeat" }
  });
  const layer = createSprite2DLayer(atlas, { capacity: SCENE96_COLS * SCENE96_ROWS, depth: "none", uvScroll: true });
  const gridWidthPx = SCENE96_COLS * SCROLL_TILE_SIZE;
  const gridHeightPx = SCENE96_ROWS * SCROLL_TILE_SIZE;
  const originX = (canvas.width - gridWidthPx) / 2 + SCROLL_TILE_SIZE / 2;
  const originY = (canvas.height - gridHeightPx) / 2 + SCROLL_TILE_SIZE / 2;
  for (let row = 0; row < SCENE96_ROWS; row++) {
    const offset = SCENE96_BAND_OFFSETS[scene96BandForRow(row)];
    for (let col = 0; col < SCENE96_COLS; col++) {
      addSprite2DIndex(layer, {
        positionPx: [originX + col * SCROLL_TILE_SIZE, originY + row * SCROLL_TILE_SIZE],
        sizePx: [SCROLL_TILE_SIZE, SCROLL_TILE_SIZE],
        frame: 0,
        uvOffset: [offset[0], offset[1]]
      });
    }
  }
  const sr = createSpriteRenderer(engine, {
    layers: [layer],
    clearValue: { r: 0.05, g: 0.06, b: 0.09, a: 1 }
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
