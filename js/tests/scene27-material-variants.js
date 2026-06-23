// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene27.ts (esbuild, target es2017)
// Scene 27 — Material Variants — tags: pbr, gltf, variants
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene27-material-variants.js

const MODEL_URL = "https://brave-engine-bucket.s3.ap-southeast-1.amazonaws.com/s3-public/assets/models/props/var_Refrigerator.glb";
async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  const container = await loadGltf(engine, MODEL_URL);
  selectVariant(container, "White");
  addToScene(scene, container);
  const cam = createArcRotateCamera(2.372, 1, 5, { x: 0, y: 1, z: 0 });
  cam.nearPlane = 0.01;
  scene.camera = cam;
  attachControl(cam, canvas, scene);
  addToScene(scene, createHemisphericLight([0, 1, 0], 5));
  await registerScene(scene);
  await startEngine(engine);
  canvas.dataset.drawCalls = String(engine.drawCallCount);
  canvas.dataset.initMs = String(performance.now() - __initStart);
  canvas.dataset.ready = "true";
}
main().catch(console.error);
