// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene72.ts (esbuild, target es2017)
// Scene 72 — NME PBR Full (D8AK3Z) — tags: pbr, nme, procedural, env, shadows, clearcoat, sheen, anisotropy, subsurface
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene72-nme-pbr-full.js

var __defProp = Object.defineProperty;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};

function sanitize(name) {
  return name.replace(/[^A-Za-z0-9_]/g, "_");
}
async function loadSnippetTextures(engine, json) {
  var _a, _b;
  const blocks = (_a = json.blocks) != null ? _a : [];
  const out = {};
  for (const b of blocks) {
    if (b.customType !== "BABYLON.TextureBlock" && b.customType !== "BABYLON.ImageSourceBlock") continue;
    const tex = b.texture;
    const url = (tex == null ? void 0 : tex.url) && tex.url.length > 0 ? tex.url : (tex == null ? void 0 : tex.name) && tex.name.startsWith("data:") ? tex.name : void 0;
    if (!url) continue;
    const key = sanitize(b.name || `tex${b.id}`);
    const invertY = (_b = tex == null ? void 0 : tex.invertY) != null ? _b : true;
    try {
      out[key] = await loadTexture2D(engine, url, { invertY });
    } catch (e) {
      console.warn("scene72: failed to load", key, e);
    }
  }
  return out;
}
async function loadScene72BlockEmitter(className) {
  switch (className) {
    case "AddBlock":
      return (await import("babylon-lite/material/node/blocks/add-block.js")).emitter;
    case "AnisotropyBlock":
      return (await import("babylon-lite/material/node/blocks/anisotropy-block.js")).emitter;
    case "ClearCoatBlock":
      return (await import("babylon-lite/material/node/blocks/clearcoat-block.js")).emitter;
    case "FragmentOutputBlock":
      return (await import("babylon-lite/material/node/blocks/fragment-output.js")).emitter;
    case "InputBlock":
      return (await import("babylon-lite/material/node/blocks/input-block.js")).emitter;
    case "LerpBlock":
      return (await import("babylon-lite/material/node/blocks/lerp-block.js")).emitter;
    case "MultiplyBlock":
      return (await import("babylon-lite/material/node/blocks/multiply-block.js")).emitter;
    case "PBRMetallicRoughnessBlock":
      return (await import("babylon-lite/material/node/blocks/pbr-metallic-roughness-block-full.js")).emitter;
    case "PerturbNormalBlock":
      return (await import("babylon-lite/material/node/blocks/perturb-normal.js")).emitter;
    case "ReflectionBlock":
      return (await import("babylon-lite/material/node/blocks/reflection-block.js")).emitter;
    case "RefractionBlock":
      return (await import("babylon-lite/material/node/blocks/refraction-block.js")).emitter;
    case "SheenBlock":
      return (await import("babylon-lite/material/node/blocks/sheen-block.js")).emitter;
    case "SubSurfaceBlock":
      return (await import("babylon-lite/material/node/blocks/subsurface-block.js")).emitter;
    case "SubtractBlock":
      return (await import("babylon-lite/material/node/blocks/subtract-block.js")).emitter;
    case "TextureBlock":
      return (await import("babylon-lite/material/node/blocks/texture-block.js")).emitter;
    case "TransformBlock":
      return (await import("babylon-lite/material/node/blocks/transform-block.js")).emitter;
    case "VectorMergerBlock":
      return (await import("babylon-lite/material/node/blocks/vector-merger.js")).emitter;
    case "VertexOutputBlock":
      return (await import("babylon-lite/material/node/blocks/vertex-output.js")).emitter;
    default:
      throw new Error(`Scene72: unsupported NME block "${className}"`);
  }
}
async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  scene.clearColor = { r: 0.6, g: 0.8, b: 1, a: 1 };
  scene.camera = createArcRotateCamera(-Math.PI / 2, Math.PI / 2, 7, { x: 0, y: 0, z: 0 });
  scene.camera.nearPlane = 0.1;
  scene.camera.farPlane = 1e3;
  attachControl(scene.camera, canvas, scene);
  await loadEnvironment(scene, "https://assets.babylonjs.com/core/environments/environmentSpecular.env", {
    skipSkybox: true,
    skipGround: true,
    brdfUrl: "/brdf-lut.png"
  });
  scene.imageProcessing.toneMappingEnabled = false;
  scene.imageProcessing.exposure = 1;
  scene.imageProcessing.contrast = 1;
  const hemi = createHemisphericLight([0, 1, 0], 1);
  addToScene(scene, hemi);
  const point = createPointLight([0, 5, -2], 1);
  addToScene(scene, point);
  const spot = createSpotLight([-0.5, 0, -2], [0, 0, 1], Math.PI / 2, 1, 1);
  addToScene(scene, spot);
  const dir = createDirectionalLight([1, -1, 1], 10);
  addToScene(scene, dir);
  const sphere = createSphere(engine, { segments: 32, diameter: 2 });
  sphere.position.set(0, 0, -1e-5);
  const ground = createGround(engine, { width: 6, height: 6 });
  ground.position.set(0, -1, 0);
  ground.receiveShadows = true;
  ground.layerMask = 1;
  const sg = createPcfDirectionalShadowGenerator(engine, dir, { mapSize: 1024, orthoMinZ: -2, orthoMaxZ: 15 });
  setShadowTaskCasterMeshes(sg, [sphere]);
  dir.shadowGenerator = sg;
  const json = await getScene72Nme();
  const loaded = await loadSnippetTextures(engine, json);
  const white = createSolidTexture2D(engine, 1, 1, 1, 1);
  const flatNormal = createSolidTexture2D(engine, 0.5, 0.5, 1, 1);
  const black = createSolidTexture2D(engine, 0, 0, 0, 1);
  const fallback = {
    Albedo_texture: white,
    MetallicRoughness_texture: white,
    AO_texture: white,
    Opacity_texture: white,
    Bump_texture: flatNormal,
    Sheen_texture: white,
    Anisotropy_texture: black,
    ClearCoat_texture: white,
    ClearCoat_bump_texture: flatNormal,
    ClearCoat_tint_texture: white,
    SubSurface_thickness_texture: white
  };
  const textures = __spreadValues(__spreadValues({}, fallback), loaded);
  const material = await parseNodeMaterialFromSnippet(engine, "", { json, textures, blockLoader: loadScene72BlockEmitter });
  sphere.material = material;
  ground.material = material;
  addToScene(scene, sphere);
  addToScene(scene, ground);
  await registerSceneWithShadowSupport(scene);
  await startEngine(engine);
  canvas.dataset.drawCalls = String(engine.drawCallCount);
  canvas.dataset.initMs = String(performance.now() - __initStart);
  canvas.dataset.ready = "true";
}
main().catch((err) => {
  console.error(err);
  const canvas = document.getElementById("renderCanvas");
  if (canvas) {
    canvas.dataset.error = String(err);
  }
});
