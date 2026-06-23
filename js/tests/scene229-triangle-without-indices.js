// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene229.ts (esbuild, target es2017)
// Scene 229 — Triangle Without Indices — tags: pbr, gltf, non-indexed
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene229-triangle-without-indices.js

const MODEL_URL = "https://cx20.github.io/gltf-test/tutorialModels/TriangleWithoutIndices/glTF/TriangleWithoutIndices.gltf";
function collectMeshes(container) {
  var _a;
  const out = [];
  const stack = [...container.entities];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) {
      continue;
    }
    if ("_gpu" in node && "material" in node) {
      out.push(node);
    }
    if ((_a = node.children) == null ? void 0 : _a.length) {
      stack.push(...node.children);
    }
  }
  return out;
}
async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  scene.clearColor = { r: 0.2, g: 0.2, b: 0.3, a: 1 };
  const asset = await loadGltf(engine, MODEL_URL);
  for (const mesh of collectMeshes(asset)) {
    const material = mesh.material;
    material.unlit = true;
    material.unlitColor = [0.5, 0.5, 0.5];
  }
  addToScene(scene, asset);
  const camera = createArcRotateCamera(Math.PI / 2, Math.PI / 2, 2.2, { x: 0.5, y: 0.5, z: 0 });
  camera.fov = 0.7;
  scene.camera = camera;
  attachControl(camera, canvas, scene);
  await registerScene(scene);
  await startEngine(engine);
  canvas.dataset.drawCalls = String(engine.drawCallCount);
  canvas.dataset.initMs = String(performance.now() - __initStart);
  canvas.dataset.ready = "true";
}
main().catch((error) => {
  const canvas = document.getElementById("renderCanvas");
  if (canvas) {
    canvas.dataset.error = error instanceof Error ? error.message : String(error);
  }
  console.error(error);
});
