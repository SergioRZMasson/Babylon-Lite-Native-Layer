// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene216.ts (esbuild, target es2017)
// Scene 216 — PBR Fog — tags: pbr, fog
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene216-pbr-fog.js

async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  scene.clearColor = { r: 0.7, g: 0.75, b: 0.82, a: 1 };
  scene.camera = createArcRotateCamera(0.4, 1.2, 20, { x: -10, y: 0, z: 0 });
  scene.camera.nearPlane = 1;
  scene.camera.farPlane = 1e4;
  addToScene(scene, createHemisphericLight([0, 1, 0], 1));
  setFog(scene, { mode: 3, density: 0, start: 12, end: 60, color: [0.7, 0.75, 0.82] });
  const baseColorTex = createSolidTexture2D(engine, 1, 0.766, 0.336);
  const ormTex = createSolidTexture2D(engine, 1, 1, 0);
  const mat = createPbrMaterial({ baseColorTexture: baseColorTex, ormTexture: ormTex });
  for (let i = 0; i < 10; i++) {
    const box = createBox(engine);
    box.position.set(-i * 5, 0, 0);
    box.material = mat;
    addToScene(scene, box);
  }
  await registerScene(scene);
  await startEngine(engine);
  canvas.dataset.drawCalls = String(engine.drawCallCount);
  canvas.dataset.initMs = String(performance.now() - __initStart);
  canvas.dataset.ready = "true";
}
main().catch(console.error);
