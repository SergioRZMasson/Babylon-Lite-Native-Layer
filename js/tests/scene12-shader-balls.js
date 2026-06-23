// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene12.ts (esbuild, target es2017)
// Scene 12 — PBR Shader Balls — tags: pbr, gltf
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene12-shader-balls.js

async function scene12(canvas2) {
  const __initStart = performance.now();
  const engine = await createEngine(canvas2);
  const scene = createSceneContext(engine);
  scene.clearColor = { r: 20 / 255, g: 20 / 255, b: 25 / 255, a: 1 };
  scene.camera = createArcRotateCamera(Math.PI / 2, Math.PI / 2, 15, { x: 0, y: 0, z: 0 });
  scene.camera.nearPlane = 0.1;
  attachControl(scene.camera, canvas2, scene);
  const light = createDirectionalLight([0.45, -0.34, -0.83]);
  addToScene(scene, light);
  await loadEnvironment(scene, "/textures/Studio_Softbox_2Umbrellas_cube_specular.env", {
    skipSkybox: true,
    skipGround: true,
    brdfUrl: "/brdf-lut.png"
  });
  scene.envRotationY = 1.9;
  const result = await loadGltf(engine, "https://assets.babylonjs.com/meshes/Demos/pbr_mr_specular/shaderBall_rotation.glb");
  addToScene(scene, result);
  const root = result.entities[0];
  const [reflectanceTex, metallicReflectanceTex] = await Promise.all([
    loadTexture2D(engine, "https://assets.babylonjs.com/meshes/Demos/pbr_mr_specular/reflectanceColorTex.png", {
      mipMaps: false,
      invertY: false
    }),
    loadTexture2D(engine, "https://assets.babylonjs.com/meshes/Demos/pbr_mr_specular/metallicReflectanceTex.png", {
      mipMaps: false,
      invertY: false
    })
  ]);
  const albedoLinear = Math.pow(50 / 255, 2.2);
  const baseColorTex = createSolidTexture2D(engine, albedoLinear, albedoLinear, albedoLinear, 1);
  const ormTex = createSolidTexture2D(engine, 1, 0.15, 0, 1);
  const mrcR = Math.pow(255 / 255, 2.2);
  const mrcG = Math.pow(250 / 255, 2.2);
  const mrcB = Math.pow(250 / 255, 2.2);
  function makeMat(opts) {
    return createPbrMaterial({
      baseColorTexture: baseColorTex,
      ormTexture: ormTex,
      occlusionStrength: 0,
      metallicF0Factor: 0.95,
      metallicReflectanceColor: [mrcR, mrcG, mrcB],
      metallicReflectanceTexture: opts.metallicReflectanceTex,
      reflectanceTexture: opts.reflectanceTex,
      useOnlyMetallicFromMetallicReflectanceTexture: opts.useOnlyMetallic
    });
  }
  const matUpper = makeMat({ metallicReflectanceTex });
  const matMiddle = makeMat({ reflectanceTex });
  const matLower = makeMat({
    metallicReflectanceTex,
    reflectanceTex,
    useOnlyMetallic: true
  });
  function setMaterial(node, mat) {
    for (const child of node.children) {
      if ("children" in child && "rotationQuaternion" in child && !("_gpu" in child)) {
        setMaterial(child, mat);
      } else {
        child.material = mat;
      }
    }
  }
  setMaterial(root, matMiddle);
  const upper = cloneTransformNode(root);
  upper.position.y = 3;
  setMaterial(upper, matUpper);
  addToScene(scene, upper);
  const lower = cloneTransformNode(root);
  lower.position.y = -3;
  setMaterial(lower, matLower);
  addToScene(scene, lower);
  scene.fixedDeltaMs = 16;
  const params = new URLSearchParams(window.location.search);
  const seekTimeParam = parseFloat(params.get("seekTime") || "");
  let frameCount = 0;
  let seekDone = false;
  onBeforeRender(scene, () => {
    frameCount++;
    if (!isNaN(seekTimeParam) && seekTimeParam > 0 && frameCount === 10 && !seekDone) {
      const seekFrame = seekTimeParam * 60;
      for (const g of scene.animationGroups) {
        goToFrame(g, seekFrame);
      }
      seekDone = true;
      canvas2.dataset.animationFrozen = "true";
    }
  });
  await registerScene(scene);
  await startEngine(engine);
  canvas2.dataset.drawCalls = String(engine.drawCallCount);
  canvas2.dataset.initMs = String(performance.now() - __initStart);
  canvas2.dataset.ready = "true";
}
const canvas = document.getElementById("renderCanvas");
if (canvas) {
  void scene12(canvas);
}
