// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene19.ts (esbuild, target es2017)
// Scene 19 — PBR Clearcoat — tags: pbr, env
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene19-clearcoat.js

async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  scene.clearColor = { r: 0, g: 0, b: 0, a: 1 };
  scene.camera = createArcRotateCamera(-Math.PI / 2, Math.PI / 2, Math.sqrt(12), { x: 0, y: 0, z: 0 });
  attachControl(scene.camera, canvas, scene);
  addToScene(scene, createHemisphericLight([0, 1, 0], 0.7));
  await loadDdsEnvironment(scene, "https://playground.babylonjs.com/textures/environment.dds", {
    brdfUrl: "/brdf-lut.png"
  });
  const sphere = createSphere(engine, { segments: 16, diameter: 2 });
  const baseColorTex = createSolidTexture2D(engine, 1, 1, 1);
  const ormTex = createSolidTexture2D(engine, 1, 1, 0);
  sphere.material = createPbrMaterial({
    baseColorTexture: baseColorTex,
    ormTexture: ormTex,
    clearCoat: {
      isEnabled: true,
      intensity: 1,
      roughness: 0,
      indexOfRefraction: 2
    }
  });
  addToScene(scene, sphere);
  await registerScene(scene);
  await startEngine(engine);
  canvas.dataset.drawCalls = String(engine.drawCallCount);
  canvas.dataset.initMs = String(performance.now() - __initStart);
  canvas.dataset.ready = "true";
}
void main();
