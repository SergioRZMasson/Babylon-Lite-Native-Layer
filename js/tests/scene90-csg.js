// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene90.ts (esbuild, target es2017)
// Scene 90 — CSG Operations — tags: csg, procedural, std
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene90-csg.js

const GRASS_URL = "https://playground.babylonjs.com/textures/grass.png";
const CRATE_URL = "https://playground.babylonjs.com/textures/crate.png";
function labelTextureUrl(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Scene 90 labels require a 2D canvas context.");
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "black";
  ctx.font = "700 64px Arial, Helvetica, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, 128, 78);
  return canvas.toDataURL("image/png");
}
async function createLabelMaterial(engine, text) {
  const material = createStandardMaterial();
  material.disableLighting = true;
  material.emissiveColor = [1, 1, 1];
  material.diffuseTexture = await loadTexture2D(engine, labelTextureUrl(text), {
    mipMaps: false,
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge"
  });
  material.alphaCutOff = 0.5;
  material.backFaceCulling = false;
  return material;
}
function setMeshPosition(mesh, x, y, z = 0) {
  mesh.position.x = x;
  mesh.position.y = y;
  mesh.position.z = z;
}
async function main() {
  const initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  scene.camera = createArcRotateCamera(-1.5, 1.6, 18, { x: 0, y: 0, z: 0 });
  scene.camera.nearPlane = 0.1;
  scene.camera.farPlane = 1e3;
  attachControl(scene.camera, canvas, scene);
  addToScene(scene, createHemisphericLight([0, 1, 0], 1));
  const [grassTexture, crateTexture, subtractLabel, intersectLabel, unionLabel, equalsLabel] = await Promise.all([
    loadTexture2D(engine, GRASS_URL, { invertY: true }),
    loadTexture2D(engine, CRATE_URL, { invertY: true }),
    createLabelMaterial(engine, "-"),
    createLabelMaterial(engine, "\u2229"),
    createLabelMaterial(engine, "+"),
    createLabelMaterial(engine, "=")
  ]);
  const crateMaterial = createStandardMaterial();
  crateMaterial.diffuseTexture = crateTexture;
  const grassMaterial = createStandardMaterial();
  grassMaterial.diffuseTexture = grassTexture;
  const resultMaterial = createStandardMaterial();
  resultMaterial.diffuseTexture = crateTexture;
  const rows = [
    { y: -4, label: subtractLabel, op: "subtract" },
    { y: 0, label: intersectLabel, op: "intersect" },
    { y: 4, label: unionLabel, op: "union" }
  ];
  for (const row of rows) {
    const box = createBox(engine, 2);
    const sphere = createSphere(engine, { diameter: 2.5, segments: 32 });
    const boxSolid = createCsgFromMesh(box);
    const sphereSolid = createCsgFromMesh(sphere);
    const resultSolid = row.op === "subtract" ? csgSubtract(boxSolid, sphereSolid) : row.op === "intersect" ? csgIntersect(boxSolid, sphereSolid) : csgUnion(boxSolid, sphereSolid);
    const result = createMeshFromCsg(engine, resultSolid, `csg-${row.op}`);
    box.material = crateMaterial;
    sphere.material = grassMaterial;
    result.material = resultMaterial;
    setMeshPosition(box, -4, row.y);
    setMeshPosition(sphere, 0.2, row.y);
    setMeshPosition(result, 4, row.y);
    addToScene(scene, box);
    addToScene(scene, sphere);
    addToScene(scene, result);
    const label = createPlane(engine, { width: 1.4, height: 0.7 });
    label.material = row.label;
    setMeshPosition(label, -2, row.y);
    addToScene(scene, label);
    const equals = createPlane(engine, { width: 1.4, height: 0.7 });
    equals.material = equalsLabel;
    setMeshPosition(equals, 2, row.y);
    addToScene(scene, equals);
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
