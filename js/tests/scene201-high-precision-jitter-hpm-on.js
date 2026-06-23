// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene201.ts (esbuild, target es2017)
// Scene 201 - LWR Demo (HPM on, FO on) — tags: hpm, lwr, floating-origin, precision, procedural, std
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene201-high-precision-jitter-hpm-on.js

runHpmJitterScene({ useHighPrecisionMatrix: true, useFloatingOrigin: true }).catch((err) => {
  console.error(err);
});
