// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene51.ts (esbuild, target es2017)
// Scene 51 — Soft-Edged Sprite Grid (Premultiplied) — tags: sprites, 2d, premultiplied
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene51-sprite-grid.js

async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const msaaParam = new URLSearchParams(window.location.search).get("msaa");
  const msaaSamples = msaaParam === "4" ? 4 : 1;
  const engine = await createEngine(canvas, { msaaSamples });
  const atlas = await loadSpriteAtlas(engine, getSoftSpriteAtlasDataUrl(), {
    gridSize: [SOFT_SPRITE_ATLAS_INFO.cellWidthPx, SOFT_SPRITE_ATLAS_INFO.cellHeightPx],
    sampling: "linear",
    premultipliedAlpha: true,
    premultiplyOnLoad: true
  });
  const layer = createSprite2DLayer(atlas, { capacity: 256, blendMode: spriteBlendPremultiplied, depth: "none" });
  addDeterministicSpriteGrid(layer, canvas, { frameForIndex: (index) => index % 32 });
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
