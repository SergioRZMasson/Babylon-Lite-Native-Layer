// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene93.ts (esbuild, target es2017)
// Scene 93 — Sprite Custom Shader (palette remap) — tags: sprites, 2d, shader
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene93-sprite-customshader-palette.js

async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const atlas = await loadSpriteAtlas(engine, getCutoutSpriteAtlasDataUrl(), {
    gridSize: [CUTOUT_SPRITE_ATLAS_INFO.cellWidthPx, CUTOUT_SPRITE_ATLAS_INFO.cellHeightPx],
    sampling: "nearest"
  });
  const paletteTexture = createTexture2DFromPixels(engine, buildColormapPalette(), PALETTE_WIDTH, 1);
  const customShader = createSprite2DCustomShader({
    fragment: `let texel = textureSample(atlasTex, atlasSamp, in.uv);
let pal = textureSample(paletteTex, paletteSamp, vec2<f32>(texel.r, 0.5));
return vec4<f32>(pal.rgb, texel.a) * in.tint;`,
    extraTextures: [{ name: "palette", texture: paletteTexture }]
  });
  const layer = createSprite2DLayer(atlas, { capacity: 256, depth: "none", customShader });
  addDeterministicSpriteGrid(layer, canvas, { frameForIndex: (index) => index % 8 });
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
