// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene36.ts (esbuild, target es2017)
// Scene 36 — Basis Universal Texture — tags: std, procedural, basis
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene36-basis-texture.js

async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  scene.camera = createArcRotateCamera(3 * Math.PI / 2, Math.PI / 2, 60, { x: 0, y: 0, z: 0 });
  attachControl(scene.camera, canvas, scene);
  addToScene(scene, createHemisphericLight([0, 1, 0], 0.7));
  const basisTex = await loadBasisTexture2D(engine, "https://playground.babylonjs.com/textures/plane.basis");
  const mat = createStandardMaterial();
  mat.diffuseTexture = basisTex;
  mat.emissiveTexture = basisTex;
  const box = createBox(engine, 30);
  box.scaling.x = 768 / 512;
  box.material = mat;
  addToScene(scene, box);
  await registerScene(scene);
  await startEngine(engine);
  canvas.dataset.drawCalls = String(engine.drawCallCount);
  canvas.dataset.initMs = String(performance.now() - __initStart);
  canvas.dataset.ready = "true";
}
main().catch(console.error);
