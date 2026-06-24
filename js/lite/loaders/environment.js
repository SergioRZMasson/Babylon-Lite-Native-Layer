// Environment loader (mirrors src/loader-env). IBL/skybox/ground not implemented yet
// in the native renderer, so these are no-op stand-ins (the parity stage adds them).
(function (BL) {
    "use strict";
    BL.loadEnvironment = function (scene, url, options) {
        return Promise.resolve();
    };
    // Prefiltered HDR IBL — accepted so PBR/bench scenes load; no native IBL yet.
    BL.loadHdrEnvironment = function (scene, url, options) {
        return Promise.resolve();
    };
})(globalThis.__BL);
