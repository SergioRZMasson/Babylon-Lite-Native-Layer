// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene163.ts (esbuild, target es2017)
// Scene 163 - ShaderMaterial Alpha — tags: shader, alpha, procedural
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene163-shader-material-alpha.js

const vertexSource = `struct VertexOutput{@builtin(position) position:vec4<f32>,@location(0) uv:vec2<f32>,};
@vertex fn mainVertex(input:VertexInput)->VertexOutput{var out:VertexOutput;out.position=shaderSystem.worldViewProjection*vec4<f32>(input.position,1.0);out.uv=input.uv;return out;}`;
const fragmentSource = `struct VertexOutput{@builtin(position) position:vec4<f32>,@location(0) uv:vec2<f32>,};
@fragment fn mainFragment(input:VertexOutput)->@location(0) vec4<f32>{if(distance(input.uv,vec2<f32>(0.5,0.5))<0.18){discard;}return vec4<f32>(1.0,0.25,0.05,0.55);}`;
async function main() {
  const initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  scene.clearColor = { r: 51 / 255, g: 51 / 255, b: 76 / 255, a: 1 };
  const camera = createArcRotateCamera(-Math.PI / 2, Math.PI / 2, 4, { x: 0, y: 0, z: 0 });
  camera.nearPlane = 0.1;
  camera.farPlane = 100;
  scene.camera = camera;
  const material = createShaderMaterial({
    name: "scene163Shader",
    vertexSource,
    fragmentSource,
    attributes: ["position", "uv"],
    uniforms: ["worldViewProjection"],
    needAlphaBlending: true,
    needAlphaTesting: true,
    backFaceCulling: false
  });
  const plane = createPlane(engine, { width: 3, height: 3 });
  plane.material = material;
  addToScene(scene, plane);
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
