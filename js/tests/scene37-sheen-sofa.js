// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene37.ts (esbuild, target es2017)
// Scene 37 — Sheen Wood Leather Sofa — tags: pbr, gltf, env, sheen, specular, texture-transform, webp
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene37-sheen-sofa.js

async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  addToScene(scene, await loadGltf(engine, "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/SheenWoodLeatherSofa/glTF-Binary/SheenWoodLeatherSofa.glb"));
  await loadEnvironment(scene, "https://assets.babylonjs.com/environments/environmentSpecular.env", {
    skipSkybox: true,
    skipGround: true,
    brdfUrl: "/brdf-lut.png"
  });
  const cam = createDefaultCamera(scene);
  cam.alpha += Math.PI;
  attachControl(cam, canvas, scene);
  await registerScene(scene);
  await startEngine(engine);
  canvas.dataset.drawCalls = String(engine.drawCallCount);
  canvas.dataset.camAlpha = String(cam.alpha);
  canvas.dataset.camBeta = String(cam.beta);
  canvas.dataset.camRadius = String(cam.radius);
  canvas.dataset.camTarget = `${cam.target.x},${cam.target.y},${cam.target.z}`;
  canvas.dataset.camFov = String(cam.fov);
  canvas.dataset.initMs = String(performance.now() - __initStart);
  canvas.dataset.ready = "true";
}
main().catch(console.error);
