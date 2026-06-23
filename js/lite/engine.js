// Engine factory (mirrors src/engine). Single native engine/window in this prototype.
(function (BL) {
    "use strict";
    BL.createEngine = function (/* canvas, options */) {
        return Promise.resolve({ _id: 0, _kind: "engine" });
    };
})(globalThis.__BL);
