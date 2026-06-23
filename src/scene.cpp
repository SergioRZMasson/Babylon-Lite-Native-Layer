#include "scene.h"

#include "gfx.h"
#include "js_host.h"
#include "napi_helpers.h"

#include <chrono>
#include <cmath>

namespace scene {

namespace {

// Column-major (bgfx) 4x4 helpers. Index(row r, col c) = c*4 + r.

// local = T(px,py,pz) * R(axis, angle) * S(scale), with axis normalized.
void composeLocal(float* m, float px, float py, float pz, float s,
                  float ax, float ay, float az, float angle) {
    const float c = std::cos(angle);
    const float sn = std::sin(angle);
    const float t = 1.0f - c;

    // Rotation (row-major math), stored column-major and pre-scaled by s.
    const float r00 = (c + ax * ax * t) * s;
    const float r01 = (ax * ay * t - az * sn) * s;
    const float r02 = (ax * az * t + ay * sn) * s;
    const float r10 = (ay * ax * t + az * sn) * s;
    const float r11 = (c + ay * ay * t) * s;
    const float r12 = (ay * az * t - ax * sn) * s;
    const float r20 = (az * ax * t - ay * sn) * s;
    const float r21 = (az * ay * t + ax * sn) * s;
    const float r22 = (c + az * az * t) * s;

    m[0] = r00; m[1] = r10; m[2] = r20; m[3] = 0.0f;   // col 0
    m[4] = r01; m[5] = r11; m[6] = r21; m[7] = 0.0f;   // col 1
    m[8] = r02; m[9] = r12; m[10] = r22; m[11] = 0.0f; // col 2
    m[12] = px; m[13] = py; m[14] = pz; m[15] = 1.0f;  // col 3 (translation)
}

// out = a * b (column-major). out may not alias a or b.
void mul(float* out, const float* a, const float* b) {
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

// Extract 6 frustum planes from a column-major viewProj (clip = VP * worldPos),
// for a D3D-style NDC (z in [0,1]). Planes are normalized; inside = dot >= 0.
void extractFrustum(const float* vp, float planes[6][4]) {
    // Rows of VP: row_i = (vp[i], vp[4+i], vp[8+i], vp[12+i]).
    const float r0[4] = { vp[0], vp[4], vp[8], vp[12] };
    const float r1[4] = { vp[1], vp[5], vp[9], vp[13] };
    const float r2[4] = { vp[2], vp[6], vp[10], vp[14] };
    const float r3[4] = { vp[3], vp[7], vp[11], vp[15] };
    auto setPlane = [&](int idx, float a, float b, float c, float d) {
        const float inv = 1.0f / std::sqrt(a * a + b * b + c * c);
        planes[idx][0] = a * inv;
        planes[idx][1] = b * inv;
        planes[idx][2] = c * inv;
        planes[idx][3] = d * inv;
    };
    setPlane(0, r3[0] + r0[0], r3[1] + r0[1], r3[2] + r0[2], r3[3] + r0[3]); // left
    setPlane(1, r3[0] - r0[0], r3[1] - r0[1], r3[2] - r0[2], r3[3] - r0[3]); // right
    setPlane(2, r3[0] + r1[0], r3[1] + r1[1], r3[2] + r1[2], r3[3] + r1[3]); // bottom
    setPlane(3, r3[0] - r1[0], r3[1] - r1[1], r3[2] - r1[2], r3[3] - r1[3]); // top
    setPlane(4, r2[0], r2[1], r2[2], r2[3]);                                 // near (z>=0)
    setPlane(5, r3[0] - r2[0], r3[1] - r2[1], r3[2] - r2[2], r3[3] - r2[3]); // far
}

} // namespace

int Scene::addNode(int meshId, int parent,
                   float px, float py, float pz, float scale,
                   float axisX, float axisY, float axisZ,
                   float spinSpeed, float phase, float boundRadius) {
    // Normalize the spin axis (default to +Y if degenerate).
    float len = std::sqrt(axisX * axisX + axisY * axisY + axisZ * axisZ);
    if (len < 1e-6f) { axisX = 0; axisY = 1; axisZ = 0; len = 1.0f; }
    const float inv = 1.0f / len;

    parent_.push_back(parent);
    meshId_.push_back(meshId);
    px_.push_back(px); py_.push_back(py); pz_.push_back(pz);
    scale_.push_back(scale);
    ax_.push_back(axisX * inv); ay_.push_back(axisY * inv); az_.push_back(axisZ * inv);
    spinSpeed_.push_back(spinSpeed); phase_.push_back(phase);
    radius_.push_back(boundRadius * scale);

    const size_t n = parent_.size();
    local_.resize(n * 16);
    world_.resize(n * 16);
    visible_.resize(n);
    return int(n - 1);
}

void Scene::taskAnimate(float timeSec) {
    const int n = nodeCount();
    for (int i = 0; i < n; ++i) {
        const float angle = phase_[i] + spinSpeed_[i] * timeSec;
        composeLocal(&local_[size_t(i) * 16], px_[i], py_[i], pz_[i], scale_[i],
                     ax_[i], ay_[i], az_[i], angle);
    }
}

void Scene::taskWorld() {
    const int n = nodeCount();
    for (int i = 0; i < n; ++i) {
        const int p = parent_[i];
        if (p < 0) {
            for (int k = 0; k < 16; ++k) {
                world_[size_t(i) * 16 + k] = local_[size_t(i) * 16 + k];
            }
        } else {
            mul(&world_[size_t(i) * 16], &world_[size_t(p) * 16], &local_[size_t(i) * 16]);
        }
    }
}

void Scene::taskCull(const float frustum[6][4]) {
    const int n = nodeCount();
    int vis = 0;
    for (int i = 0; i < n; ++i) {
        const float* w = &world_[size_t(i) * 16];
        const float cx = w[12], cy = w[13], cz = w[14]; // world-space center
        const float r = radius_[i];
        bool inside = true;
        for (int pl = 0; pl < 6; ++pl) {
            const float d = frustum[pl][0] * cx + frustum[pl][1] * cy + frustum[pl][2] * cz + frustum[pl][3];
            if (d < -r) { inside = false; break; }
        }
        visible_[i] = inside ? 1u : 0u;
        vis += inside ? 1 : 0;
    }
    lastVisible_ = vis;
}

int Scene::taskDraw(gfx::Gfx& g) {
    const int n = nodeCount();
    int draws = 0;
    for (int i = 0; i < n; ++i) {
        if (visible_[i]) {
            g.drawMesh(meshId_[i], &world_[size_t(i) * 16]);
            ++draws;
        }
    }
    return draws;
}

int Scene::executeFrame(gfx::Gfx& g, float timeSec) {
    float vp[16];
    g.getViewProj(vp);
    float frustum[6][4];
    extractFrustum(vp, frustum);

    // Time only the CPU scene-traversal tasks (animate+world+cull), not the draw.
    const auto t0 = std::chrono::steady_clock::now();
    taskAnimate(timeSec);
    taskWorld();
    taskCull(frustum);
    const auto t1 = std::chrono::steady_clock::now();
    lastTraverseMs_ = std::chrono::duration<double, std::milli>(t1 - t0).count();

    return taskDraw(g);
}

void Scene::registerOn(js::Host& host) {
    host.registerFunction("scene.addNode", [this](const Napi::CallbackInfo& info) -> Napi::Value {
        // meshId, parent, px,py,pz, scale, axisX,axisY,axisZ, spinSpeed, phase, boundRadius
        const double def[12] = { 0, -1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 1.732f };
        double a[12];
        for (int i = 0; i < 12; ++i) { a[i] = js::argNum(info, size_t(i), def[i]); }
        const int id = addNode(int(a[0]), int(a[1]),
                               float(a[2]), float(a[3]), float(a[4]), float(a[5]),
                               float(a[6]), float(a[7]), float(a[8]),
                               float(a[9]), float(a[10]), float(a[11]));
        return Napi::Number::New(info.Env(), id);
    });

    host.registerFunction("scene.start", [this](const Napi::CallbackInfo& info) -> Napi::Value {
        start();
        return Napi::Number::New(info.Env(), nodeCount());
    });

    host.registerFunction("scene.nodeCount", [this](const Napi::CallbackInfo& info) -> Napi::Value {
        return Napi::Number::New(info.Env(), nodeCount());
    });
}

} // namespace scene
