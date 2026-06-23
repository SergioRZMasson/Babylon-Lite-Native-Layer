// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene126.ts (esbuild, target es2017)
// Scene 126 — Gaussian Splatting Material Plugin — tags: gaussian-splatting, material-plugin
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene126-gs-material-plugin.js

const SPLAT_URL = "https://raw.githubusercontent.com/CedricGuillemet/dump/master/Halo_Believe.splat";
const gsPlugin = {
  id: "someGsPlugin",
  fragmentSlots: {
    GS_FRAGMENT_MAIN_END: "finalColor = vec4<f32>(1.0, 0.0, 0.0, 0.05);"
  }
};
async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  scene.clearColor = { r: 0, g: 0, b: 0, a: 1 };
  const camera = createArcRotateCamera(4.57, 1.29, 6, { x: 0, y: 0, z: 0 });
  camera.nearPlane = 0.1;
  camera.farPlane = 100;
  scene.camera = camera;
  attachControl(camera, canvas, scene);
  const splat = await loadSplat(scene, SPLAT_URL, [gsPlugin]);
  await registerScene(scene);
  await startEngine(engine);
  await splat.firstSortReady;
  await new Promise((r) => requestAnimationFrame(() => r()));
  canvas.dataset.drawCalls = String(engine.drawCallCount);
  canvas.dataset.initMs = String(performance.now() - __initStart);
  canvas.dataset.ready = "true";
}
main().catch((err) => {
  console.error(err);
});
