// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene13.ts (esbuild, target es2017)
// Scene 13 — PBR Spheres Grid — tags: pbr, gltf
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene13-pbr-spheres.js

async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  addToScene(scene, await loadGltf(engine, "https://assets.babylonjs.com/meshes/PBR_Spheres.glb"));
  await loadEnvironment(scene, "https://assets.babylonjs.com/core/environments/environmentSpecular.env", {
    groundTextureUrl: "https://assets.babylonjs.com/core/environments/backgroundGround.png",
    skipSkybox: true,
    brdfUrl: "/brdf-lut.png"
  });
  const cam = createDefaultCamera(scene);
  attachControl(cam, canvas, scene);
  addToScene(scene, createHemisphericLight([0, 1, 0], 1));
  await registerScene(scene);
  await startEngine(engine);
  canvas.dataset.drawCalls = String(engine.drawCallCount);
  canvas.dataset.initMs = String(performance.now() - __initStart);
  canvas.dataset.ready = "true";
}
main().catch(console.error);
