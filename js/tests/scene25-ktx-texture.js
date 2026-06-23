// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene25.ts (esbuild, target es2017)
// Scene 25 — KTX Texture — tags: std, procedural
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene25-ktx-texture.js

async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  const cam = createFreeCamera({ x: 0, y: 5, z: -10 }, { x: 0, y: 0, z: 0 });
  scene.camera = cam;
  attachFreeControl(cam, canvas, scene);
  const light = createHemisphericLight([0, 1, 0], 0.7);
  addToScene(scene, light);
  const ground = createGround(engine, { width: 6, height: 6, subdivisions: 2 });
  const groundMat = createStandardMaterial();
  ground.material = groundMat;
  groundMat.diffuseTexture = await loadKtxTexture2D(
    engine,
    "https://raw.githubusercontent.com/Vinc3r/BJS-KTX-textures/master/BJS/UVgrid.png",
    ["-astc.ktx", "-dxt.ktx", "-etc2.ktx"]
  );
  groundMat.uvScale = [2, 2];
  addToScene(scene, ground);
  await registerScene(scene);
  await startEngine(engine);
  canvas.dataset.drawCalls = String(engine.drawCallCount);
  canvas.dataset.initMs = String(performance.now() - __initStart);
  canvas.dataset.ready = "true";
}
main().catch(console.error);
