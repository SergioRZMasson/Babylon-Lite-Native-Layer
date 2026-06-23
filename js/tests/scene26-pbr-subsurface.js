// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene26.ts (esbuild, target es2017)
// Scene 26 — PBR Subsurface — tags: pbr, gltf, env
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene26-pbr-subsurface.js

async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  scene.imageProcessing.exposure = 1.6;
  scene.imageProcessing.toneMappingEnabled = true;
  scene.imageProcessing.toneMappingType = "aces";
  const params = new URLSearchParams(window.location.search);
  const seekTimeParam = parseFloat(params.get("seekTime") || "");
  const root = "https://assets.babylonjs.com/meshes/Georgia-Tech-Dragon/";
  const [container, thicknessTexture] = await Promise.all([loadGltf(engine, root + "dragonUV.glb"), loadTexture2D(engine, root + "thicknessMap.png", { invertY: false })]);
  const albedoR = Math.pow(64 / 255, 2.2);
  const albedoG = Math.pow(247 / 255, 2.2);
  const albedoB = Math.pow(224 / 255, 2.2);
  const baseColorTex = createSolidTexture2D(engine, albedoR, albedoG, albedoB);
  const ormTex = createSolidTexture2D(engine, 1, 0.16, 0);
  const dragonMaterial = createPbrMaterial({
    baseColorTexture: baseColorTex,
    ormTexture: ormTex,
    enableSpecularAA: true,
    subsurface: {
      translucency: {
        intensity: 1,
        color: [1, 1, 1],
        diffusionDistance: [1, 1, 1]
      },
      thickness: {
        texture: thicknessTexture,
        min: 0,
        max: 2.2
      }
    }
  });
  addToScene(scene, container);
  for (const m of scene.meshes) {
    m.material = dragonMaterial;
  }
  const lightSphere = createSphere(engine, { segments: 32, diameter: 5e-3 });
  lightSphere.boundMin = [0, 0.02 - 25e-4, -0.2 - 25e-4];
  lightSphere.boundMax = [0, 0.02 + 25e-4, -0.2 + 25e-4];
  lightSphere.material = createPbrMaterial({
    baseColorTexture: createSolidTexture2D(engine, 1, 1, 1),
    ormTexture: createSolidTexture2D(engine, 1, 1, 0),
    emissiveColor: [1, 1, 1]
  });
  addToScene(scene, lightSphere);
  const cam = createDefaultCamera(scene);
  cam.alpha += Math.PI;
  attachControl(cam, canvas, scene);
  const pointLight = createPointLight([0, 0.02, -0.2], 0.01);
  addToScene(scene, pointLight);
  await loadDdsEnvironment(scene, "https://playground.babylonjs.com/textures/environment.dds", {
    brdfUrl: "/brdf-lut.png"
  });
  const skybox = createBox(engine, 5);
  skybox.material = createPbrMaterial({
    baseColorTexture: createSolidTexture2D(engine, 1, 1, 1),
    ormTexture: createSolidTexture2D(engine, 1, 0.3, 1),
    // occ=1, rough=0.3, metal=1 → F0=(1,1,1)
    environmentIntensity: 1.008,
    directIntensity: 0,
    doubleSided: true,
    skyboxMode: true
  });
  const syncSkybox = () => {
    const w = cam.worldMatrix;
    skybox.position.set(w[12], w[13], w[14]);
  };
  syncSkybox();
  onBeforeRender(scene, syncSkybox);
  addToScene(scene, skybox);
  let rotY = 0;
  const updateOrbit = () => {
    const cosR = Math.cos(rotY);
    const sinR = Math.sin(rotY);
    const px = 0, pz = -0.2;
    const wx = px * cosR + pz * sinR;
    const wz = -px * sinR + pz * cosR;
    pointLight.position.x = wx;
    pointLight.position.z = wz;
    lightSphere.position.x = wx;
    lightSphere.position.y = 0.02;
    lightSphere.position.z = wz;
  };
  if (!isNaN(seekTimeParam)) {
    if (seekTimeParam > 0) {
      const seekFrames = seekTimeParam * 60;
      for (let f = 0; f < seekFrames; f++) {
        rotY += 0.01;
      }
      updateOrbit();
    }
    canvas.dataset.animationFrozen = "true";
  } else {
    onBeforeRender(scene, () => {
      rotY += 0.01;
      updateOrbit();
    });
  }
  await registerScene(scene);
  await startEngine(engine);
  canvas.dataset.drawCalls = String(engine.drawCallCount);
  canvas.dataset.initMs = String(performance.now() - __initStart);
  canvas.dataset.ready = "true";
}
void main();
