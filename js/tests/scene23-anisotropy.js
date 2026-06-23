// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene23.ts (esbuild, target es2017)
// Scene 23 — PBR Anisotropy — tags: pbr, env
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene23-anisotropy.js

async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  const cam = createArcRotateCamera(0, Math.PI / 2, 5, { x: 0, y: 0, z: 0 });
  scene.camera = cam;
  attachControl(cam, canvas, scene);
  const params = new URLSearchParams(window.location.search);
  const seekTimeParam = parseFloat(params.get("seekTime") || "");
  let a = 0;
  if (!isNaN(seekTimeParam) && seekTimeParam > 0) {
    const seekFrames = seekTimeParam * 60;
    a = seekFrames * 0.01;
  }
  const initialIntensity = Math.cos(a) * 0.5 + 0.5;
  const baseColorTex = createSolidTexture2D(engine, 1, 1, 1);
  const ormTex = createSolidTexture2D(engine, 1, 0, 1);
  const material = createPbrMaterial({
    baseColorTexture: baseColorTex,
    ormTexture: ormTex,
    anisotropy: {
      isEnabled: true,
      intensity: initialIntensity,
      direction: [1, 0]
    }
  });
  installPbrTracking(material);
  const sphere = createSphere(engine, { segments: 128, diameter: 2 });
  sphere.material = material;
  addToScene(scene, sphere);
  await loadEnvironment(scene, "https://assets.babylonjs.com/core/environments/environmentSpecular.env", {
    groundTextureUrl: "https://assets.babylonjs.com/core/environments/backgroundGround.png",
    skyboxUrl: "https://assets.babylonjs.com/core/environments/backgroundSkybox.dds",
    brdfUrl: "/brdf-lut.png"
  });
  if (!isNaN(seekTimeParam)) {
    canvas.dataset.animationFrozen = "true";
  }
  if (isNaN(seekTimeParam)) {
    onBeforeRender(scene, () => {
      a += 0.01;
      material.anisotropy.intensity = Math.cos(a) * 0.5 + 0.5;
    });
  }
  await registerScene(scene);
  await startEngine(engine);
  canvas.dataset.drawCalls = String(engine.drawCallCount);
  canvas.dataset.initMs = String(performance.now() - __initStart);
  canvas.dataset.ready = "true";
}
void main();
