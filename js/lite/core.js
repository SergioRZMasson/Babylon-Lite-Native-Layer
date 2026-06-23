// Internal proxy helpers + shared loader state. Mirrors the "plain-data + behaviour"
// split of Babylon-Lite, but here the data lives in C++ and these proxies forward to it.
(function (BL) {
    "use strict";

    BL.makeVec3 = function (x, y, z, onChange) {
        let _x = x, _y = y, _z = z;
        const v = {
            set(a, b, c) { _x = a; _y = b; _z = c; onChange(); return v; },
            copyFromFloats(a, b, c) { _x = a; _y = b; _z = c; onChange(); return v; },
        };
        Object.defineProperty(v, "x", { get() { return _x; }, set(n) { _x = n; onChange(); } });
        Object.defineProperty(v, "y", { get() { return _y; }, set(n) { _y = n; onChange(); } });
        Object.defineProperty(v, "z", { get() { return _z; }, set(n) { _z = n; onChange(); } });
        return v;
    };

    BL.makeColor3 = function (r, g, b, onChange) {
        let _r = r, _g = g, _b = b;
        const c = { set(a, b2, c2) { _r = a; _g = b2; _b = c2; onChange(); return c; } };
        Object.defineProperty(c, "r", { get() { return _r; }, set(n) { _r = n; onChange(); } });
        Object.defineProperty(c, "g", { get() { return _g; }, set(n) { _g = n; onChange(); } });
        Object.defineProperty(c, "b", { get() { return _b; }, set(n) { _b = n; onChange(); } });
        return c;
    };

    // Shared state across modules (e.g. model bounds from the last glTF load, used by
    // createDefaultCamera). Mirrors how Babylon's createDefaultCamera reads scene bounds.
    BL._state = { lastSceneId: -1, bounds: null };

    BL._growBounds = function (x, y, z) {
        const s = BL._state;
        if (!s.bounds) { s.bounds = { min: [x, y, z], max: [x, y, z] }; return; }
        const b = s.bounds;
        if (x < b.min[0]) { b.min[0] = x; } if (y < b.min[1]) { b.min[1] = y; } if (z < b.min[2]) { b.min[2] = z; }
        if (x > b.max[0]) { b.max[0] = x; } if (y > b.max[1]) { b.max[1] = y; } if (z > b.max[2]) { b.max[2] = z; }
    };

    // UTF-8 decoder (QuickJS has no TextDecoder). Used to read the glTF JSON chunk.
    BL.utf8Decode = function (bytes) {
        if (typeof TextDecoder !== "undefined") { return new TextDecoder().decode(bytes); }
        let out = "", i = 0;
        const len = bytes.length;
        while (i < len) {
            const c = bytes[i++];
            if (c < 0x80) { out += String.fromCharCode(c); }
            else if (c < 0xe0) { out += String.fromCharCode(((c & 0x1f) << 6) | (bytes[i++] & 0x3f)); }
            else if (c < 0xf0) { out += String.fromCharCode(((c & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f)); }
            else {
                const cp = ((c & 0x07) << 18) | ((bytes[i++] & 0x3f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
                const u = cp - 0x10000;
                out += String.fromCharCode(0xd800 + (u >> 10), 0xdc00 + (u & 0x3ff));
            }
        }
        return out;
    };
})(globalThis.__BL);
