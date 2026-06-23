// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene21.ts (esbuild, target es2017)
// Scene 21 — PBR Sheen Cloth — tags: pbr, env
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene21-sheen-cloth.js

async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  scene.camera = createArcRotateCamera(-Math.PI / 2, Math.PI / 2.7, 0.14, { x: 0, y: 0, z: 0 });
  scene.camera.nearPlane = 0.01;
  attachControl(scene.camera, canvas, scene);
  const [gltfResult, , sheenTex2D] = await Promise.all([
    loadGltf(engine, "https://models.babylonjs.com/cloth/cloth_meshV1.glb"),
    loadEnvironment(scene, "https://playground.babylonjs.com/textures/country.env", {
      brdfUrl: "/brdf-lut.png",
      skyboxUrl: "https://playground.babylonjs.com/textures/country.env",
      skipGround: true
    }),
    loadTexture2D(engine, "https://playground.babylonjs.com/textures/fire.png", { invertY: false })
  ]);
  addToScene(scene, gltfResult);
  scene.imageProcessing.toneMappingEnabled = false;
  scene.imageProcessing.exposure = 1;
  scene.imageProcessing.contrast = 1;
  const baseColorTex = createSolidTexture2D(engine, 12 / 255, 60 / 255, 222 / 255);
  const ormTex = createSolidTexture2D(engine, 1, 0.8, 0);
  const sheenMat = createPbrMaterial({
    baseColorTexture: baseColorTex,
    ormTexture: ormTex,
    sheen: {
      isEnabled: true,
      color: [1, 1, 1],
      roughness: 0.5,
      intensity: 1,
      texture: sheenTex2D
    }
  });
  for (const m of scene.meshes) {
    m.material = sheenMat;
  }
  await registerScene(scene);
  await startEngine(engine);
  canvas.dataset.drawCalls = String(engine.drawCallCount);
  canvas.dataset.initMs = String(performance.now() - __initStart);
  canvas.dataset.ready = "true";
}
main().catch(console.error);
