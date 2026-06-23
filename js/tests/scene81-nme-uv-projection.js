// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene81.ts (esbuild, target es2017)
// Scene 81 — NME UV Projection — tags: nme, procedural, texture, uv
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene81-nme-uv-projection.js

async function main() {
  const initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  scene.clearColor = { r: 0, g: 0, b: 0, a: 1 };
  const camera = createArcRotateCamera(-Math.PI * 0.42, Math.PI * 0.42, 4.2, { x: 0, y: 0, z: 0 });
  camera.nearPlane = 0.25;
  camera.farPlane = 100;
  scene.camera = camera;
  attachControl(camera, canvas, scene);
  const atlas = await loadTexture2D(engine, SCENE81_TEXTURE_URL, {
    mipMaps: false,
    minFilter: "nearest",
    magFilter: "nearest"
  });
  const material = await parseNodeMaterialFromSnippet(engine, "", {
    json: SCENE81_NME_JSON,
    textures: { AtlasUV: atlas, TriAtlas: atlas, BiAtlas: atlas }
  });
  const sphere = createSphere(engine, { segments: 48, diameter: 2.6 });
  sphere.material = material;
  addToScene(scene, sphere);
  await registerScene(scene);
  await startEngine(engine);
  canvas.dataset.drawCalls = String(engine.drawCallCount);
  canvas.dataset.initMs = String(performance.now() - initStart);
  canvas.dataset.ready = "true";
}
main().catch((err) => {
  console.error(err);
  const canvas = document.getElementById("renderCanvas");
  if (canvas) {
    canvas.dataset.error = String(err);
  }
});
