// Phase 0 JS orchestrator for the Babylon-Lite Native Layer prototype.
//
// Demonstrates the Option C seam: JavaScript owns the per-frame logic and calls
// into the native rendering layer (gfx.*), which is implemented in C++ on bgfx.
// Here JS computes an animated clear colour; C++ applies it via bgfx.

console.log("[js] main.js loaded — JS will drive the clear colour each frame");

const TAU = Math.PI * 2;

setFrameCallback(function (timeMs, frameNo) {
    const t = frameNo * 0.03;
    const r = Math.sin(t) * 0.5 + 0.5;
    const g = Math.sin(t + TAU / 3) * 0.5 + 0.5;
    const b = Math.sin(t + (2 * TAU) / 3) * 0.5 + 0.5;
    gfx.setClearColor(r, g, b, 1.0);

    if (frameNo === 0) {
        console.log("[js] first frame: clear =", r.toFixed(3), g.toFixed(3), b.toFixed(3));
    }
});
