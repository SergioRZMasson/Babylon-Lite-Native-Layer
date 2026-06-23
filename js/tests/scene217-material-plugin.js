// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene217.ts (esbuild, target es2017)
// Scene 217 — Material Plugin (BlackAndWhite) — tags: material, plugin, pbr, standard
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene217-material-plugin.js

const blackAndWhite = {
  name: "BlackAndWhite",
  getCustomCode(shaderType) {
    if (shaderType !== "fragment") {
      return null;
    }
    return {
      CUSTOM_FRAGMENT_BEFORE_FRAGCOLOR: `
let bwLuma = dot(color.rgb, vec3<f32>(0.3, 0.59, 0.11));
color.r = bwLuma;
color.g = bwLuma;
color.b = bwLuma;`
    };
  }
};
async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  scene.clearColor = { r: 0.35, g: 0.45, b: 0.6, a: 1 };
  scene.camera = createArcRotateCamera(-Math.PI / 2, Math.PI / 2.5, 7, { x: 0, y: 0, z: 0 });
  attachControl(scene.camera, canvas, scene);
  const hemi = createHemisphericLight([0, 1, 0], 0.7);
  addToScene(scene, hemi);
  const dir = createDirectionalLight([-0.5, -1, -0.6], 0.9);
  addToScene(scene, dir);
  const pbrMat = createPbrMaterial({
    baseColorTexture: createSolidTexture2D(engine, 0.85, 0.2, 0.15, 1),
    ormTexture: createSolidTexture2D(engine, 1, 0.4, 0, 1),
    usePhysicalLightFalloff: false
  });
  pbrMat.plugins = [blackAndWhite];
  const sphere = createSphere(engine, { diameter: 2.2, segments: 48 });
  sphere.position.set(-1.5, 0, 0);
  sphere.material = pbrMat;
  addToScene(scene, sphere);
  const stdMat = createStandardMaterial();
  stdMat.diffuseColor = [0.15, 0.3, 0.85];
  stdMat.specularColor = [0.4, 0.4, 0.4];
  stdMat.plugins = [blackAndWhite];
  const box = createBox(engine, 2);
  box.position.set(1.5, 0, 0);
  box.material = stdMat;
  addToScene(scene, box);
  enableMaterialPlugins(scene);
  await registerScene(scene);
  await startEngine(engine);
  canvas.dataset.drawCalls = String(engine.drawCallCount);
  canvas.dataset.initMs = String(performance.now() - __initStart);
  canvas.dataset.ready = "true";
}
main().catch(console.error);
