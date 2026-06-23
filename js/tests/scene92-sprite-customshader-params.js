// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene92.ts (esbuild, target es2017)
// Scene 92 — Sprite Custom Shader (params tint) — tags: sprites, 2d, shader
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene92-sprite-customshader-params.js

const SCENE92_PARAMS = [1, 0.78, 0.55, 1];
async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const atlas = await loadSpriteAtlas(engine, getSpriteAtlasDataUrl(), {
    gridSize: [SPRITE_ATLAS_INFO.cellWidthPx, SPRITE_ATLAS_INFO.cellHeightPx],
    sampling: "linear"
  });
  const customShader = createSprite2DCustomShader({
    fragment: `return textureSample(atlasTex, atlasSamp, in.uv) * in.tint * fx.params;`
  });
  const layer = createSprite2DLayer(atlas, { capacity: 256, depth: "none", customShader });
  setSprite2DShaderParams(layer, SCENE92_PARAMS);
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
