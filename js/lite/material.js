// Material factories (mirrors src/material).
(function (BL) {
    "use strict";

    BL.createStandardMaterial = function (props) {
        const p = props || {};
        const id = __bl_createStandardMaterial();
        const mat = { _id: id, _kind: "material" };
        let _specularPower = 64, _alpha = 1;
        function sync() {
            __bl_setMaterial(id, mat.diffuseColor.r, mat.diffuseColor.g, mat.diffuseColor.b, _alpha,
                mat.specularColor.r, mat.specularColor.g, mat.specularColor.b, _specularPower);
        }
        BL.makeColorProp(mat, "diffuseColor", 1, 1, 1, sync);
        BL.makeColorProp(mat, "specularColor", 1, 1, 1, sync);
        BL.makeColorProp(mat, "emissiveColor", 0, 0, 0, sync);
        Object.defineProperty(mat, "specularPower", { get() { return _specularPower; }, set(n) { _specularPower = n; sync(); } });
        Object.defineProperty(mat, "alpha", { get() { return _alpha; }, set(n) { _alpha = n; sync(); } });
        if (p.diffuseColor) { mat.diffuseColor = p.diffuseColor; }
        return mat;
    };

    // PBR (metallic-roughness). Accepts the Babylon-Lite createPbrMaterial(props) shape:
    //   { baseColorTexture, ormTexture, baseColor:[r,g,b], emissiveColor:[r,g,b],
    //     metallic, roughness, alpha } — textures are objects from createSolidTexture2D /
    //     the glTF loader (their ._id is a native gfx texture handle).
    BL.createPbrMaterial = function (options) {
        const o = options || {};
        const id = __bl_createPbrMaterial();
        const mat = { _id: id, _kind: "material" };
        let _metallic = o.metallic == null ? 1 : o.metallic;
        let _roughness = o.roughness == null ? 1 : o.roughness;
        let _alpha = o.alpha == null ? 1 : o.alpha;
        const texId = (t) => (t && t._id != null ? t._id : -1);
        let _texBase = texId(o.baseColorTexture);
        let _texMR = texId(o.ormTexture || o.metallicRoughnessTexture);
        function sync() {
            __bl_setPbrMaterial(id, mat.baseColor.r, mat.baseColor.g, mat.baseColor.b, _alpha,
                _metallic, _roughness, 1, 0, mat.emissiveColor.r, mat.emissiveColor.g, mat.emissiveColor.b,
                _texBase, _texMR, -1, -1, -1);
        }
        const bc = o.baseColor || [o.r == null ? 1 : o.r, o.g == null ? 1 : o.g, o.b == null ? 1 : o.b];
        BL.makeColorProp(mat, "baseColor", bc[0], bc[1], bc[2], sync);
        const ec = o.emissiveColor || [0, 0, 0];
        BL.makeColorProp(mat, "emissiveColor", ec[0], ec[1], ec[2], sync);
        Object.defineProperty(mat, "metallic", { get() { return _metallic; }, set(n) { _metallic = n; sync(); } });
        Object.defineProperty(mat, "roughness", { get() { return _roughness; }, set(n) { _roughness = n; sync(); } });
        Object.defineProperty(mat, "alpha", { get() { return _alpha; }, set(n) { _alpha = n; sync(); } });
        Object.defineProperty(mat, "baseColorTexture", { get() { return o.baseColorTexture || null; }, set(t) { _texBase = texId(t); sync(); } });
        Object.defineProperty(mat, "ormTexture", { get() { return o.ormTexture || null; }, set(t) { _texMR = texId(t); sync(); } });
        sync();
        return mat;
    };
})(globalThis.__BL);
