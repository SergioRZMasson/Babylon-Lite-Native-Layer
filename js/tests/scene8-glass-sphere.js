// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene8.ts (esbuild, target es2017)
// Scene 8 — HDR Glass Sphere — tags: pbr, procedural, env
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene8-glass-sphere.js

async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  scene.camera = createArcRotateCamera(-Math.PI / 4, Math.PI / 2.5, 200, { x: 0, y: 0, z: 0 });
  scene.camera.nearPlane = 0.1;
  attachControl(scene.camera, canvas, scene);
  const light = createPointLight({ x: 0, y: 40, z: 0 });
  addToScene(scene, light);
  await loadHdrEnvironment(scene, "https://playground.babylonjs.com/textures/room.hdr", {
    faceSize: 512,
    useCubemapSkybox: true,
    skipGround: true
  });
  scene.imageProcessing.exposure = 0.66;
  scene.imageProcessing.contrast = 1.66;
  const baseColorTex = createSolidTexture2D(engine, 0.95, 0.95, 0.95, 1);
  const ormTex = createSolidTexture2D(engine, 1, 0, 0);
  const sphere = createSphere(engine, { segments: 48, diameter: 80 });
  sphere.material = createPbrMaterial({
    baseColorTexture: baseColorTex,
    ormTexture: ormTex,
    alpha: 0.5,
    environmentIntensity: 0.7,
    directIntensity: 0,
    reflectance: 0.2
  });
  addToScene(scene, sphere);
  await registerScene(scene);
  await startEngine(engine);
  canvas.dataset.drawCalls = String(engine.drawCallCount);
  canvas.dataset.initMs = String(performance.now() - __initStart);
  canvas.dataset.ready = "true";
}
main().catch(console.error);
