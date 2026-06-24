// Environment / IBL loader (mirrors src/loader-env). Parses a Babylon `.env` file
// (prefiltered specular cubemap + SH irradiance) in JS and hands it to C++:
//   - 9 SH polynomial coefficients → pre-scaled harmonics (Babylon's conversion) → __bl_setEnvSH
//   - 48 prefiltered specular PNG faces (8 mips × 6 faces) → __bl_setEnvFace (C++ decodes + RGBD)
// C++ builds the bgfx cubemap and the PBR shader samples SH (diffuse) + the cubemap (specular).
(function (BL) {
    "use strict";

    // Babylon SphericalPolynomial → pre-scaled SphericalHarmonics (matches Lite's
    // polynomialToPreScaledHarmonics). Input: 27 floats [x,y,z,xx,yy,zz,yz,zx,xy]×rgb.
    // Output: 36 floats = 9 × vec4 (L00,L1_1,L10,L11,L2_2,L2_1,L20,L21,L22), rgb + pad.
    function polynomialToPreScaledHarmonics(poly) {
        const C00xy = 0.3333338747897695, C00z = 0.33333298856284405;
        const C1 = 1.4999984284682104, C2 = 3.999982863580422;
        const C20zz = 1.3333326611423701, C20xy = 0.6666653397393608, C22 = 1.999991431790211;
        const out = new Float32Array(36);
        for (let i = 0; i < 3; i++) {
            const x = poly[i], y = poly[3 + i], z = poly[6 + i];
            const xx = poly[9 + i], yy = poly[12 + i], zz = poly[15 + i];
            const yz = poly[18 + i], zx = poly[21 + i], xy = poly[24 + i];
            out[i] = (xx + yy) * C00xy + zz * C00z;       // L00
            out[4 + i] = y * C1;                          // L1_1
            out[8 + i] = z * C1;                          // L10
            out[12 + i] = x * C1;                         // L11
            out[16 + i] = xy * C2;                        // L2_2
            out[20 + i] = yz * C2;                        // L2_1
            out[24 + i] = zz * C20zz - (xx + yy) * C20xy; // L20
            out[28 + i] = zx * C2;                        // L21
            out[32 + i] = (xx - yy) * C22;                // L22
        }
        return out;
    }

    BL.loadEnvironment = async function (scene, url, options) {
        await BL.ensureCached(String(url));
        const raw = __bl_readFile(String(url));
        if (!raw) { return Promise.resolve(); } // no env file → keep hemispheric fallback
        const bytes = new Uint8Array(raw);
        // 8-byte magic, then a null-terminated UTF-8 JSON manifest, then the binary payload.
        let p = 8;
        while (p < bytes.length && bytes[p] !== 0) { p++; }
        const json = JSON.parse(BL.utf8Decode(bytes.subarray(8, p)));
        const binaryStart = p + 1;

        const width = json.width;
        const irr = json.irradiance;
        if (irr) {
            const keys = ["x", "y", "z", "xx", "yy", "zz", "yz", "zx", "xy"];
            const poly = new Float32Array(27);
            for (let i = 0; i < 9; i++) {
                const c = irr[keys[i]] || [0, 0, 0];
                poly[i * 3] = c[0]; poly[i * 3 + 1] = c[1]; poly[i * 3 + 2] = c[2];
            }
            __bl_setEnvSH(polynomialToPreScaledHarmonics(poly));
        }

        const mipmaps = (json.specular && json.specular.mipmaps) || [];
        const mipCount = Math.log2(width) + 1;
        __bl_createEnvironment(width, mipCount);
        // Flat order: mip0_face0..5, mip1_face0..5, ... → entry e = mip*6 + face.
        for (let e = 0; e < mipmaps.length; e++) {
            const m = mipmaps[e];
            const face = e % 6;
            const mip = (e / 6) | 0;
            const png = new Uint8Array(raw, binaryStart + m.position, m.length);
            __bl_setEnvFace(mip, face, png);
        }
        // Babylon `.env` image-processing: tone mapping on, exposure 0.8, contrast 1.2,
        // and the prefilter LOD-generation scale (default 0.8) used by the specular LOD.
        __bl_setEnvParams(1.0, 0.8, 0.8, 1.2);
        return Promise.resolve();
    };

    // Prefiltered HDR IBL — not yet parsed natively; keep the call accepted (no-op) so
    // scenes load. (.env is the implemented path.)
    BL.loadHdrEnvironment = function (scene, url, options) {
        return Promise.resolve();
    };
})(globalThis.__BL);
