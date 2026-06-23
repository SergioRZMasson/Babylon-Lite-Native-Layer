// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene210.ts (esbuild, target es2017)
// Scene 210 — XMP Metadata Cube — tags: pbr, gltf, xmp, metadata, env, skybox
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene210-xmp-metadata-cube.js

const MODEL_URL = "/models/XmpMetadataRoundedCube.glb";
async function main() {
  var _a, _b, _c;
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  const asset = await loadGltf(engine, MODEL_URL);
  addToScene(scene, asset);
  canvas.dataset.xmpPackets = String((_c = (_b = (_a = asset.xmpMetadata) == null ? void 0 : _a.packets) == null ? void 0 : _b.length) != null ? _c : 0);
  const cam = createArcRotateCamera(-Math.PI / 4, Math.PI / 3, 48, { x: 0, y: 9.95, z: 0 });
  scene.camera = cam;
  attachControl(cam, canvas, scene);
  addToScene(scene, createHemisphericLight([0, 1, 0], 1));
  await registerScene(scene);
  await startEngine(engine);
  canvas.dataset.drawCalls = String(engine.drawCallCount);
  canvas.dataset.initMs = String(performance.now() - __initStart);
  canvas.dataset.ready = "true";
}
main().catch(console.error);
