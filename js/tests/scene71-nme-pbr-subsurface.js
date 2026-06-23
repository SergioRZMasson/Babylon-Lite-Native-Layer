// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene71.ts (esbuild, target es2017)
// Scene 71 — NME PBR SubSurface — tags: pbr, nme, procedural, env, subsurface
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene71-nme-pbr-subsurface.js

async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  scene.clearColor = { r: 0, g: 0, b: 0, a: 1 };
  scene.camera = createArcRotateCamera(-Math.PI / 2, Math.PI / 2, 7, { x: 0, y: 0, z: 0 });
  scene.camera.nearPlane = 0.1;
  scene.camera.farPlane = 1e3;
  attachControl(scene.camera, canvas, scene);
  await loadEnvironment(scene, "https://assets.babylonjs.com/core/environments/environmentSpecular.env", {
    skipSkybox: true,
    skipGround: true,
    brdfUrl: "/brdf-lut.png"
  });
  scene.imageProcessing.toneMappingEnabled = false;
  scene.imageProcessing.exposure = 1;
  scene.imageProcessing.contrast = 1;
  const hemi = createHemisphericLight([0, 1, 0], 0.35);
  addToScene(scene, hemi);
  const point = createPointLight([0, 2, 4], 20);
  addToScene(scene, point);
  const spot = createSpotLight([0, 1.5, 4], [0, -0.2, -1], Math.PI / 2, 1, 8);
  addToScene(scene, spot);
  const dir = createDirectionalLight([0, -0.5, -1], 3);
  addToScene(scene, dir);
  const sphere = createSphere(engine, { segments: 32, diameter: 2 });
  const material = await parseNodeMaterialFromSnippet(engine, "", { json: SCENE71_NME_JSON });
  sphere.material = material;
  addToScene(scene, sphere);
  await registerScene(scene);
  await startEngine(engine);
  canvas.dataset.drawCalls = String(engine.drawCallCount);
  canvas.dataset.initMs = String(performance.now() - __initStart);
  canvas.dataset.ready = "true";
}
main().catch((err) => {
  console.error(err);
  const canvas = document.getElementById("renderCanvas");
  if (canvas) {
    canvas.dataset.error = String(err);
  }
});
