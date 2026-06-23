// Light factories (mirrors src/light). The native engine renders a single primary
// light (direction + diffuse + ground/ambient). Directional/point/spot all map onto
// that here: directional uses its direction, point/spot derive a direction from their
// position so the scene is lit plausibly. `.diffuse`/`.specular` accept Babylon tuples
// ([r,g,b]) or per-channel mutation.
(function (BL) {
    "use strict";

    function normalize(x, y, z) {
        const l = Math.hypot(x, y, z) || 1;
        return [x / l, y / l, z / l];
    }

    function makeLight(dir, intensity, ground) {
        const d = normalize(dir[0], dir[1], dir[2]);
        const id = __bl_createLight(d[0], d[1], d[2], intensity == null ? 1 : intensity);
        const light = { _id: id, _kind: "light" };
        let _intensity = intensity == null ? 1 : intensity;
        function sync() {
            __bl_setLight(id, light.direction.x, light.direction.y, light.direction.z, _intensity,
                light.diffuse.r, light.diffuse.g, light.diffuse.b,
                light.groundColor.r, light.groundColor.g, light.groundColor.b);
        }
        light.direction = BL.makeVec3(d[0], d[1], d[2], sync);
        BL.makeColorProp(light, "diffuse", 1, 1, 1, sync);
        BL.makeColorProp(light, "specular", 1, 1, 1, sync);   // accepted; native shader ignores for now
        BL.makeColorProp(light, "groundColor", ground[0], ground[1], ground[2], sync);
        Object.defineProperty(light, "diffuseColor", { get() { return light.diffuse; }, set(v) { light.diffuse = v; } });
        Object.defineProperty(light, "specularColor", { get() { return light.specular; }, set(v) { light.specular = v; } });
        Object.defineProperty(light, "intensity", { get() { return _intensity; }, set(n) { _intensity = n; sync(); } });
        sync();
        return light;
    }

    BL.createHemisphericLight = function (direction, intensity) {
        const l = makeLight(direction || [0, 1, 0], intensity, [0, 0, 0]);
        l._lightType = "hemispheric";
        return l;
    };

    BL.createDirectionalLight = function (direction, intensity) {
        const l = makeLight(direction || [0, -1, 0], intensity, [0, 0, 0]);
        l._lightType = "directional";
        l.position = BL.makeVec3(0, 0, 0, function () {});
        return l;
    };

    // Point light: single-direction approximation (points from the light toward origin).
    BL.createPointLight = function (position, intensity) {
        const p = position || [0, 1, 0];
        const dir = normalize(-p[0], -p[1], -p[2]);
        const l = makeLight(dir, intensity, [0, 0, 0]);
        l._lightType = "point";
        l.position = BL.makeVec3(p[0], p[1], p[2], function () {
            const nd = normalize(-l.position.x, -l.position.y, -l.position.z);
            l.direction.set(nd[0], nd[1], nd[2]);
        });
        return l;
    };

    BL.createSpotLight = function (position, direction, angle, exponent, intensity) {
        const l = makeLight(direction || [0, -1, 0], intensity, [0, 0, 0]);
        l._lightType = "spot";
        const p = position || [0, 1, 0];
        l.position = BL.makeVec3(p[0], p[1], p[2], function () {});
        l.angle = angle == null ? Math.PI / 3 : angle;
        l.exponent = exponent == null ? 2 : exponent;
        return l;
    };
})(globalThis.__BL);
