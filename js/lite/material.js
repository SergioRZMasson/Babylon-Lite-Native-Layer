// Material factories (mirrors src/material).
(function (BL) {
    "use strict";

    BL.createStandardMaterial = function () {
        const id = __bl_createStandardMaterial();
        const mat = { _id: id, _kind: "material" };
        let _specularPower = 64, _alpha = 1;
        function sync() {
            __bl_setMaterial(id, mat.diffuseColor.r, mat.diffuseColor.g, mat.diffuseColor.b, _alpha,
                mat.specularColor.r, mat.specularColor.g, mat.specularColor.b, _specularPower);
        }
        mat.diffuseColor = BL.makeColor3(1, 1, 1, sync);
        mat.specularColor = BL.makeColor3(1, 1, 1, sync);
        mat.emissiveColor = BL.makeColor3(0, 0, 0, sync);
        Object.defineProperty(mat, "specularPower", { get() { return _specularPower; }, set(n) { _specularPower = n; sync(); } });
        Object.defineProperty(mat, "alpha", { get() { return _alpha; }, set(n) { _alpha = n; sync(); } });
        return mat;
    };

    // PBR (metallic-roughness) material for direct use; glTF materials are built by the loader.
    BL.createPbrMaterial = function (options) {
        const o = options || {};
        const id = __bl_createPbrMaterial();
        const mat = { _id: id, _kind: "material" };
        let _metallic = o.metallic == null ? 1 : o.metallic;
        let _roughness = o.roughness == null ? 1 : o.roughness;
        let _alpha = o.alpha == null ? 1 : o.alpha;
        function sync() {
            __bl_setPbrMaterial(id, mat.baseColor.r, mat.baseColor.g, mat.baseColor.b, _alpha,
                _metallic, _roughness, 1, 0, mat.emissiveColor.r, mat.emissiveColor.g, mat.emissiveColor.b,
                -1, -1, -1, -1, -1);
        }
        mat.baseColor = BL.makeColor3(o.r == null ? 1 : o.r, o.g == null ? 1 : o.g, o.b == null ? 1 : o.b, sync);
        mat.emissiveColor = BL.makeColor3(0, 0, 0, sync);
        Object.defineProperty(mat, "metallic", { get() { return _metallic; }, set(n) { _metallic = n; sync(); } });
        Object.defineProperty(mat, "roughness", { get() { return _roughness; }, set(n) { _roughness = n; sync(); } });
        Object.defineProperty(mat, "alpha", { get() { return _alpha; }, set(n) { _alpha = n; sync(); } });
        sync();
        return mat;
    };
})(globalThis.__BL);
