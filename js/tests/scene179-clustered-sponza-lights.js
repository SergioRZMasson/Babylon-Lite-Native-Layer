// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene179.ts (esbuild, target es2017)
// Scene 179 - Clustered Sponza Lights — tags: pbr, gltf, clustered, lights
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene179-clustered-sponza-lights.js

const MODEL_URL = "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Sponza/glTF/Sponza.gltf";
function seededRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = 1664525 * s + 1013904223 >>> 0;
    return s / 4294967296;
  };
}
async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  const camera = createFreeCamera({ x: -5, y: 2, z: 0 }, { x: 0, y: 3, z: 0 });
  camera.speed = 0.2;
  scene.camera = camera;
  attachFreeControl(camera, canvas, scene);
  const asset = await loadGltf(engine, MODEL_URL);
  addToScene(scene, asset);
  for (const mesh of scene.meshes) {
    const mat = mesh.material;
    if (mat) {
      mat.usePhysicalLightFalloff = true;
    }
  }
  const clustered = createClusteredLightContainer({ horizontalTiles: 64, verticalTiles: 64, zSlices: 16 });
  const rnd = seededRandom(99537271);
  for (let i = 0; i < 1e3; i++) {
    createClusteredPointLight(clustered, {
      position: [rnd() * 20 - 10, rnd() * 10, rnd() * 10 - 5],
      diffuse: [rnd(), rnd(), rnd()],
      range: 1
    });
  }
  addClusteredLightContainer(scene, clustered);
  await registerScene(scene);
  await startEngine(engine);
  canvas.dataset.drawCalls = String(engine.drawCallCount);
  canvas.dataset.ready = "true";
  canvas.dataset.initMs = String(performance.now() - __initStart);
}
main().catch(console.error);
