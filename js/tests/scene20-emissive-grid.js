// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene20.ts (esbuild, target es2017)
// Scene 20 — PBR Emissive Grid — tags: pbr, env
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene20-emissive-grid.js

function seededRandom(seed) {
  let s = seed;
  return () => {
    s = s * 1664525 + 1013904223 & 4294967295;
    return (s >>> 0) / 4294967296;
  };
}
async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  const cam = createArcRotateCamera(Math.PI / 2, Math.PI / 2, 80, { x: 0, y: 0, z: 0 });
  scene.camera = cam;
  attachControl(cam, canvas, scene);
  addToScene(scene, createHemisphericLight([0, 1, 0], 1));
  const random = seededRandom(42);
  const sphereCount = 2500;
  const materialCount = 150;
  const baseColorTex = createSolidTexture2D(engine, 1, 1, 1);
  const ormTex = createSolidTexture2D(engine, 1, 0, 0);
  const materials = [];
  for (let i = 0; i < materialCount; i++) {
    const r = random(), g = random(), b = random();
    materials.push(
      createPbrMaterial({
        baseColorTexture: baseColorTex,
        ormTexture: ormTex,
        emissiveColor: [r, g, b],
        reflectance: 1
      })
    );
  }
  const meshes = [];
  for (let i = 0; i < sphereCount; i++) {
    const sphere = createSphere(engine, { diameter: 2, segments: 32 });
    sphere.position.set(20 - random() * 40, 20 - random() * 40, 20 - random() * 40);
    sphere.material = materials[i % materialCount];
    meshes.push(sphere);
  }
  const levelMax = 5;
  let level = 0;
  for (let i = 0; i < sphereCount; i++) {
    if (level !== 0) {
      setParent(meshes[i], meshes[i - 1]);
    }
    level++;
    if (level >= levelMax) {
      level = 0;
    }
  }
  for (const m of meshes) {
    addToScene(scene, m);
  }
  await loadEnvironment(scene, "https://assets.babylonjs.com/core/environments/environmentSpecular.env", {
    groundTextureUrl: "https://assets.babylonjs.com/core/environments/backgroundGround.png",
    skyboxUrl: "https://assets.babylonjs.com/core/environments/backgroundSkybox.dds",
    brdfUrl: "/brdf-lut.png"
  });
  scene.fixedDeltaMs = 16;
  const params = new URLSearchParams(window.location.search);
  const seekTimeParam = parseFloat(params.get("seekTime") || "");
  let frozen = false;
  onBeforeRender(scene, (_delta) => {
    if (frozen) {
      return;
    }
    if (!isNaN(seekTimeParam)) {
      if (seekTimeParam === 0) {
        frozen = true;
        canvas.dataset.animationFrozen = "true";
        return;
      }
      const seekFrames = seekTimeParam * 60;
      for (let f = 0; f < seekFrames; f++) {
        for (const m of meshes) {
          m.rotation.y += 0.01;
        }
      }
      frozen = true;
      canvas.dataset.animationFrozen = "true";
      return;
    }
    for (const m of meshes) {
      m.rotation.y += 0.01;
    }
  });
  await registerScene(scene);
  await startEngine(engine);
  canvas.dataset.drawCalls = String(engine.drawCallCount);
  canvas.dataset.initMs = String(performance.now() - __initStart);
  canvas.dataset.ready = "true";
}
void main();
