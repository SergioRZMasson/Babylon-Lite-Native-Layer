// Texture factories (subset of src/texture). createSolidTexture2D builds a 1×1 native
// texture from a linear RGB triple — used by PBR scenes for constant baseColor/ORM maps.
(function (BL) {
    "use strict";

    BL.createSolidTexture2D = function (engine, r, g, b) {
        return { _id: __bl_createSolidTexture(r == null ? 1 : r, g == null ? 1 : g, b == null ? 1 : b), _kind: "texture" };
    };
})(globalThis.__BL);
