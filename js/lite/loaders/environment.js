// Environment loader (mirrors src/loader-env). IBL/skybox/ground not implemented yet
// in the native renderer, so this is a no-op stand-in (the parity stage adds it).
(function (BL) {
    "use strict";
    BL.loadEnvironment = function (scene, url, options) {
        return Promise.resolve();
    };
})(globalThis.__BL);
