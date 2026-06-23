// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene6.ts (esbuild, target es2017)
// Scene 6 — PBR Gold Sphere — tags: pbr, procedural
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene6-pbr-sphere.js

async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  scene.camera = createArcRotateCamera(0, Math.PI / 2, 5, { x: 0, y: 0, z: 0 });
  attachControl(scene.camera, canvas, scene);
  await loadEnvironment(scene, "https://assets.babylonjs.com/core/environments/environmentSpecular.env", {
    groundTextureUrl: "https://assets.babylonjs.com/core/environments/backgroundGround.png",
    skyboxUrl: "https://assets.babylonjs.com/core/environments/backgroundSkybox.dds",
    skyboxSize: 1e3,
    brdfUrl: "/brdf-lut.png"
  });
  const baseColorTex = createSolidTexture2D(engine, 1, 0.766, 0.336);
  const ormTex = createSolidTexture2D(engine, 1, 0.6, 1);
  const material = createPbrMaterial({
    baseColorTexture: baseColorTex,
    ormTexture: ormTex
  });
  const sphere = createSphere(engine, { segments: 16, diameter: 2 });
  sphere.material = material;
  addToScene(scene, sphere);
  await registerScene(scene);
  await startEngine(engine);
  canvas.dataset.drawCalls = String(engine.drawCallCount);
  canvas.dataset.initMs = String(performance.now() - __initStart);
  canvas.dataset.ready = "true";
}
main().catch(console.error);
