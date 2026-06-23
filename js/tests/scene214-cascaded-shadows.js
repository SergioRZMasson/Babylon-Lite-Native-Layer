// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene214.ts (esbuild, target es2017)
// Scene 214 — Cascaded Shadow Maps — tags: shadows, csm, standard, directional
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene214-cascaded-shadows.js

const SCENE_SIZE = 2e3;
const NUM_CASTERS = 200;
const PRNG_SEED = 1337;
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = a + 1831565813 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function quatFromEuler(ex, ey, ez) {
  const hr = ez * 0.5, hp = ex * 0.5, hy = ey * 0.5;
  const sr = Math.sin(hr), cr = Math.cos(hr), sp = Math.sin(hp), cp = Math.cos(hp), sy = Math.sin(hy), cy = Math.cos(hy);
  return [cy * sp * cr + sy * cp * sr, sy * cp * cr - cy * sp * sr, cy * cp * sr - sy * sp * cr, cy * cp * cr + sy * sp * sr];
}
async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  scene.clearColor = { r: 0.5, g: 0.6, b: 0.75, a: 1 };
  scene.camera = createArcRotateCamera(-Math.PI / 2, Math.PI / 3, SCENE_SIZE * 1.1, { x: 0, y: 0, z: 0 });
  scene.camera.nearPlane = 1;
  scene.camera.farPlane = 1e4;
  attachControl(scene.camera, canvas, scene);
  const light = createDirectionalLight([0, -1, -1], 0.8);
  addToScene(scene, light);
  const ground = createGround(engine, { width: SCENE_SIZE, height: SCENE_SIZE });
  ground.receiveShadows = true;
  const groundMat = createStandardMaterial();
  ground.material = groundMat;
  const knotMat = createStandardMaterial();
  knotMat.diffuseColor = [0, 1, 0];
  const base = createTorusKnot(engine, { radius: 20, tube: 5 });
  base.material = knotMat;
  addToScene(scene, base);
  const rand = mulberry32(PRNG_SEED);
  const casters = [];
  for (let i = 0; i < NUM_CASTERS; i++) {
    const px = (rand() - 0.5) * SCENE_SIZE;
    const py = rand() * SCENE_SIZE * 0.25 + 1;
    const pz = (rand() - 0.5) * SCENE_SIZE;
    const ex = rand() * 3.14;
    const ey = rand() * 3.14;
    const ez = rand() * 3.14;
    const knot = createTorusKnot(engine, { radius: 20, tube: 5 });
    knot.material = knotMat;
    knot.position.set(px, py, pz);
    const [qx, qy, qz, qw] = quatFromEuler(ex, ey, ez);
    knot.rotationQuaternion.set(qx, qy, qz, qw);
    addToScene(scene, knot);
    casters.push(knot);
  }
  light.shadowGenerator = createCsmDirectionalShadowGenerator(engine, light, {
    mapSize: 1024,
    numCascades: 4,
    lambda: 0.5,
    cascadeBlendPercentage: 0.1,
    bias: 5e-5
  });
  setShadowTaskCasterMeshes(light.shadowGenerator, casters);
  addToScene(scene, ground);
  await registerSceneWithShadowSupport(scene);
  await startEngine(engine);
  canvas.dataset.drawCalls = String(engine.drawCallCount);
  canvas.dataset.initMs = String(performance.now() - __initStart);
  canvas.dataset.ready = "true";
}
main().catch(console.error);
