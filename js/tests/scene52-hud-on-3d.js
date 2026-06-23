// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene52.ts (esbuild, target es2017)
// Scene 52 — HUD on 3D — tags: sprites, 2d, hud
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene52-hud-on-3d.js

async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  scene.camera = createArcRotateCamera(-Math.PI / 2, Math.PI / 2, 5, { x: 0, y: 0, z: 0 });
  scene.camera.nearPlane = 1;
  scene.camera.farPlane = 1e4;
  const light = createDirectionalLight([0, -1, 0]);
  light.diffuse = [1, 0, 0];
  light.specular = [0, 1, 0];
  addToScene(scene, light);
  const sphere = createSphere(engine);
  sphere.material = createStandardMaterial();
  addToScene(scene, sphere);
  await registerScene(scene);
  const atlas = await loadSpriteAtlas(engine, getSpriteAtlasDataUrl(), {
    gridSize: [SPRITE_ATLAS_INFO.cellWidthPx, SPRITE_ATLAS_INFO.cellHeightPx],
    sampling: "linear"
  });
  const hud = createSprite2DLayer(atlas, { capacity: 16, depth: "none" });
  addHudSprites(hud, canvas);
  const hudRenderer = createSpriteRenderer(engine, { layers: [hud], clear: false });
  registerSpriteRenderer(hudRenderer);
  onSceneDispose(scene, () => disposeSpriteRenderer(hudRenderer));
  await startEngine(engine);
  canvas.dataset.drawCalls = String(engine.drawCallCount);
  canvas.dataset.initMs = String(performance.now() - __initStart);
  canvas.dataset.ready = "true";
}
function addHudSprites(layer, canvas) {
  for (let i = 0; i < 8; i++) {
    addSprite2DIndex(layer, {
      positionPx: [70 + i * 44, 58],
      sizePx: [34, 34],
      frame: 8 + i,
      color: i < 5 ? [1, 1, 1, 1] : [0.35, 0.35, 0.35, 1]
    });
  }
  for (let i = 0; i < 4; i++) {
    addSprite2DIndex(layer, {
      positionPx: [canvas.width / 2 - 72 + i * 48, canvas.height / 2 + 92],
      sizePx: [38, 38],
      frame: 16 + i,
      color: i % 2 === 0 ? [1, 1, 1, 1] : [0.7, 1, 0.85, 1]
    });
  }
  addSprite2DIndex(layer, {
    positionPx: [canvas.width / 2, canvas.height / 2],
    sizePx: [56, 56],
    frame: 24,
    color: [1, 0.85, 0.65, 1]
  });
}
main().catch((err) => {
  console.error(err);
});
