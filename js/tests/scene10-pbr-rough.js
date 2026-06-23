// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene10.ts (esbuild, target es2017)
// Scene 10 — PBR Rough Sphere — tags: pbr, procedural
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene10-pbr-rough.js

async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  scene.camera = createArcRotateCamera(0, Math.PI / 2, 5, { x: 0, y: 0, z: 0 });
  addToScene(scene, createHemisphericLight([0, 1, 0], 1));
  const baseColorTex = createSolidTexture2D(engine, 1, 0.766, 0.336);
  const ormTex = createSolidTexture2D(engine, 1, 1, 0);
  const sphere = createSphere(engine, { segments: 16, diameter: 2 });
  sphere.material = createPbrMaterial({
    baseColorTexture: baseColorTex,
    ormTexture: ormTex
  });
  addToScene(scene, sphere);
  await registerScene(scene);
  await startEngine(engine);
  canvas.dataset.drawCalls = String(engine.drawCallCount);
  canvas.dataset.initMs = String(performance.now() - __initStart);
  canvas.dataset.ready = "true";
}
main().catch(console.error);
