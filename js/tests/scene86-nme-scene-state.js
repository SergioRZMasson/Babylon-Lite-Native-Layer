// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene86.ts (esbuild, target es2017)
// Scene 86 — NME Scene State — tags: nme, scene-state, mesh-attributes, clip-plane
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene86-nme-scene-state.js

function createScene86Mesh(engine, data) {
  return createMeshFromData(engine, data.name, data.positions, data.normals, data.indices, data.uvs, void 0, data.tangents, data.colors);
}
async function main() {
  const initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  scene.clearColor = { r: 0.02, g: 0.02, b: 0.035, a: 1 };
  setClipPlane(scene, SCENE86_CLIP_PLANE);
  const camera = createArcRotateCamera(-Math.PI / 2, Math.PI / 2, 4, { x: 0, y: 0, z: 0 });
  camera.nearPlane = 0.1;
  camera.farPlane = 100;
  scene.camera = camera;
  attachControl(camera, canvas, scene);
  const material = await parseNodeMaterialFromSnippet(engine, "", { json: SCENE86_NME_JSON });
  for (const data of createScene86MeshData()) {
    const mesh = createScene86Mesh(engine, data);
    mesh.position.x = data.x;
    mesh.material = material;
    addToScene(scene, mesh);
  }
  await registerScene(scene);
  await startEngine(engine);
  canvas.dataset.drawCalls = String(engine.drawCallCount);
  canvas.dataset.initMs = String(performance.now() - initStart);
  canvas.dataset.ready = "true";
}
main().catch((err) => {
  console.error(err);
  const canvas = document.getElementById("renderCanvas");
  if (canvas) {
    canvas.dataset.error = String(err);
  }
});
