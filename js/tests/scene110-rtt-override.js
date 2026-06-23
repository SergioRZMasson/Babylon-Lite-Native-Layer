// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene110.ts (esbuild, target es2017)
// Scene 110 — RTT with material override — tags: std, procedural, frame-graph, rtt, multi-pass
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene110-rtt-override.js

async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  const mainCam = createArcRotateCamera(-Math.PI / 2, Math.PI / 2.5, 8, { x: 1.5, y: 0, z: 0 });
  mainCam.nearPlane = 0.1;
  mainCam.farPlane = 100;
  scene.camera = mainCam;
  attachControl(mainCam, canvas, scene);
  addToScene(scene, createHemisphericLight([0, 1, 0]));
  const { rt: r1RT, texture: r1Tex } = createRenderTargetTexture(engine, {
    lbl: "r1",
    format: engine.format,
    dFormat: "depth24plus-stencil8",
    samples: 1,
    size: { width: 512, height: 512 }
  });
  const meshA = createSphere(engine);
  const matA_R0 = createStandardMaterial();
  matA_R0.diffuseColor = [1, 0.2, 0.2];
  meshA.material = matA_R0;
  addToScene(scene, meshA);
  const meshB = createBox(engine, 2);
  meshB.position.x = 3;
  const matB = createStandardMaterial();
  matB.diffuseTexture = r1Tex;
  meshB.material = matB;
  addToScene(scene, meshB);
  const r1Cam = createFreeCamera({ x: 0, y: 0, z: -3 }, { x: 0, y: 0, z: 0 });
  r1Cam.nearPlane = 0.1;
  r1Cam.farPlane = 100;
  const r1Task = createRenderTask({ name: "r1", rt: r1RT, clrColor: { r: 0.1, g: 0.1, b: 0.3, a: 1 }, cam: r1Cam, cs: true }, engine, scene);
  addTaskAtStart(scene, r1Task);
  const matA_R1 = createStandardMaterial();
  matA_R1.diffuseColor = [0.2, 1, 0.2];
  r1Task.addMesh(meshA, { material: matA_R1 });
  await registerScene(scene);
  await startEngine(engine);
  canvas.dataset.drawCalls = String(engine.drawCallCount);
  canvas.dataset.initMs = String(performance.now() - __initStart);
  canvas.dataset.ready = "true";
}
main().catch(console.error);
