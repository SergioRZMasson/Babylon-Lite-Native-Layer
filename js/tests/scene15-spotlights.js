// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene15.ts (esbuild, target es2017)
// Scene 15 — SpotLights + Ground — tags: std, procedural
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene15-spotlights.js

async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  scene.camera = createArcRotateCamera(-Math.PI / 2, Math.PI / 4, 5, { x: 0, y: 0, z: 0 });
  scene.camera.nearPlane = 1;
  scene.camera.farPlane = 1e4;
  attachControl(scene.camera, canvas, scene);
  const spot0 = createSpotLight([-1, 1, -1], [0, -1, 0], Math.PI / 2, 10);
  spot0.diffuse = [1, 0, 0];
  spot0.specular = [0, 1, 0];
  addToScene(scene, spot0);
  const spot1 = createSpotLight([1, 1, 1], [0, -1, 0], Math.PI / 2, 50);
  spot1.diffuse = [0, 1, 0];
  spot1.specular = [0, 1, 0];
  addToScene(scene, spot1);
  const ground = createGround(engine, { width: 4, height: 4 });
  ground.material = createStandardMaterial();
  addToScene(scene, ground);
  await registerScene(scene);
  await startEngine(engine);
  canvas.dataset.drawCalls = String(engine.drawCallCount);
  canvas.dataset.initMs = String(performance.now() - __initStart);
  canvas.dataset.ready = "true";
}
main().catch(console.error);
