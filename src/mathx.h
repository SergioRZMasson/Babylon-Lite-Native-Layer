#pragma once

// Shared column-major (bgfx) 4x4 math helpers for the native scene/lite engines.
// All matrices are 16 floats, element(row r, col c) = m[c*4 + r], matching bgfx's
// setTransform/setViewTransform and the shaders' mul(M, v) = M * v.

#include <cmath>
#include <cstdint>

namespace mathx {

inline void identity(float* m) {
    for (int i = 0; i < 16; ++i) { m[i] = 0.0f; }
    m[0] = m[5] = m[10] = m[15] = 1.0f;
}

// out = a * b (column-major). out must not alias a or b.
inline void mul(float* out, const float* a, const float* b) {
    for (int col = 0; col < 4; ++col) {
        for (int row = 0; row < 4; ++row) {
            out[col * 4 + row] =
                a[0 * 4 + row] * b[col * 4 + 0] +
                a[1 * 4 + row] * b[col * 4 + 1] +
                a[2 * 4 + row] * b[col * 4 + 2] +
                a[3 * 4 + row] * b[col * 4 + 3];
        }
    }
}

// Babylon-compatible local matrix: T(pos) * R(yaw=ry, pitch=rx, roll=rz) * S(scale),
// where R uses Babylon's RotationYawPitchRoll order (Y then X then Z). Euler angles
// in radians. Non-uniform scale supported.
inline void composeTRS(float* m, const float px, const float py, const float pz,
                       const float rx, const float ry, const float rz,
                       const float sx, const float sy, const float sz) {
    // Quaternion from yaw-pitch-roll (matches BABYLON.Quaternion.RotationYawPitchRoll).
    const float halfRoll = rz * 0.5f, halfPitch = rx * 0.5f, halfYaw = ry * 0.5f;
    const float sr = std::sin(halfRoll), cr = std::cos(halfRoll);
    const float sp = std::sin(halfPitch), cp = std::cos(halfPitch);
    const float sy_ = std::sin(halfYaw), cy_ = std::cos(halfYaw);
    const float qx = cy_ * sp * cr + sy_ * cp * sr;
    const float qy = sy_ * cp * cr - cy_ * sp * sr;
    const float qz = cy_ * cp * sr - sy_ * sp * cr;
    const float qw = cy_ * cp * cr + sy_ * sp * sr;

    // Rotation matrix (row-major math) from quaternion, pre-scaled per column.
    const float xx = qx * qx, yy = qy * qy, zz = qz * qz;
    const float xy = qx * qy, zw = qz * qw, xz = qx * qz;
    const float yw = qy * qw, yz = qy * qz, xw = qx * qw;
    const float r00 = 1 - 2 * (yy + zz), r01 = 2 * (xy - zw),     r02 = 2 * (xz + yw);
    const float r10 = 2 * (xy + zw),     r11 = 1 - 2 * (xx + zz), r12 = 2 * (yz - xw);
    const float r20 = 2 * (xz - yw),     r21 = 2 * (yz + xw),     r22 = 1 - 2 * (xx + yy);

    m[0] = r00 * sx; m[1] = r10 * sx; m[2] = r20 * sx; m[3] = 0;   // col 0 (scaled by sx)
    m[4] = r01 * sy; m[5] = r11 * sy; m[6] = r21 * sy; m[7] = 0;   // col 1
    m[8] = r02 * sz; m[9] = r12 * sz; m[10] = r22 * sz; m[11] = 0; // col 2
    m[12] = px; m[13] = py; m[14] = pz; m[15] = 1;                 // col 3
}

// Extract 6 normalized frustum planes from a column-major viewProj (proj*view),
// for D3D-style NDC (z in [0,1]). Inside = (a*x + b*y + c*z + d) >= 0.
inline void extractFrustum(const float* vp, float planes[6][4]) {
    const float r0[4] = { vp[0], vp[4], vp[8], vp[12] };
    const float r1[4] = { vp[1], vp[5], vp[9], vp[13] };
    const float r2[4] = { vp[2], vp[6], vp[10], vp[14] };
    const float r3[4] = { vp[3], vp[7], vp[11], vp[15] };
    auto setPlane = [&](int i, float a, float b, float c, float d) {
        const float inv = 1.0f / std::sqrt(a * a + b * b + c * c);
        planes[i][0] = a * inv; planes[i][1] = b * inv; planes[i][2] = c * inv; planes[i][3] = d * inv;
    };
    setPlane(0, r3[0] + r0[0], r3[1] + r0[1], r3[2] + r0[2], r3[3] + r0[3]);
    setPlane(1, r3[0] - r0[0], r3[1] - r0[1], r3[2] - r0[2], r3[3] - r0[3]);
    setPlane(2, r3[0] + r1[0], r3[1] + r1[1], r3[2] + r1[2], r3[3] + r1[3]);
    setPlane(3, r3[0] - r1[0], r3[1] - r1[1], r3[2] - r1[2], r3[3] - r1[3]);
    setPlane(4, r2[0], r2[1], r2[2], r2[3]);
    setPlane(5, r3[0] - r2[0], r3[1] - r2[1], r3[2] - r2[2], r3[3] - r2[3]);
}

inline bool sphereInFrustum(const float planes[6][4], float cx, float cy, float cz, float r) {
    for (int p = 0; p < 6; ++p) {
        if (planes[p][0] * cx + planes[p][1] * cy + planes[p][2] * cz + planes[p][3] < -r) {
            return false;
        }
    }
    return true;
}

// Compose a column-major affine from translation, quaternion (qx,qy,qz,qw), scale.
// Matches Babylon's Matrix.Compose (used for glTF node TRS + animation sampling).
inline void composeTRSQuat(float* m, const float* t, const float* q, const float* s) {
    const float qx = q[0], qy = q[1], qz = q[2], qw = q[3];
    const float xx = qx * qx, yy = qy * qy, zz = qz * qz;
    const float xy = qx * qy, zw = qz * qw, xz = qx * qz;
    const float yw = qy * qw, yz = qy * qz, xw = qx * qw;
    const float r00 = 1 - 2 * (yy + zz), r01 = 2 * (xy - zw),     r02 = 2 * (xz + yw);
    const float r10 = 2 * (xy + zw),     r11 = 1 - 2 * (xx + zz), r12 = 2 * (yz - xw);
    const float r20 = 2 * (xz - yw),     r21 = 2 * (yz + xw),     r22 = 1 - 2 * (xx + yy);
    m[0] = r00 * s[0]; m[1] = r10 * s[0]; m[2] = r20 * s[0]; m[3] = 0;
    m[4] = r01 * s[1]; m[5] = r11 * s[1]; m[6] = r21 * s[1]; m[7] = 0;
    m[8] = r02 * s[2]; m[9] = r12 * s[2]; m[10] = r22 * s[2]; m[11] = 0;
    m[12] = t[0]; m[13] = t[1]; m[14] = t[2]; m[15] = 1;
}

// Spherical linear interpolation of unit quaternions (Babylon Quaternion.Slerp).
// out may alias neither a nor b. Falls back to NLERP when the quaternions are close.
inline void quatSlerp(float* out, const float* a, const float* b, float t) {
    float bx = b[0], by = b[1], bz = b[2], bw = b[3];
    float cosom = a[0] * bx + a[1] * by + a[2] * bz + a[3] * bw;
    if (cosom < 0.0f) { cosom = -cosom; bx = -bx; by = -by; bz = -bz; bw = -bw; }
    float sa, sb;
    if (1.0f - cosom > 1e-6f) {
        const float omega = std::acos(cosom);
        const float sinom = std::sin(omega);
        sa = std::sin((1.0f - t) * omega) / sinom;
        sb = std::sin(t * omega) / sinom;
    } else {
        sa = 1.0f - t; sb = t;
    }
    out[0] = sa * a[0] + sb * bx;
    out[1] = sa * a[1] + sb * by;
    out[2] = sa * a[2] + sb * bz;
    out[3] = sa * a[3] + sb * bw;
}

// Inverse of a general column-major 4x4 (full cofactor inverse). Returns false (and
// leaves out = identity) if the matrix is singular. Used for invMeshWorld in skinning.
inline bool invert(float* out, const float* m) {
    float inv[16];
    inv[0] = m[5]*m[10]*m[15] - m[5]*m[11]*m[14] - m[9]*m[6]*m[15] + m[9]*m[7]*m[14] + m[13]*m[6]*m[11] - m[13]*m[7]*m[10];
    inv[4] = -m[4]*m[10]*m[15] + m[4]*m[11]*m[14] + m[8]*m[6]*m[15] - m[8]*m[7]*m[14] - m[12]*m[6]*m[11] + m[12]*m[7]*m[10];
    inv[8] = m[4]*m[9]*m[15] - m[4]*m[11]*m[13] - m[8]*m[5]*m[15] + m[8]*m[7]*m[13] + m[12]*m[5]*m[11] - m[12]*m[7]*m[9];
    inv[12] = -m[4]*m[9]*m[14] + m[4]*m[10]*m[13] + m[8]*m[5]*m[14] - m[8]*m[6]*m[13] - m[12]*m[5]*m[10] + m[12]*m[6]*m[9];
    inv[1] = -m[1]*m[10]*m[15] + m[1]*m[11]*m[14] + m[9]*m[2]*m[15] - m[9]*m[3]*m[14] - m[13]*m[2]*m[11] + m[13]*m[3]*m[10];
    inv[5] = m[0]*m[10]*m[15] - m[0]*m[11]*m[14] - m[8]*m[2]*m[15] + m[8]*m[3]*m[14] + m[12]*m[2]*m[11] - m[12]*m[3]*m[10];
    inv[9] = -m[0]*m[9]*m[15] + m[0]*m[11]*m[13] + m[8]*m[1]*m[15] - m[8]*m[3]*m[13] - m[12]*m[1]*m[11] + m[12]*m[3]*m[9];
    inv[13] = m[0]*m[9]*m[14] - m[0]*m[10]*m[13] - m[8]*m[1]*m[14] + m[8]*m[2]*m[13] + m[12]*m[1]*m[10] - m[12]*m[2]*m[9];
    inv[2] = m[1]*m[6]*m[15] - m[1]*m[7]*m[14] - m[5]*m[2]*m[15] + m[5]*m[3]*m[14] + m[13]*m[2]*m[7] - m[13]*m[3]*m[6];
    inv[6] = -m[0]*m[6]*m[15] + m[0]*m[7]*m[14] + m[4]*m[2]*m[15] - m[4]*m[3]*m[14] - m[12]*m[2]*m[7] + m[12]*m[3]*m[6];
    inv[10] = m[0]*m[5]*m[15] - m[0]*m[7]*m[13] - m[4]*m[1]*m[15] + m[4]*m[3]*m[13] + m[12]*m[1]*m[7] - m[12]*m[3]*m[5];
    inv[14] = -m[0]*m[5]*m[14] + m[0]*m[6]*m[13] + m[4]*m[1]*m[14] - m[4]*m[2]*m[13] - m[12]*m[1]*m[6] + m[12]*m[2]*m[5];
    inv[3] = -m[1]*m[6]*m[11] + m[1]*m[7]*m[10] + m[5]*m[2]*m[11] - m[5]*m[3]*m[10] - m[9]*m[2]*m[7] + m[9]*m[3]*m[6];
    inv[7] = m[0]*m[6]*m[11] - m[0]*m[7]*m[10] - m[4]*m[2]*m[11] + m[4]*m[3]*m[10] + m[8]*m[2]*m[7] - m[8]*m[3]*m[6];
    inv[11] = -m[0]*m[5]*m[11] + m[0]*m[7]*m[9] + m[4]*m[1]*m[11] - m[4]*m[3]*m[9] - m[8]*m[1]*m[7] + m[8]*m[3]*m[5];
    inv[15] = m[0]*m[5]*m[10] - m[0]*m[6]*m[9] - m[4]*m[1]*m[10] + m[4]*m[2]*m[9] + m[8]*m[1]*m[6] - m[8]*m[2]*m[5];
    float det = m[0]*inv[0] + m[1]*inv[4] + m[2]*inv[8] + m[3]*inv[12];
    if (det > -1e-12f && det < 1e-12f) { identity(out); return false; }
    det = 1.0f / det;
    for (int i = 0; i < 16; ++i) { out[i] = inv[i] * det; }
    return true;
}

} // namespace mathx
