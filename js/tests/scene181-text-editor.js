// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene181.ts (esbuild, target es2017)
// Scene 181 - Live Text Editor — tags: text, font, demo, interactive
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene181-text-editor.js

const canvas = document.getElementById("renderCanvas");
const textarea = document.getElementById("textInput");
async function run() {
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  const camera = scene.camera = createArcRotateCamera(-Math.PI / 2, Math.PI / 2, 12, { x: 0, y: 0, z: 0 });
  attachControl(camera, canvas, scene);
  const font = await loadFont("/fonts/Inter.ttf");
  const data = createDefaultTextData(font, 48, textarea.value, void 0, { maxWidth: 1200, align: "left" });
  const text = createTextRenderable(data, { opacity: 1 });
  const scale = 0.01;
  text.position.set(-data.width * scale * 0.5, data.height * scale * 0.5, 0);
  text.scaling.set(scale, scale, scale);
  addTextRenderable(scene, text);
  textarea.addEventListener("input", () => {
    updateDefaultTextData(data, textarea.value);
    text.position.set(-data.width * scale * 0.5, data.height * scale * 0.5, 0);
  });
  await registerScene(scene);
  await startEngine(engine);
  canvas.dataset.ready = "true";
}
void run();
