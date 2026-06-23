// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene17.ts (esbuild, target es2017)
// Scene 17 — PBR + Std TI — tags: pbr, procedural
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene17-pbr-std-thin-instances.js

async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  scene.camera = createArcRotateCamera(-Math.PI / 2, Math.atan(2), Math.sqrt(125), { x: 0, y: 0, z: 0 });
  scene.camera.nearPlane = 1;
  scene.camera.farPlane = 1e4;
  attachControl(scene.camera, canvas, scene);
  addToScene(scene, createHemisphericLight([0, 1, 0], 0.7));
  await loadDdsEnvironment(scene, "https://playground.babylonjs.com/textures/environment.dds", {
    brdfUrl: "/brdf-lut.png"
  });
  const cube1 = createBox(engine);
  cube1.position.set(0, 1, 0);
  const baseColorTex = createSolidTexture2D(engine, 1, 0.766, 0.336);
  const ormTex = await loadTexture2D(engine, "https://playground.babylonjs.com/textures/mr.jpg");
  cube1.material = createPbrMaterial({
    baseColorTexture: baseColorTex,
    ormTexture: ormTex,
    occlusionStrength: 0
  });
  const matrices1 = new Float32Array(16 * 2);
  const m1 = mat4Translation(-2, 2, 0);
  matrices1.set(m1, 0);
  const m2 = mat4Identity();
  matrices1.set(m2, 16);
  setThinInstances(cube1, matrices1, 2);
  const colors1 = new Float32Array([1, 1, 0, 1, 1, 0, 0, 1]);
  setThinInstanceColors(cube1, colors1);
  addToScene(scene, cube1);
  const cube2 = createBox(engine);
  cube2.position.set(0, 1, 0);
  const stdMat = createStandardMaterial();
  stdMat.backFaceCulling = false;
  cube2.material = stdMat;
  const matrices2 = new Float32Array(16 * 2);
  const m3 = mat4Compose(2, 1, 0, 0, 0, 0, 1, -1, 1, 1);
  matrices2.set(m3, 0);
  const m4 = mat4Compose(-2, 0, -3, 0, 0, 0, 1, -1, 1, 1);
  matrices2.set(m4, 16);
  setThinInstances(cube2, matrices2, 2);
  const colors2 = new Float32Array([0, 1, 0, 1, 0, 0, 1, 1]);
  setThinInstanceColors(cube2, colors2);
  addToScene(scene, cube2);
  const ground = createGround(engine, { width: 6, height: 6 });
  ground.material = createStandardMaterial();
  addToScene(scene, ground);
  await registerScene(scene);
  await startEngine(engine);
  canvas.dataset.drawCalls = String(engine.drawCallCount);
  canvas.dataset.initMs = String(performance.now() - __initStart);
  canvas.dataset.ready = "true";
}
main().catch(console.error);
