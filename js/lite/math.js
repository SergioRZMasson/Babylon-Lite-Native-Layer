// Column-major 4x4 helpers (bgfx/Babylon convention), mirroring src/math usage.
(function (BL) {
    "use strict";

    // mat4Compose(translation, quaternion, scale) — column-major. Public API parity.
    BL.mat4Compose = function (tx, ty, tz, qx, qy, qz, qw, sx, sy, sz) {
        const m = new Float32Array(16);
        const xx = qx * qx, yy = qy * qy, zz = qz * qz;
        const xy = qx * qy, zw = qz * qw, xz = qx * qz, yw = qy * qw, yz = qy * qz, xw = qx * qw;
        m[0] = (1 - 2 * (yy + zz)) * sx; m[1] = (2 * (xy + zw)) * sx; m[2] = (2 * (xz - yw)) * sx; m[3] = 0;
        m[4] = (2 * (xy - zw)) * sy; m[5] = (1 - 2 * (xx + zz)) * sy; m[6] = (2 * (yz + xw)) * sy; m[7] = 0;
        m[8] = (2 * (xz + yw)) * sz; m[9] = (2 * (yz - xw)) * sz; m[10] = (1 - 2 * (xx + yy)) * sz; m[11] = 0;
        m[12] = tx; m[13] = ty; m[14] = tz; m[15] = 1;
        return m;
    };

    // out = a * b (column-major).
    BL.mat4Multiply = function (a, b) {
        const o = new Float32Array(16);
        for (let c = 0; c < 4; c++) {
            for (let r = 0; r < 4; r++) {
                o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
            }
        }
        return o;
    };

    // Transform a point by a column-major 4x4 (affine).
    BL.mat4TransformPoint = function (m, x, y, z) {
        return [
            m[0] * x + m[4] * y + m[8] * z + m[12],
            m[1] * x + m[5] * y + m[9] * z + m[13],
            m[2] * x + m[6] * y + m[10] * z + m[14],
        ];
    };
})(globalThis.__BL);
