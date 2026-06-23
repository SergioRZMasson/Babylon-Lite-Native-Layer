// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene153.ts (esbuild, target es2017)
// Scene 153 — Autonomous AnimationManager — tags: anim, standalone
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene153-autonomous-manager.js

const FRAME_RATE = 10;
const END_FRAME = 2 * FRAME_RATE;
const BACKGROUND = "#1f2433";
const TRACK = "#596274";
const BOX = "#f2b84b";
function resizeCanvas(canvas) {
  const width = Math.max(1, Math.floor(canvas.clientWidth));
  const height = Math.max(1, Math.floor(canvas.clientHeight));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}
function draw(canvas, target) {
  resizeCanvas(canvas);
  canvas.dataset.animatedX = target.position.x.toFixed(4);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Scene 153 requires a 2D canvas context");
  }
  const w = canvas.width;
  const h = canvas.height;
  const y = h * 0.5;
  const centerX = w * 0.5;
  const scale = w * 0.18;
  const x = centerX + target.position.x * scale;
  const size = Math.max(28, Math.min(w, h) * 0.09);
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = TRACK;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(centerX - 2 * scale, y);
  ctx.lineTo(centerX + 2 * scale, y);
  ctx.stroke();
  ctx.fillStyle = BOX;
  ctx.fillRect(x - size * 0.5, y - size * 0.5, size, size);
}
async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const target = { position: { x: -2 } };
  const manager = createAnimationManager({
    onUpdate: () => draw(canvas, target)
  });
  const xSlide = createPropertyAnimationClip("standaloneXSlide", [
    {
      path: "position.x",
      frameRate: FRAME_RATE,
      keys: [
        { frame: 0, value: -2 },
        { frame: FRAME_RATE, value: 2 },
        { frame: END_FRAME, value: -2 }
      ]
    }
  ]);
  const group = createPropertyAnimationGroup(manager, target, xSlide, { fromFrame: 0, toFrame: END_FRAME, loop: true });
  const seekTime = parseFloat(new URLSearchParams(window.location.search).get("seekTime") || "");
  if (Number.isFinite(seekTime)) {
    goToFrame(group, seekTime * FRAME_RATE);
    draw(canvas, target);
    canvas.dataset.animationFrozen = "true";
  } else {
    draw(canvas, target);
    startAnimationManager(manager);
  }
  window.addEventListener("resize", () => draw(canvas, target));
  canvas.dataset.drawCalls = "0";
  canvas.dataset.initMs = String(performance.now() - __initStart);
  canvas.dataset.ready = "true";
}
main().catch(console.error);
