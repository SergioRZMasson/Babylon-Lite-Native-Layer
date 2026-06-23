// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene180.ts (esbuild, target es2017)
// Scene 180 - TextRenderer (2D) — tags: text, font, 2d, demo, interactive
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene180-text-renderer.js

var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
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
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));

const canvas = document.getElementById("renderCanvas");
const textarea = document.getElementById("textInput");
const rot = document.getElementById("rot");
const opacity = document.getElementById("opacity");
const rotVal = document.getElementById("rotVal");
const opacityVal = document.getElementById("opacityVal");
const red = document.getElementById("red");
const green = document.getElementById("green");
const blue = document.getElementById("blue");
const redVal = document.getElementById("redVal");
const greenVal = document.getElementById("greenVal");
const blueVal = document.getElementById("blueVal");
function currentColor() {
  return [+red.value, +green.value, +blue.value, 1];
}
async function run() {
  const engine = await createEngine(canvas);
  const font = await loadFont("/fonts/Inter.ttf");
  const data = createDefaultTextData(font, 48, textarea.value, currentColor(), {
    maxWidth: 600,
    align: "left"
  });
  const layer = createTextLayer(data, {
    positionPx: { x: 360, y: 380 },
    scale: 1,
    rotationRad: 0,
    opacity: 1
  });
  const tr = createTextRenderer(engine, {
    layers: [layer],
    clearValue: { r: 0.05, g: 0.06, b: 0.09, a: 1 }
  });
  registerTextRenderer(tr);
  textarea.addEventListener("input", () => {
    updateDefaultTextData(data, textarea.value);
  });
  const onColor = () => {
    const r = data.runs[0];
    updateTextData(data, { update: "replaceRun", previous: r, run: __spreadProps(__spreadValues({}, r), { defaultColor: currentColor() }) });
    redVal.textContent = (+red.value).toFixed(2);
    greenVal.textContent = (+green.value).toFixed(2);
    blueVal.textContent = (+blue.value).toFixed(2);
  };
  red.addEventListener("input", onColor);
  green.addEventListener("input", onColor);
  blue.addEventListener("input", onColor);
  rot.addEventListener("input", () => {
    layer.rotationRad = +rot.value * Math.PI / 180;
    rotVal.textContent = rot.value + "\xB0";
  });
  opacity.addEventListener("input", () => {
    layer.opacity = +opacity.value;
    opacityVal.textContent = (+opacity.value).toFixed(2);
  });
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  canvas.addEventListener("pointerdown", (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.classList.add("dragging");
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!dragging) {
      return;
    }
    layer.positionPx.x += e.clientX - lastX;
    layer.positionPx.y += e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
  });
  const endDrag = (e) => {
    if (!dragging) {
      return;
    }
    dragging = false;
    canvas.classList.remove("dragging");
    canvas.releasePointerCapture(e.pointerId);
  };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * 1e-3);
      const newScale = layer.scale * factor;
      const k = newScale / layer.scale;
      layer.positionPx.x = e.clientX + (layer.positionPx.x - e.clientX) * k;
      layer.positionPx.y = e.clientY + (layer.positionPx.y - e.clientY) * k;
      layer.scale = newScale;
    },
    { passive: false }
  );
  await startEngine(engine);
  canvas.dataset.ready = "true";
}
void run();
