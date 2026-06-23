// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene16.ts (esbuild, target es2017)
// Scene 16 — Thin Instances — tags: std, procedural
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene16-thin-instances.js

async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  scene.camera = createArcRotateCamera(-Math.PI / 5, Math.PI / 3, 200, { x: 0, y: 0, z: 0 });
  attachControl(scene.camera, canvas, scene);
  const box = createBox(engine);
  const mat = createStandardMaterial();
  mat.disableLighting = true;
  mat.emissiveColor = [1, 1, 1];
  box.material = mat;
  const numPerSide = 40;
  const size = 100;
  const ofst = size / (numPerSide - 1);
  const instanceCount = numPerSide * numPerSide * numPerSide;
  const matricesData = new Float32Array(16 * instanceCount);
  const colorData = new Float32Array(4 * instanceCount);
  let col = 0;
  let index = 0;
  const m = new Float32Array(16);
  m[0] = 1;
  m[5] = 1;
  m[10] = 1;
  m[15] = 1;
  for (let x = 0; x < numPerSide; x++) {
    m[12] = -size / 2 + ofst * x;
    for (let y = 0; y < numPerSide; y++) {
      m[13] = -size / 2 + ofst * y;
      for (let z = 0; z < numPerSide; z++) {
        m[14] = -size / 2 + ofst * z;
        matricesData.set(m, index * 16);
        const coli = Math.floor(col);
        colorData[index * 4 + 0] = ((coli & 16711680) >> 16) / 255;
        colorData[index * 4 + 1] = ((coli & 65280) >> 8) / 255;
        colorData[index * 4 + 2] = ((coli & 255) >> 0) / 255;
        colorData[index * 4 + 3] = 1;
        index++;
        col += 16777215 / instanceCount;
      }
    }
  }
  setThinInstances(box, matricesData, instanceCount);
  setThinInstanceColors(box, colorData);
  if (new URLSearchParams(location.search).has("culling")) {
    enableThinInstanceGpuCulling(box);
    canvas.dataset.gpuCulling = "thin-instances";
  }
  addToScene(scene, box);
  await registerScene(scene);
  await startEngine(engine);
  canvas.dataset.drawCalls = String(engine.drawCallCount);
  canvas.dataset.initMs = String(performance.now() - __initStart);
  canvas.dataset.ready = "true";
}
main().catch(console.error);
