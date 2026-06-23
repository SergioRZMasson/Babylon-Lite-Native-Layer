// Light factories (mirrors src/light).
(function (BL) {
    "use strict";

    BL.createHemisphericLight = function (direction, intensity) {
        const d = direction || [0, 1, 0];
        const id = __bl_createLight(d[0], d[1], d[2], intensity == null ? 1 : intensity);
        const light = { _id: id, _kind: "light" };
        let _intensity = intensity == null ? 1 : intensity;
        function sync() {
            __bl_setLight(id, light.direction.x, light.direction.y, light.direction.z, _intensity,
                light.diffuseColor.r, light.diffuseColor.g, light.diffuseColor.b,
                light.groundColor.r, light.groundColor.g, light.groundColor.b);
        }
        light.direction = BL.makeVec3(d[0], d[1], d[2], sync);
        light.diffuseColor = BL.makeColor3(1, 1, 1, sync);
        light.specularColor = BL.makeColor3(1, 1, 1, sync);
        light.groundColor = BL.makeColor3(0, 0, 0, sync);
        Object.defineProperty(light, "intensity", { get() { return _intensity; }, set(n) { _intensity = n; sync(); } });
        return light;
    };
})(globalThis.__BL);
