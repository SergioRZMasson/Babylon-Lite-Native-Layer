// Column-major 4x4 helpers (bgfx/Babylon convention), mirroring src/math usage.

// mat4Compose(translation, quaternion, scale) — column-major. Public API parity.
export function mat4Compose(
    tx: number, ty: number, tz: number,
    qx: number, qy: number, qz: number, qw: number,
    sx: number, sy: number, sz: number,
): Float32Array {
    const m = new Float32Array(16);
    const xx = qx * qx, yy = qy * qy, zz = qz * qz;
    const xy = qx * qy, zw = qz * qw, xz = qx * qz, yw = qy * qw, yz = qy * qz, xw = qx * qw;
    m[0] = (1 - 2 * (yy + zz)) * sx; m[1] = (2 * (xy + zw)) * sx; m[2] = (2 * (xz - yw)) * sx; m[3] = 0;
    m[4] = (2 * (xy - zw)) * sy; m[5] = (1 - 2 * (xx + zz)) * sy; m[6] = (2 * (yz + xw)) * sy; m[7] = 0;
    m[8] = (2 * (xz + yw)) * sz; m[9] = (2 * (yz - xw)) * sz; m[10] = (1 - 2 * (xx + yy)) * sz; m[11] = 0;
    m[12] = tx; m[13] = ty; m[14] = tz; m[15] = 1;
    return m;
}

// out = a * b (column-major).
export function mat4Multiply(a: ArrayLike<number>, b: ArrayLike<number>): Float32Array {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) {
        for (let r = 0; r < 4; r++) {
            o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
        }
    }
    return o;
}

// Transform a point by a column-major 4x4 (affine).
export function mat4TransformPoint(m: ArrayLike<number>, x: number, y: number, z: number): number[] {
    return [
        m[0] * x + m[4] * y + m[8] * z + m[12],
        m[1] * x + m[5] * y + m[9] * z + m[13],
        m[2] * x + m[6] * y + m[10] * z + m[14],
    ];
}

// Decompose a column-major affine 4x4 into { t:[3], r:[4]quat, s:[3] }. Mirrors Babylon
// Matrix.decompose: scale = column lengths (sign from determinant on X), rotation =
// quaternion from the scale-removed rotation basis. Used for glTF nodes that supply a
// `matrix` instead of TRS.
export function decomposeMat4(m: ArrayLike<number>): { t: number[]; r: number[]; s: number[] } {
    const t = [m[12], m[13], m[14]];
    let sx = Math.hypot(m[0], m[1], m[2]);
    const sy = Math.hypot(m[4], m[5], m[6]);
    const sz = Math.hypot(m[8], m[9], m[10]);
    // Determinant sign → flip one scale axis to keep a right-handed rotation.
    const det = m[0] * (m[5] * m[10] - m[6] * m[9]) - m[4] * (m[1] * m[10] - m[2] * m[9]) + m[8] * (m[1] * m[6] - m[2] * m[5]);
    if (det < 0) { sx = -sx; }
    const isx = sx ? 1 / sx : 0, isy = sy ? 1 / sy : 0, isz = sz ? 1 / sz : 0;
    const r00 = m[0] * isx, r10 = m[1] * isx, r20 = m[2] * isx;
    const r01 = m[4] * isy, r11 = m[5] * isy, r21 = m[6] * isy;
    const r02 = m[8] * isz, r12 = m[9] * isz, r22 = m[10] * isz;
    const trace = r00 + r11 + r22;
    let qx, qy, qz, qw;
    if (trace > 0) {
        const s = Math.sqrt(trace + 1) * 2; qw = 0.25 * s;
        qx = (r21 - r12) / s; qy = (r02 - r20) / s; qz = (r10 - r01) / s;
    } else if (r00 > r11 && r00 > r22) {
        const s = Math.sqrt(1 + r00 - r11 - r22) * 2; qw = (r21 - r12) / s;
        qx = 0.25 * s; qy = (r01 + r10) / s; qz = (r02 + r20) / s;
    } else if (r11 > r22) {
        const s = Math.sqrt(1 + r11 - r00 - r22) * 2; qw = (r02 - r20) / s;
        qx = (r01 + r10) / s; qy = 0.25 * s; qz = (r12 + r21) / s;
    } else {
        const s = Math.sqrt(1 + r22 - r00 - r11) * 2; qw = (r10 - r01) / s;
        qx = (r02 + r20) / s; qy = (r12 + r21) / s; qz = 0.25 * s;
    }
    return { t: t, r: [qx, qy, qz, qw], s: [sx, sy, sz] };
}
