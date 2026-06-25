#include "lite.h"

#include "gfx.h"
#include "js_host.h"
#include "mathx.h"
#include "napi_helpers.h"

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>
#include <wincodec.h>   // Windows Imaging Component (PNG/JPEG decode) — no bundled decoders

#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <filesystem>
#include <fstream>
#include <vector>

namespace lite {

namespace {

constexpr float kPi = 3.14159265358979323846f;

// Decoded image: tightly-packed RGBA8 + dimensions.
struct DecodedImage {
    std::vector<uint8_t> rgba;
    int width = 0;
    int height = 0;
    bool ok() const { return width > 0 && height > 0 && !rgba.empty(); }
};

// Process-wide WIC factory (created on first use, released at process exit). WIC is the
// OS image codec, so we decode PNG/JPEG via Windows instead of bundling software decoders
// (lodepng/stb/tinyexr) — keeping the binary small (no bimg_decode).
IWICImagingFactory* wicFactory() {
    static IWICImagingFactory* s_factory = []() -> IWICImagingFactory* {
        // WIC needs COM on this (the JS) thread. MTA is fine; if COM is already initialized
        // in another mode, RPC_E_CHANGED_MODE is harmless — the factory still works.
        CoInitializeEx(nullptr, COINIT_MULTITHREADED);
        IWICImagingFactory* f = nullptr;
        if (FAILED(CoCreateInstance(CLSID_WICImagingFactory, nullptr, CLSCTX_INPROC_SERVER,
                                    IID_PPV_ARGS(&f)))) {
            return nullptr;
        }
        return f;
    }();
    return s_factory;
}

// Decode an encoded image (PNG/JPEG) to tightly-packed RGBA8 using WIC. Replaces the bundled
// software decoder (bimg/stb), so the binary carries no image-decode library.
DecodedImage decodeImageRGBA8(const uint8_t* data, size_t size) {
    DecodedImage out;
    if (!data || size == 0) { return out; }
    IWICImagingFactory* factory = wicFactory();
    if (!factory) { return out; }

    IWICStream* stream = nullptr;
    IWICBitmapDecoder* decoder = nullptr;
    IWICBitmapFrameDecode* frame = nullptr;
    IWICFormatConverter* converter = nullptr;

    HRESULT hr = factory->CreateStream(&stream);
    if (SUCCEEDED(hr)) { hr = stream->InitializeFromMemory(const_cast<BYTE*>(data), DWORD(size)); }
    if (SUCCEEDED(hr)) { hr = factory->CreateDecoderFromStream(stream, nullptr, WICDecodeMetadataCacheOnDemand, &decoder); }
    if (SUCCEEDED(hr)) { hr = decoder->GetFrame(0, &frame); }
    if (SUCCEEDED(hr)) { hr = factory->CreateFormatConverter(&converter); }
    if (SUCCEEDED(hr)) {
        // Convert whatever the source is to straight RGBA8 (matches createTexture2D /
        // uploadEnvFace byte order, same as the previous bimg RGBA8 output).
        hr = converter->Initialize(frame, GUID_WICPixelFormat32bppRGBA, WICBitmapDitherTypeNone,
                                   nullptr, 0.0, WICBitmapPaletteTypeCustom);
    }
    UINT w = 0, h = 0;
    if (SUCCEEDED(hr)) { hr = converter->GetSize(&w, &h); }
    if (SUCCEEDED(hr) && w > 0 && h > 0) {
        out.rgba.resize(size_t(w) * size_t(h) * 4);
        hr = converter->CopyPixels(nullptr, w * 4, UINT(out.rgba.size()), out.rgba.data());
        if (SUCCEEDED(hr)) { out.width = int(w); out.height = int(h); }
        else { out.rgba.clear(); }
    }
    if (converter) { converter->Release(); }
    if (frame) { frame->Release(); }
    if (decoder) { decoder->Release(); }
    if (stream) { stream->Release(); }
    return out;
}

std::string baseName(const std::string& p) {
    const size_t s = p.find_last_of("/\\");
    return s == std::string::npos ? p : p.substr(s + 1);
}

// Coerce argument i to a double (default `def` if missing/not a number).
double argf(const Napi::CallbackInfo& info, int i, double def) {
    return js::argNum(info, size_t(i), def);
}

struct Geom {
    std::vector<float> pos, nrm;
    std::vector<uint16_t> idx;
    float radius = 1.0f;
};

Geom makeBox(float size) {
    const float h = size * 0.5f;
    const float fn[6][3] = { {1,0,0}, {-1,0,0}, {0,1,0}, {0,-1,0}, {0,0,1}, {0,0,-1} };
    const float fv[6][4][3] = {
        { {h,-h,-h},{h,h,-h},{h,h,h},{h,-h,h} },
        { {-h,-h,h},{-h,h,h},{-h,h,-h},{-h,-h,-h} },
        { {-h,h,-h},{-h,h,h},{h,h,h},{h,h,-h} },
        { {-h,-h,h},{-h,-h,-h},{h,-h,-h},{h,-h,h} },
        { {h,-h,h},{h,h,h},{-h,h,h},{-h,-h,h} },
        { {-h,-h,-h},{-h,h,-h},{h,h,-h},{h,-h,-h} },
    };
    Geom g;
    for (int f = 0; f < 6; ++f) {
        const uint16_t base = uint16_t(g.pos.size() / 3);
        for (int k = 0; k < 4; ++k) {
            g.pos.insert(g.pos.end(), { fv[f][k][0], fv[f][k][1], fv[f][k][2] });
            g.nrm.insert(g.nrm.end(), { fn[f][0], fn[f][1], fn[f][2] });
        }
        g.idx.insert(g.idx.end(), { base, uint16_t(base + 1), uint16_t(base + 2), base, uint16_t(base + 2), uint16_t(base + 3) });
    }
    g.radius = h * 1.7320508f;
    return g;
}

Geom makeSphere(float diameter, int segments) {
    if (segments < 3) { segments = 3; }
    const float r = diameter * 0.5f;
    Geom g;
    const int rings = segments, sectors = segments;
    for (int ring = 0; ring <= rings; ++ring) {
        const float phi = kPi * float(ring) / float(rings);       // 0..pi
        const float y = std::cos(phi), sy = std::sin(phi);
        for (int s = 0; s <= sectors; ++s) {
            const float theta = 2.0f * kPi * float(s) / float(sectors);
            const float nx = sy * std::cos(theta), nz = sy * std::sin(theta);
            g.pos.insert(g.pos.end(), { nx * r, y * r, nz * r });
            g.nrm.insert(g.nrm.end(), { nx, y, nz });
        }
    }
    const int stride = sectors + 1;
    for (int ring = 0; ring < rings; ++ring) {
        for (int s = 0; s < sectors; ++s) {
            const uint16_t a = uint16_t(ring * stride + s);
            const uint16_t b = uint16_t((ring + 1) * stride + s);
            const uint16_t c = uint16_t((ring + 1) * stride + s + 1);
            const uint16_t d = uint16_t(ring * stride + s + 1);
            // CW winding (front) for outward-facing faces under CULL_CW.
            g.idx.insert(g.idx.end(), { a, d, c, a, c, b });
        }
    }
    g.radius = r;
    return g;
}

Geom makeGround(float width, float depth) {
    const float w = width * 0.5f, d = depth * 0.5f;
    Geom g;
    g.pos = { -w, 0, -d,  -w, 0, d,  w, 0, d,  w, 0, -d };
    g.nrm = { 0, 1, 0,  0, 1, 0,  0, 1, 0,  0, 1, 0 };
    g.idx = { 0, 1, 2,  0, 2, 3 };
    g.radius = std::sqrt(w * w + d * d);
    return g;
}

// Torus in the XZ plane (Babylon's createTorus orientation). `diameter` is the outer
// ring diameter, `thickness` the tube diameter, `tessellation` the segment count for
// both the ring and the tube. Outward normals; winding matches the other primitives.
Geom makeTorus(float diameter, float thickness, int tessellation) {
    if (tessellation < 3) { tessellation = 3; }
    const float R = (diameter - thickness) * 0.5f; // ring radius (center of tube)
    const float r = thickness * 0.5f;              // tube radius
    Geom g;
    const int N = tessellation;
    for (int i = 0; i <= N; ++i) {
        const float u = 2.0f * kPi * float(i) / float(N); // around the ring
        const float cu = std::cos(u), su = std::sin(u);
        for (int j = 0; j <= N; ++j) {
            const float v = 2.0f * kPi * float(j) / float(N); // around the tube
            const float cv = std::cos(v), sv = std::sin(v);
            // Center of the tube ring in XZ; tube sweeps in Y and radially.
            const float px = (R + r * cv) * cu;
            const float pz = (R + r * cv) * su;
            const float py = r * sv;
            const float nx = cv * cu, nz = cv * su, ny = sv;
            g.pos.insert(g.pos.end(), { px, py, pz });
            g.nrm.insert(g.nrm.end(), { nx, ny, nz });
        }
    }
    const int stride = N + 1;
    for (int i = 0; i < N; ++i) {
        for (int j = 0; j < N; ++j) {
            const uint16_t a = uint16_t(i * stride + j);
            const uint16_t b = uint16_t((i + 1) * stride + j);
            const uint16_t c = uint16_t((i + 1) * stride + j + 1);
            const uint16_t d = uint16_t(i * stride + j + 1);
            g.idx.insert(g.idx.end(), { a, d, c, a, c, b });
        }
    }
    g.radius = R + r;
    return g;
}

} // namespace

void Engine::computeWorld(int meshId) {
    Mesh& m = meshes_[size_t(meshId)];
    if (m.worldDone) { return; }
    float local[16];
    if (m.hasBaseMatrix) {
        std::memcpy(local, m.baseMatrix, sizeof(local));
    } else {
        mathx::composeTRS(local, m.pos[0], m.pos[1], m.pos[2], m.rot[0], m.rot[1], m.rot[2], m.scale[0], m.scale[1], m.scale[2]);
    }
    if (m.parent >= 0 && m.parent < int(meshes_.size())) {
        computeWorld(m.parent);
        mathx::mul(m.world, meshes_[size_t(m.parent)].world, local);
    } else {
        std::memcpy(m.world, local, sizeof(local));
    }
    m.worldDone = true;
}

// Rebuild a procedurally-generated primitive (created in the standard pos/normal layout)
// in the PBR vertex layout (pos/normal/uv/tangent) so it can be drawn by the PBR program
// with image-based lighting. UVs default to (0,0) (correct for the solid-colour textures
// these primitives use) and tangents to a default basis. Called when a PBR material is
// assigned to a procedural mesh. No-op for glTF meshes (already PBR) or meshes lacking
// retained geometry.
void Engine::convertMeshToPBR(int meshId) {
    if (meshId < 0 || meshId >= int(meshes_.size()) || !gfx_) { return; }
    Mesh& m = meshes_[size_t(meshId)];
    if (m.pbr) { return; }
    if (m.rawPos.empty() || m.rawNrm.empty() || m.rawIdx.empty()) { return; }
    const int gid = gfx_->createMeshPBR(
        m.rawPos.data(), uint32_t(m.rawPos.size()),
        m.rawNrm.data(), uint32_t(m.rawNrm.size()),
        nullptr, 0, nullptr, 0,
        m.rawIdx.data(), uint32_t(m.rawIdx.size()), /*index32=*/false);
    if (gid < 0) { return; }
    m.geomId = gid;
    m.pbr = true;
}
static const float kRhToLh[16] = { -1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1 };

void Engine::computeNodeWorld(int idx) {
    if (idx < 0 || idx >= int(nodes_.size())) { return; }
    Node& n = nodes_[size_t(idx)];
    if (n.worldDone) { return; }
    float local[16];
    mathx::composeTRSQuat(local, n.t, n.r, n.s);
    if (n.parent >= 0 && n.parent < int(nodes_.size())) {
        computeNodeWorld(n.parent);
        mathx::mul(n.world, nodes_[size_t(n.parent)].world, local);
    } else {
        mathx::mul(n.world, kRhToLh, local); // root applies the RH→LH conversion
    }
    n.worldDone = true;
}

// Sample one channel at `time` into out[] (3 for T/S, 4 for R). Mirrors Babylon's
// keyframe evaluation: binary-search the segment, LINEAR (SLERP for quaternions),
// STEP, or CUBICSPLINE (Hermite, tangents scaled by dt, quaternion re-normalized).
void Engine::sampleChannel(const AnimClip& clip, const AnimChannel& ch, float time, float* out) {
    const AnimSampler& s = clip.samplers[size_t(ch.sampler)];
    const int comp = s.comp;
    const int nk = int(s.input.size());
    const bool cubic = (s.interp == 2);
    const int stride = cubic ? comp * 3 : comp;
    const int valOff = cubic ? comp : 0;
    auto key = [&](int i) -> const float* { return &s.output[size_t(i * stride + valOff)]; };

    if (nk == 0) { for (int c = 0; c < comp; ++c) { out[c] = (ch.path == 1 && c == 3) ? 1.0f : 0.0f; } return; }
    if (time <= s.input[0]) { for (int c = 0; c < comp; ++c) { out[c] = key(0)[c]; } return; }
    if (time >= s.input[size_t(nk - 1)]) { for (int c = 0; c < comp; ++c) { out[c] = key(nk - 1)[c]; } return; }

    int lo = 0, hi = nk - 1;            // binary search: last key with input <= time
    while (hi - lo > 1) { const int mid = (lo + hi) >> 1; if (s.input[size_t(mid)] <= time) { lo = mid; } else { hi = mid; } }
    const float t0 = s.input[size_t(lo)], t1 = s.input[size_t(hi)];
    const float dt = t1 - t0;
    const float u = dt > 1e-9f ? (time - t0) / dt : 0.0f;

    if (s.interp == 1) { // STEP
        for (int c = 0; c < comp; ++c) { out[c] = key(lo)[c]; }
    } else if (cubic) {  // CUBICSPLINE Hermite
        const float* in1 = &s.output[size_t(hi * stride)];            // inTangent of key hi
        const float* out0 = &s.output[size_t(lo * stride + comp * 2)]; // outTangent of key lo
        const float u2 = u * u, u3 = u2 * u;
        const float h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
        for (int c = 0; c < comp; ++c) {
            out[c] = h00 * key(lo)[c] + h10 * dt * out0[c] + h01 * key(hi)[c] + h11 * dt * in1[c];
        }
        if (ch.path == 1) { // normalize quaternion
            float n = std::sqrt(out[0] * out[0] + out[1] * out[1] + out[2] * out[2] + out[3] * out[3]);
            if (n > 1e-9f) { for (int c = 0; c < 4; ++c) { out[c] /= n; } }
        }
    } else {             // LINEAR (SLERP for rotation)
        if (ch.path == 1) {
            mathx::quatSlerp(out, key(lo), key(hi), u);
        } else {
            for (int c = 0; c < comp; ++c) { out[c] = key(lo)[c] + (key(hi)[c] - key(lo)[c]) * u; }
        }
    }
}

void Engine::updateAnimations(float dt) {
    for (AnimClip& clip : anims_) {
        if (!clip.playing) { continue; }
        clip.time += dt * clip.speed;
        if (clip.duration > 0.0f) {
            if (clip.loop) {
                clip.time = std::fmod(clip.time, clip.duration);
                if (clip.time < 0.0f) { clip.time += clip.duration; }
            } else if (clip.time > clip.duration) {
                clip.time = clip.duration;
            }
        }
        for (const AnimChannel& ch : clip.channels) {
            if (ch.node < 0 || ch.node >= int(nodes_.size()) || ch.sampler < 0) { continue; }
            Node& n = nodes_[size_t(ch.node)];
            if (ch.path == 3) { // morph weights: sample `comp` values into the node's weight array
                const int wcount = clip.samplers[size_t(ch.sampler)].comp;
                if (wcount <= 0) { continue; }
                if (int(n.weights.size()) < wcount) { n.weights.resize(size_t(wcount), 0.0f); }
                sampleChannel(clip, ch, clip.time, n.weights.data());
                continue;
            }
            float v[4] = { 0, 0, 0, 1 };
            sampleChannel(clip, ch, clip.time, v);
            switch (ch.path) {
                case 0: n.t[0] = v[0]; n.t[1] = v[1]; n.t[2] = v[2]; break;            // translation
                case 1: n.r[0] = v[0]; n.r[1] = v[1]; n.r[2] = v[2]; n.r[3] = v[3]; break; // rotation
                case 2: n.s[0] = v[0]; n.s[1] = v[1]; n.s[2] = v[2]; break;            // scale
                default: break;
            }
        }
    }
}

int Engine::renderFrame(float timeSec) {
    lastDrawn_ = 0;
    if (activeScene_ < 0 || !gfx_) { return 0; }
    Scene& scene = scenes_[size_t(activeScene_)];
    if (scene.cameraId < 0) { return 0; }

    // --- animation: advance active clips, then recompose node world matrices ---
    float dt = (lastTimeSec_ < 0.0f) ? (1.0f / 60.0f) : (timeSec - lastTimeSec_);
    lastTimeSec_ = timeSec;
    if (dt < 0.0f) { dt = 0.0f; } else if (dt > 0.1f) { dt = 0.1f; }
    updateAnimations(dt);
    for (Node& n : nodes_) { n.worldDone = false; }
    for (size_t i = 0; i < nodes_.size(); ++i) { computeNodeWorld(int(i)); }

    // --- camera: arc-rotate -> eye, then hand to gfx (view/proj + cull source) ---
    const Camera& cam = cameras_[size_t(scene.cameraId)];
    const float cosA = std::cos(cam.alpha), sinA = std::sin(cam.alpha);
    const float cosB = std::cos(cam.beta);
    float sinB = std::sin(cam.beta);
    if (std::fabs(sinB) < 1e-4f) { sinB = sinB < 0 ? -1e-4f : 1e-4f; }
    const float eye[3] = {
        cam.target[0] + cam.radius * cosA * sinB,
        cam.target[1] + cam.radius * cosB,
        cam.target[2] + cam.radius * sinA * sinB,
    };
    gfx_->setCamera(eye, cam.target, cam.fov * (180.0f / kPi), cam.nearPlane, cam.farPlane);

    // --- light (single hemispheric for v1) ---
    if (scene.lightId >= 0) {
        const Light& l = lights_[size_t(scene.lightId)];
        gfx_->setLightHemispheric(l.dir[0], l.dir[1], l.dir[2],
                                  l.diffuse[0] * l.intensity, l.diffuse[1] * l.intensity, l.diffuse[2] * l.intensity,
                                  l.ground[0] * l.intensity, l.ground[1] * l.intensity, l.ground[2] * l.intensity);
        // PBR direct light + a hemispheric ambient stand-in for IBL (no env yet).
        gfx_->setPbrLight(l.dir[0], l.dir[1], l.dir[2],
                          l.diffuse[0] * l.intensity, l.diffuse[1] * l.intensity, l.diffuse[2] * l.intensity,
                          0.55f, 0.57f, 0.6f, 0.20f, 0.19f, 0.18f);
    } else {
        // No scene light: zero the PBR direct term so it doesn't fall back to the default
        // white light. Environment-lit PBR scenes (e.g. a lone IBL sphere) are then lit
        // purely by IBL; non-IBL PBR scenes still get the hemispheric ambient stand-in.
        // (The standard-shader hemispheric light is left untouched to avoid regressions.)
        gfx_->setPbrLight(0.0f, 1.0f, 0.0f, 0.0f, 0.0f, 0.0f,
                          0.55f, 0.57f, 0.6f, 0.20f, 0.19f, 0.18f);
    }

    // Directional "sun" (CSM caster + a standard-shader Lambert term). Zeroed when absent so
    // the standard shader's sun contribution vanishes (no regression for sun-less scenes).
    if (scene.sunId >= 0 && scene.sunId < int(lights_.size())) {
        const Light& sun = lights_[size_t(scene.sunId)];
        gfx_->setSun(sun.dir[0], sun.dir[1], sun.dir[2],
                     sun.diffuse[0] * sun.intensity, sun.diffuse[1] * sun.intensity, sun.diffuse[2] * sun.intensity);
    } else {
        gfx_->setSun(0.0f, -1.0f, 0.0f, 0.0f, 0.0f, 0.0f);
    }

    float vp[16];
    gfx_->getViewProj(vp);
    float frustum[6][4];
    mathx::extractFrustum(vp, frustum);

    for (Mesh& m : meshes_) { m.worldDone = false; }

    // --- CSM shadow pass: fit cascades to the caster bounds + render caster depth into the
    //     atlas BEFORE the main pass (the standard-material receivers then sample it) ---
    if (scene.shadows && scene.shadowGenId >= 0 && scene.shadowGenId < int(shadowGens_.size())) {
        ShadowGen& sg = shadowGens_[size_t(scene.shadowGenId)];
        if (!sg.casters.empty()) {
            float bmin[3] = { 1e30f, 1e30f, 1e30f };
            float bmax[3] = { -1e30f, -1e30f, -1e30f };
            for (int cid : sg.casters) {
                if (cid < 0 || cid >= int(meshes_.size())) { continue; }
                Mesh& cm = meshes_[size_t(cid)];
                if (cm.node >= 0 && cm.node < int(nodes_.size())) {
                    std::memcpy(cm.world, nodes_[size_t(cm.node)].world, sizeof(cm.world));
                    cm.worldDone = true;
                } else {
                    computeWorld(cid);
                }
                const float sx = std::sqrt(cm.world[0] * cm.world[0] + cm.world[1] * cm.world[1] + cm.world[2] * cm.world[2]);
                const float sy = std::sqrt(cm.world[4] * cm.world[4] + cm.world[5] * cm.world[5] + cm.world[6] * cm.world[6]);
                const float sz = std::sqrt(cm.world[8] * cm.world[8] + cm.world[9] * cm.world[9] + cm.world[10] * cm.world[10]);
                const float r = cm.boundRadius * std::fmax(sx, std::fmax(sy, sz));
                const float x = cm.world[12], y = cm.world[13], z = cm.world[14];
                if (x - r < bmin[0]) { bmin[0] = x - r; } if (x + r > bmax[0]) { bmax[0] = x + r; }
                if (y - r < bmin[1]) { bmin[1] = y - r; } if (y + r > bmax[1]) { bmax[1] = y + r; }
                if (z - r < bmin[2]) { bmin[2] = z - r; } if (z + r > bmax[2]) { bmax[2] = z + r; }
            }
            const float center[3] = { (bmin[0] + bmax[0]) * 0.5f, (bmin[1] + bmax[1]) * 0.5f, (bmin[2] + bmax[2]) * 0.5f };
            const float dx = bmax[0] - bmin[0], dy = bmax[1] - bmin[1], dz = bmax[2] - bmin[2];
            const float radius = 0.5f * std::sqrt(dx * dx + dy * dy + dz * dz);
            gfx_->beginShadowPass(sg.mapSize, sg.numCascades, sg.lambda, sg.bias, center, radius);
            for (int cid : sg.casters) {
                if (cid < 0 || cid >= int(meshes_.size())) { continue; }
                Mesh& cm = meshes_[size_t(cid)];
                gfx_->drawShadowCaster(cm.geomId, cm.world);
            }
        }
    }

    int draws = 0;
    for (int meshId : scene.meshIds) {
        Mesh& m = meshes_[size_t(meshId)];
        // Animated meshes follow their bound node's world; others use the mesh hierarchy.
        if (m.node >= 0 && m.node < int(nodes_.size())) {
            std::memcpy(m.world, nodes_[size_t(m.node)].world, sizeof(m.world));
            m.worldDone = true;
        } else {
            computeWorld(meshId);
        }
        if (m.geomId < 0) { continue; }

        // Morph targets: re-evaluate the mesh geometry from the bound node's weights before
        // drawing (and before GPU skinning samples the vertex buffer).
        if (m.morph && m.node >= 0 && m.node < int(nodes_.size())) {
            const std::vector<float>& w = nodes_[size_t(m.node)].weights;
            if (!w.empty()) { gfx_->updateMeshMorph(m.geomId, w.data(), int(w.size())); }
        }

        const Material& mat = (m.materialId >= 0) ? materials_[size_t(m.materialId)] : Material{};

        // Skinned PBR mesh (skeleton): compute the bone palette natively each frame
        // (boneMatrix = invMeshWorld · jointWorld · IBM) and draw via GPU skinning.
        if (m.skin >= 0 && m.skin < int(skins_.size())) {
            const Skin& sk = skins_[size_t(m.skin)];
            const int bones = int(sk.joints.size());
            if (bones > 0 && int(sk.ibm.size()) >= bones * 16) {
                float invMesh[16];
                mathx::invert(invMesh, m.world);
                bonePalette_.resize(size_t(bones) * 16);
                for (int j = 0; j < bones; ++j) {
                    const int jn = sk.joints[size_t(j)];
                    float jw[16] = { 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1 };
                    if (jn >= 0 && jn < int(nodes_.size())) { std::memcpy(jw, nodes_[size_t(jn)].world, sizeof(jw)); }
                    float tmp[16], pal[16];
                    mathx::mul(tmp, jw, &sk.ibm[size_t(j) * 16]);  // jointWorld · IBM
                    mathx::mul(pal, invMesh, tmp);                  // invMeshWorld · jointWorld · IBM
                    std::memcpy(&bonePalette_[size_t(j) * 16], pal, sizeof(pal));
                }
                gfx::PbrDraw pd;
                pd.baseColor[0] = mat.diffuse[0]; pd.baseColor[1] = mat.diffuse[1]; pd.baseColor[2] = mat.diffuse[2]; pd.baseColor[3] = mat.alpha;
                pd.metallic = mat.metallic; pd.roughness = mat.roughness; pd.occlusionStrength = mat.occlusionStrength; pd.alphaCutoff = mat.alphaCutoff;
                pd.emissive[0] = mat.emissive[0]; pd.emissive[1] = mat.emissive[1]; pd.emissive[2] = mat.emissive[2];
                pd.texBase = mat.texBase; pd.texMR = mat.texMR; pd.texNormal = mat.texNormal; pd.texEmissive = mat.texEmissive; pd.texOcclusion = mat.texOcclusion;
                gfx_->drawMeshSkinnedPBR(m.geomId, m.world, bonePalette_.data(), bones, pd);
                ++draws;
            }
            continue;
        }

        // PBR meshes (glTF) are baked into world space; draw directly via the PBR program.
        if (m.pbr) {
            gfx::PbrDraw pd;
            pd.baseColor[0] = mat.diffuse[0]; pd.baseColor[1] = mat.diffuse[1]; pd.baseColor[2] = mat.diffuse[2]; pd.baseColor[3] = mat.alpha;
            pd.metallic = mat.metallic; pd.roughness = mat.roughness; pd.occlusionStrength = mat.occlusionStrength; pd.alphaCutoff = mat.alphaCutoff;
            pd.emissive[0] = mat.emissive[0]; pd.emissive[1] = mat.emissive[1]; pd.emissive[2] = mat.emissive[2];
            pd.texBase = mat.texBase; pd.texMR = mat.texMR; pd.texNormal = mat.texNormal; pd.texEmissive = mat.texEmissive; pd.texOcclusion = mat.texOcclusion;
            gfx_->drawMeshPBR(m.geomId, m.world, pd);
            ++draws;
            continue;
        }

        gfx_->setStandardMaterial(mat.diffuse[0], mat.diffuse[1], mat.diffuse[2], mat.alpha,
                                  mat.specular[0], mat.specular[1], mat.specular[2], mat.specularPower);

        const float smax = std::fmax(m.scale[0], std::fmax(m.scale[1], m.scale[2]));

        if (m.thinCount > 0) {
            for (int i = 0; i < m.thinCount; ++i) {
                float iw[16];
                mathx::mul(iw, m.world, &m.thin[size_t(i) * 16]);
                if (mathx::sphereInFrustum(frustum, iw[12], iw[13], iw[14], m.boundRadius * smax)) {
                    gfx_->drawMesh(m.geomId, iw);
                    ++draws;
                }
            }
        } else {
            if (mathx::sphereInFrustum(frustum, m.world[12], m.world[13], m.world[14], m.boundRadius * smax)) {
                gfx_->drawMesh(m.geomId, m.world, m.receiveShadows);
                ++draws;
            }
        }
    }
    lastDrawn_ = draws;
    return draws;
}

void Engine::registerOn(js::Host& host) {
    // --- scene ---
    host.registerFunction("__bl_createScene", [this](const Napi::CallbackInfo& info) -> Napi::Value {
        scenes_.push_back(Scene{});
        return Napi::Number::New(info.Env(), int(scenes_.size() - 1));
    });
    host.registerFunction("__bl_setClearColor", [this](const Napi::CallbackInfo& info) -> Napi::Value {
        const int s = int(argf(info, 0, -1));
        if (s < 0 || s >= int(scenes_.size())) { return info.Env().Undefined(); }
        auto c8 = [](double v) -> uint32_t { v = v < 0 ? 0 : (v > 1 ? 1 : v); return uint32_t(v * 255.0 + 0.5); };
        const uint32_t r = c8(argf(info, 1, 0)), g = c8(argf(info, 2, 0));
        const uint32_t b = c8(argf(info, 3, 0)), a = c8(argf(info, 4, 1));
        scenes_[size_t(s)].clearRgba = (r << 24) | (g << 16) | (b << 8) | a;
        if (gfx_) { gfx_->setClearColor(float(argf(info, 1, 0)), float(argf(info, 2, 0)), float(argf(info, 3, 0)), float(argf(info, 4, 1))); }
        return info.Env().Undefined();
    });

    // --- camera ---
    host.registerFunction("__bl_createCamera", [this](const Napi::CallbackInfo& info) -> Napi::Value {
        Camera c;
        c.alpha = float(argf(info, 0, 0));
        c.beta = float(argf(info, 1, 1));
        c.radius = float(argf(info, 2, 10));
        c.target[0] = float(argf(info, 3, 0));
        c.target[1] = float(argf(info, 4, 0));
        c.target[2] = float(argf(info, 5, 0));
        cameras_.push_back(c);
        return Napi::Number::New(info.Env(), int(cameras_.size() - 1));
    });
    host.registerFunction("__bl_setCamera", [this](const Napi::CallbackInfo& info) -> Napi::Value {
        const int id = int(argf(info, 0, -1));
        if (id < 0 || id >= int(cameras_.size())) { return info.Env().Undefined(); }
        Camera& c = cameras_[size_t(id)];
        c.alpha = float(argf(info, 1, c.alpha));
        c.beta = float(argf(info, 2, c.beta));
        c.radius = float(argf(info, 3, c.radius));
        c.target[0] = float(argf(info, 4, c.target[0]));
        c.target[1] = float(argf(info, 5, c.target[1]));
        c.target[2] = float(argf(info, 6, c.target[2]));
        c.fov = float(argf(info, 7, c.fov));
        c.nearPlane = float(argf(info, 8, c.nearPlane));
        c.farPlane = float(argf(info, 9, c.farPlane));
        return info.Env().Undefined();
    });
    host.registerFunction("__bl_setSceneCamera", [this](const Napi::CallbackInfo& info) -> Napi::Value {
        const int s = int(argf(info, 0, -1));
        const int c = int(argf(info, 1, -1));
        if (s >= 0 && s < int(scenes_.size())) { scenes_[size_t(s)].cameraId = c; }
        return info.Env().Undefined();
    });

    // --- light ---
    host.registerFunction("__bl_createLight", [this](const Napi::CallbackInfo& info) -> Napi::Value {
        Light l;
        l.dir[0] = float(argf(info, 0, 0));
        l.dir[1] = float(argf(info, 1, 1));
        l.dir[2] = float(argf(info, 2, 0));
        l.intensity = float(argf(info, 3, 1));
        lights_.push_back(l);
        return Napi::Number::New(info.Env(), int(lights_.size() - 1));
    });
    host.registerFunction("__bl_setLight", [this](const Napi::CallbackInfo& info) -> Napi::Value {
        const int id = int(argf(info, 0, -1));
        if (id < 0 || id >= int(lights_.size())) { return info.Env().Undefined(); }
        Light& l = lights_[size_t(id)];
        l.dir[0] = float(argf(info, 1, l.dir[0]));
        l.dir[1] = float(argf(info, 2, l.dir[1]));
        l.dir[2] = float(argf(info, 3, l.dir[2]));
        l.intensity = float(argf(info, 4, l.intensity));
        l.diffuse[0] = float(argf(info, 5, l.diffuse[0]));
        l.diffuse[1] = float(argf(info, 6, l.diffuse[1]));
        l.diffuse[2] = float(argf(info, 7, l.diffuse[2]));
        l.ground[0] = float(argf(info, 8, l.ground[0]));
        l.ground[1] = float(argf(info, 9, l.ground[1]));
        l.ground[2] = float(argf(info, 10, l.ground[2]));
        return info.Env().Undefined();
    });
    host.registerFunction("__bl_setSceneLight", [this](const Napi::CallbackInfo& info) -> Napi::Value {
        const int s = int(argf(info, 0, -1));
        const int l = int(argf(info, 1, -1));
        if (s >= 0 && s < int(scenes_.size())) { scenes_[size_t(s)].lightId = l; }
        return info.Env().Undefined();
    });
    // Directional "sun": the CSM-casting light + a Lambert direct term. Distinct from the
    // hemispheric fill so a scene can have both (Cedric's benchmark adds both).
    host.registerFunction("__bl_setSceneSun", [this](const Napi::CallbackInfo& info) -> Napi::Value {
        const int s = int(argf(info, 0, -1));
        const int l = int(argf(info, 1, -1));
        if (s >= 0 && s < int(scenes_.size())) { scenes_[size_t(s)].sunId = l; }
        if (l >= 0 && l < int(lights_.size())) { lights_[size_t(l)].directional = true; }
        return info.Env().Undefined();
    });

    // --- geometry (built natively) ---
    auto addMesh = [this](Geom&& geo) -> int {
        if (!gfx_) { return -1; }
        const int gid = gfx_->createMesh(geo.pos.data(), uint32_t(geo.pos.size()),
                                         geo.nrm.data(), uint32_t(geo.nrm.size()),
                                         geo.idx.data(), uint32_t(geo.idx.size()), false);
        Mesh m;
        m.geomId = gid;
        m.boundRadius = geo.radius;
        // Retain the raw geometry so the mesh can be rebuilt in the PBR layout if a PBR
        // material is later assigned (the standard layout has no UV/tangent attributes).
        m.rawPos = std::move(geo.pos);
        m.rawNrm = std::move(geo.nrm);
        m.rawIdx = std::move(geo.idx);
        meshes_.push_back(std::move(m));
        return int(meshes_.size() - 1);
    };
    host.registerFunction("__bl_createBox", [this, addMesh](const Napi::CallbackInfo& info) -> Napi::Value {
        return Napi::Number::New(info.Env(), addMesh(makeBox(float(argf(info, 0, 1)))));
    });
    host.registerFunction("__bl_createSphere", [this, addMesh](const Napi::CallbackInfo& info) -> Napi::Value {
        return Napi::Number::New(info.Env(), addMesh(makeSphere(float(argf(info, 0, 1)), int(argf(info, 1, 16)))));
    });
    host.registerFunction("__bl_createGround", [this, addMesh](const Napi::CallbackInfo& info) -> Napi::Value {
        return Napi::Number::New(info.Env(), addMesh(makeGround(float(argf(info, 0, 1)), float(argf(info, 1, 1)))));
    });
    host.registerFunction("__bl_createTorus", [this, addMesh](const Napi::CallbackInfo& info) -> Napi::Value {
        return Napi::Number::New(info.Env(), addMesh(makeTorus(
            float(argf(info, 0, 1)), float(argf(info, 1, 0.5)), int(argf(info, 2, 16)))));
    });

    // --- material ---
    host.registerFunction("__bl_createStandardMaterial", [this](const Napi::CallbackInfo& info) -> Napi::Value {
        materials_.push_back(Material{});
        return Napi::Number::New(info.Env(), int(materials_.size() - 1));
    });
    host.registerFunction("__bl_setMaterial", [this](const Napi::CallbackInfo& info) -> Napi::Value {
        const int id = int(argf(info, 0, -1));
        if (id < 0 || id >= int(materials_.size())) { return info.Env().Undefined(); }
        Material& mt = materials_[size_t(id)];
        mt.diffuse[0] = float(argf(info, 1, mt.diffuse[0]));
        mt.diffuse[1] = float(argf(info, 2, mt.diffuse[1]));
        mt.diffuse[2] = float(argf(info, 3, mt.diffuse[2]));
        mt.alpha = float(argf(info, 4, mt.alpha));
        mt.specular[0] = float(argf(info, 5, mt.specular[0]));
        mt.specular[1] = float(argf(info, 6, mt.specular[1]));
        mt.specular[2] = float(argf(info, 7, mt.specular[2]));
        mt.specularPower = float(argf(info, 8, mt.specularPower));
        return info.Env().Undefined();
    });
    host.registerFunction("__bl_setMeshMaterial", [this](const Napi::CallbackInfo& info) -> Napi::Value {
        const int m = int(argf(info, 0, -1));
        const int mat = int(argf(info, 1, -1));
        if (m >= 0 && m < int(meshes_.size())) {
            meshes_[size_t(m)].materialId = mat;
            // A PBR material on a procedural primitive needs the PBR vertex layout +
            // program; rebuild the mesh geometry so it renders with real PBR + IBL.
            if (mat >= 0 && mat < int(materials_.size()) && materials_[size_t(mat)].isPbr
                && !meshes_[size_t(m)].pbr) {
                convertMeshToPBR(m);
            }
        }
        return info.Env().Undefined();
    });

    // --- mesh transform / hierarchy / instancing ---
    host.registerFunction("__bl_setMeshTransform", [this](const Napi::CallbackInfo& info) -> Napi::Value {
        const int id = int(argf(info, 0, -1));
        if (id < 0 || id >= int(meshes_.size())) { return info.Env().Undefined(); }
        Mesh& m = meshes_[size_t(id)];
        m.pos[0] = float(argf(info, 1, 0)); m.pos[1] = float(argf(info, 2, 0)); m.pos[2] = float(argf(info, 3, 0));
        m.rot[0] = float(argf(info, 4, 0)); m.rot[1] = float(argf(info, 5, 0)); m.rot[2] = float(argf(info, 6, 0));
        m.scale[0] = float(argf(info, 7, 1)); m.scale[1] = float(argf(info, 8, 1)); m.scale[2] = float(argf(info, 9, 1));
        return info.Env().Undefined();
    });
    host.registerFunction("__bl_setParent", [this](const Napi::CallbackInfo& info) -> Napi::Value {
        const int m = int(argf(info, 0, -1));
        const int p = int(argf(info, 1, -1));
        if (m >= 0 && m < int(meshes_.size())) { meshes_[size_t(m)].parent = p; }
        return info.Env().Undefined();
    });
    host.registerFunction("__bl_setThinInstances", [this](const Napi::CallbackInfo& info) -> Napi::Value {
        const int id = int(argf(info, 0, -1));
        if (id < 0 || id >= int(meshes_.size()) || info.Length() < 3) { return info.Env().Undefined(); }
        size_t bytes = 0;
        const uint8_t* mb = js::argBytes(info, 1, &bytes);
        const int count = int(argf(info, 2, 0));
        Mesh& m = meshes_[size_t(id)];
        if (mb && count > 0 && bytes >= size_t(count) * 16 * sizeof(float)) {
            m.thin.assign(reinterpret_cast<const float*>(mb), reinterpret_cast<const float*>(mb) + size_t(count) * 16);
            m.thinCount = count;
        }
        return info.Env().Undefined();
    });
    host.registerFunction("__bl_addMeshToScene", [this](const Napi::CallbackInfo& info) -> Napi::Value {
        const int s = int(argf(info, 0, -1));
        const int m = int(argf(info, 1, -1));
        if (s >= 0 && s < int(scenes_.size()) && m >= 0 && m < int(meshes_.size())) {
            scenes_[size_t(s)].meshIds.push_back(m);
        }
        return info.Env().Undefined();
    });

    // --- cloning (no-instancing: each clone is its own mesh, sharing the source's GPU
    //     geometry + material, with a baked world matrix) ---
    host.registerFunction("__bl_cloneMeshWithWorld", [this](const Napi::CallbackInfo& info) -> Napi::Value {
        const int src = int(argf(info, 0, -1));
        size_t bytes = 0;
        const uint8_t* mb = js::argBytes(info, 1, &bytes);
        if (src < 0 || src >= int(meshes_.size()) || !mb || bytes < 16 * sizeof(float)) {
            return Napi::Number::New(info.Env(), -1);
        }
        // Read everything from the source before push_back (which may reallocate meshes_).
        const Mesh& s = meshes_[size_t(src)];
        Mesh m;
        m.geomId = s.geomId;
        m.materialId = s.materialId;
        m.pbr = s.pbr;
        m.boundRadius = s.boundRadius;
        m.hasBaseMatrix = true;
        std::memcpy(m.baseMatrix, reinterpret_cast<const float*>(mb), 16 * sizeof(float));
        meshes_.push_back(std::move(m));
        return Napi::Number::New(info.Env(), int(meshes_.size() - 1));
    });
    // World matrix of a (loaded) mesh, so the JS clone helper can bake group·sourceWorld.
    host.registerFunction("__bl_getMeshWorld", [this](const Napi::CallbackInfo& info) -> Napi::Value {
        const int id = int(argf(info, 0, -1));
        float w[16] = { 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1 };
        if (id >= 0 && id < int(meshes_.size())) {
            Mesh& m = meshes_[size_t(id)];
            if (m.node >= 0 && m.node < int(nodes_.size())) {
                for (Node& n : nodes_) { n.worldDone = false; }
                computeNodeWorld(m.node);
                std::memcpy(w, nodes_[size_t(m.node)].world, sizeof(w));
            } else {
                for (Mesh& mm : meshes_) { mm.worldDone = false; }
                computeWorld(id);
                std::memcpy(w, m.world, sizeof(w));
            }
        }
        Napi::Float32Array out = Napi::Float32Array::New(info.Env(), 16);
        std::memcpy(out.Data(), w, sizeof(w));
        return out;
    });
    host.registerFunction("__bl_setReceiveShadows", [this](const Napi::CallbackInfo& info) -> Napi::Value {
        const int id = int(argf(info, 0, -1));
        if (id >= 0 && id < int(meshes_.size())) {
            meshes_[size_t(id)].receiveShadows = argf(info, 1, 0) != 0.0;
        }
        return info.Env().Undefined();
    });

    // --- granular camera setters (so createDefaultCamera's native framing survives
    //     a JS override of a single field like cam.alpha) ---
    host.registerFunction("__bl_setCameraField", [this](const Napi::CallbackInfo& info) -> Napi::Value {
        const int id = int(argf(info, 0, -1));
        if (id < 0 || id >= int(cameras_.size())) { return info.Env().Undefined(); }
        Camera& c = cameras_[size_t(id)];
        const int field = int(argf(info, 1, -1)); // 0 alpha,1 beta,2 radius,3 fov,4 near,5 far
        const float v = float(argf(info, 2, 0));
        switch (field) {
            case 0: c.alpha = v; break;
            case 1: c.beta = v; break;
            case 2: c.radius = v; break;
            case 3: c.fov = v; break;
            case 4: c.nearPlane = v; break;
            case 5: c.farPlane = v; break;
            default: break;
        }
        return info.Env().Undefined();
    });
    host.registerFunction("__bl_setCameraTarget", [this](const Napi::CallbackInfo& info) -> Napi::Value {
        const int id = int(argf(info, 0, -1));
        if (id < 0 || id >= int(cameras_.size())) { return info.Env().Undefined(); }
        Camera& c = cameras_[size_t(id)];
        c.target[0] = float(argf(info, 1, c.target[0]));
        c.target[1] = float(argf(info, 2, c.target[1]));
        c.target[2] = float(argf(info, 3, c.target[2]));
        return info.Env().Undefined();
    });

    // --- glTF / PBR: data-driven seam. JS parses glTF (mirroring Babylon-Lite) and
    //     hands geometry / textures / materials here; C++ only uploads + renders. ---
    host.registerFunction("__bl_readFile", [this](const Napi::CallbackInfo& info) -> Napi::Value {
        Napi::Env env = info.Env();
        namespace fs = std::filesystem;
        std::string path = js::argStr(info, 0);
        if (!fs::exists(path)) {
            const std::string bn = baseName(path);
            if (!assetsDir_.empty() && fs::exists(fs::path(assetsDir_) / bn)) { path = (fs::path(assetsDir_) / bn).string(); }
            else if (fs::exists(fs::path("assets") / bn)) { path = (fs::path("assets") / bn).string(); }
        }
        std::ifstream in(path, std::ios::binary | std::ios::ate);
        if (!in) {
            std::fprintf(stderr, "[lite] readFile not found: %s\n", path.c_str());
            return env.Null();
        }
        const std::streamsize n = in.tellg();
        in.seekg(0);
        std::vector<uint8_t> buf(static_cast<size_t>(n));
        in.read(reinterpret_cast<char*>(buf.data()), n);
        Napi::ArrayBuffer ab = Napi::ArrayBuffer::New(env, static_cast<size_t>(n));
        std::memcpy(ab.Data(), buf.data(), static_cast<size_t>(n));
        return ab;
    });

    // Quiet existence check (no "not found" log): true if the file is present locally or
    // under the assets dir (by basename). Used by the HTTP loader to decide whether to
    // download a remote asset.
    host.registerFunction("__bl_fileExists", [this](const Napi::CallbackInfo& info) -> Napi::Value {
        namespace fs = std::filesystem;
        const std::string path = js::argStr(info, 0);
        bool exists = fs::exists(path);
        if (!exists) {
            const std::string bn = baseName(path);
            exists = (!assetsDir_.empty() && fs::exists(fs::path(assetsDir_) / bn))
                     || fs::exists(fs::path("assets") / bn);
        }
        return Napi::Boolean::New(info.Env(), exists);
    });

    // Write downloaded bytes into the assets dir (keyed by basename) so the existing
    // synchronous readers (__bl_readFile / loadBuffers / texFor) find them locally — i.e.
    // an HTTP-fetched asset becomes a local asset (and is cached for subsequent runs).
    host.registerFunction("__bl_cacheFile", [this](const Napi::CallbackInfo& info) -> Napi::Value {
        namespace fs = std::filesystem;
        const std::string name = js::argStr(info, 0);
        size_t bytes = 0;
        const uint8_t* data = js::argBytes(info, 1, &bytes);
        if (name.empty() || !data) { return Napi::Boolean::New(info.Env(), false); }
        const fs::path dir = assetsDir_.empty() ? fs::path("assets") : fs::path(assetsDir_);
        std::error_code ec;
        fs::create_directories(dir, ec);
        const fs::path out = dir / baseName(name);
        std::ofstream os(out, std::ios::binary);
        if (!os) { std::fprintf(stderr, "[lite] cacheFile: cannot write %s\n", out.string().c_str()); return Napi::Boolean::New(info.Env(), false); }
        os.write(reinterpret_cast<const char*>(data), std::streamsize(bytes));
        return Napi::Boolean::New(info.Env(), true);
    });

    host.registerFunction("__bl_createMeshPBR", [this](const Napi::CallbackInfo& info) -> Napi::Value {
        Napi::Env env = info.Env();
        if (!gfx_ || info.Length() < 5) { return Napi::Number::New(env, -1); }
        size_t pl = 0, nl = 0, ul = 0, tl = 0, il = 0;
        const uint8_t* pos = js::argBytes(info, 0, &pl);
        const uint8_t* nrm = js::argBytes(info, 1, &nl);
        const uint8_t* uv = js::argBytes(info, 2, &ul);
        const uint8_t* tan = js::argBytes(info, 3, &tl);
        const uint8_t* idx = js::argBytes(info, 4, &il);
        if (!pos || !nrm || !idx) { return Napi::Number::New(env, -1); }
        const int gid = gfx_->createMeshPBR(
            reinterpret_cast<const float*>(pos), uint32_t(pl / 4),
            reinterpret_cast<const float*>(nrm), uint32_t(nl / 4),
            reinterpret_cast<const float*>(uv), uint32_t(ul / 4),
            reinterpret_cast<const float*>(tan), uint32_t(tl / 4),
            idx, uint32_t(il / 4), /*index32=*/true);
        Mesh m;
        m.pbr = true;
        m.geomId = gid;
        meshes_.push_back(m);
        return Napi::Number::New(env, int(meshes_.size() - 1));
    });

    // Skinned PBR mesh: (pos, nrm, uv, tan, joints Uint32, weights Float32, idx Uint32).
    host.registerFunction("__bl_createMeshSkinnedPBR", [this](const Napi::CallbackInfo& info) -> Napi::Value {
        Napi::Env env = info.Env();
        if (!gfx_ || info.Length() < 7) { return Napi::Number::New(env, -1); }
        size_t pl = 0, nl = 0, ul = 0, tl = 0, jl = 0, wl = 0, il = 0;
        const uint8_t* pos = js::argBytes(info, 0, &pl);
        const uint8_t* nrm = js::argBytes(info, 1, &nl);
        const uint8_t* uv = js::argBytes(info, 2, &ul);
        const uint8_t* tan = js::argBytes(info, 3, &tl);
        const uint8_t* joints = js::argBytes(info, 4, &jl);
        const uint8_t* weights = js::argBytes(info, 5, &wl);
        const uint8_t* idx = js::argBytes(info, 6, &il);
        if (!pos || !nrm || !idx || !joints || !weights) { return Napi::Number::New(env, -1); }
        const int gid = gfx_->createMeshSkinnedPBR(
            reinterpret_cast<const float*>(pos), uint32_t(pl / 4),
            reinterpret_cast<const float*>(nrm), uint32_t(nl / 4),
            reinterpret_cast<const float*>(uv), uint32_t(ul / 4),
            reinterpret_cast<const float*>(tan), uint32_t(tl / 4),
            reinterpret_cast<const uint32_t*>(joints), reinterpret_cast<const float*>(weights),
            idx, uint32_t(il / 4), /*index32=*/true);
        Mesh m;
        m.pbr = true;
        m.geomId = gid;
        meshes_.push_back(m);
        return Napi::Number::New(env, int(meshes_.size() - 1));
    });

    // Create a skin: (joints Uint32 node indices, inverseBindMatrices Float32 16*count).
    host.registerFunction("__bl_createSkin", [this](const Napi::CallbackInfo& info) -> Napi::Value {
        size_t jl = 0, il = 0;
        const uint8_t* j = js::argBytes(info, 0, &jl);
        const uint8_t* ibm = js::argBytes(info, 1, &il);
        Skin sk;
        if (j && jl) {
            const uint32_t* jp = reinterpret_cast<const uint32_t*>(j);
            sk.joints.assign(jp, jp + jl / 4);
        }
        if (ibm && il) {
            const float* ip = reinterpret_cast<const float*>(ibm);
            sk.ibm.assign(ip, ip + il / 4);
        }
        skins_.push_back(std::move(sk));
        return Napi::Number::New(info.Env(), int(skins_.size() - 1));
    });
    // Bind a skin to a mesh.
    host.registerFunction("__bl_setMeshSkin", [this](const Napi::CallbackInfo& info) -> Napi::Value {
        const int id = int(argf(info, 0, -1));
        const int skin = int(argf(info, 1, -1));
        if (id >= 0 && id < int(meshes_.size())) { meshes_[size_t(id)].skin = skin; }
        return info.Env().Undefined();
    });

    // Morph-target PBR mesh (non-skinned): (pos, nrm, uv, tan, idx, targetCount, dPos, dNrm).
    // dPos/dNrm are Float32 position/normal deltas (targetCount * numVerts * 3, target-major);
    // dNrm may be empty.
    host.registerFunction("__bl_createMeshMorphPBR", [this](const Napi::CallbackInfo& info) -> Napi::Value {
        Napi::Env env = info.Env();
        if (!gfx_ || info.Length() < 8) { return Napi::Number::New(env, -1); }
        size_t pl = 0, nl = 0, ul = 0, tl = 0, il = 0, dpl = 0, dnl = 0;
        const uint8_t* pos = js::argBytes(info, 0, &pl);
        const uint8_t* nrm = js::argBytes(info, 1, &nl);
        const uint8_t* uv = js::argBytes(info, 2, &ul);
        const uint8_t* tan = js::argBytes(info, 3, &tl);
        const uint8_t* idx = js::argBytes(info, 4, &il);
        const int targetCount = int(argf(info, 5, 0));
        const uint8_t* dpos = js::argBytes(info, 6, &dpl);
        const uint8_t* dnrm = js::argBytes(info, 7, &dnl);
        if (!pos || !nrm || !idx || !dpos || targetCount <= 0) { return Napi::Number::New(env, -1); }
        const int gid = gfx_->createMeshMorphPBR(
            reinterpret_cast<const float*>(pos), uint32_t(pl / 4),
            reinterpret_cast<const float*>(nrm), uint32_t(nl / 4),
            reinterpret_cast<const float*>(uv), uint32_t(ul / 4),
            reinterpret_cast<const float*>(tan), uint32_t(tl / 4),
            idx, uint32_t(il / 4), /*index32=*/true,
            reinterpret_cast<const float*>(dpos),
            (dnrm && dnl) ? reinterpret_cast<const float*>(dnrm) : nullptr, targetCount);
        Mesh m; m.pbr = true; m.geomId = gid; m.morph = true; m.morphTargetCount = targetCount;
        meshes_.push_back(std::move(m));
        return Napi::Number::New(env, int(meshes_.size() - 1));
    });

    // Morph-target skinned PBR mesh: (pos, nrm, uv, tan, joints, weights, idx, targetCount, dPos, dNrm).
    host.registerFunction("__bl_createMeshMorphSkinnedPBR", [this](const Napi::CallbackInfo& info) -> Napi::Value {
        Napi::Env env = info.Env();
        if (!gfx_ || info.Length() < 10) { return Napi::Number::New(env, -1); }
        size_t pl = 0, nl = 0, ul = 0, tl = 0, jl = 0, wl = 0, il = 0, dpl = 0, dnl = 0;
        const uint8_t* pos = js::argBytes(info, 0, &pl);
        const uint8_t* nrm = js::argBytes(info, 1, &nl);
        const uint8_t* uv = js::argBytes(info, 2, &ul);
        const uint8_t* tan = js::argBytes(info, 3, &tl);
        const uint8_t* joints = js::argBytes(info, 4, &jl);
        const uint8_t* weights = js::argBytes(info, 5, &wl);
        const uint8_t* idx = js::argBytes(info, 6, &il);
        const int targetCount = int(argf(info, 7, 0));
        const uint8_t* dpos = js::argBytes(info, 8, &dpl);
        const uint8_t* dnrm = js::argBytes(info, 9, &dnl);
        if (!pos || !nrm || !idx || !joints || !weights || !dpos || targetCount <= 0) { return Napi::Number::New(env, -1); }
        const int gid = gfx_->createMeshMorphSkinnedPBR(
            reinterpret_cast<const float*>(pos), uint32_t(pl / 4),
            reinterpret_cast<const float*>(nrm), uint32_t(nl / 4),
            reinterpret_cast<const float*>(uv), uint32_t(ul / 4),
            reinterpret_cast<const float*>(tan), uint32_t(tl / 4),
            reinterpret_cast<const uint32_t*>(joints), reinterpret_cast<const float*>(weights),
            idx, uint32_t(il / 4), /*index32=*/true,
            reinterpret_cast<const float*>(dpos),
            (dnrm && dnl) ? reinterpret_cast<const float*>(dnrm) : nullptr, targetCount);
        Mesh m; m.pbr = true; m.geomId = gid; m.morph = true; m.morphTargetCount = targetCount;
        meshes_.push_back(std::move(m));
        return Napi::Number::New(env, int(meshes_.size() - 1));
    });

    // Initialise a node's morph weights (the rest/default weights before animation runs).
    host.registerFunction("__bl_setNodeWeights", [this](const Napi::CallbackInfo& info) -> Napi::Value {
        const int node = int(argf(info, 0, -1));
        size_t bytes = 0;
        const uint8_t* w = js::argBytes(info, 1, &bytes);
        if (node >= 0 && node < int(nodes_.size()) && w && bytes) {
            const float* wp = reinterpret_cast<const float*>(w);
            nodes_[size_t(node)].weights.assign(wp, wp + bytes / 4);
        }
        return info.Env().Undefined();
    });

    // ---- image-based lighting (environment) ----
    host.registerFunction("__bl_createEnvironment", [this](const Napi::CallbackInfo& info) -> Napi::Value {
        if (gfx_) { gfx_->createEnvironment(int(argf(info, 0, 128)), int(argf(info, 1, 1))); }
        return info.Env().Undefined();
    });
    // Upload one prefiltered specular face: (mip, face, pngBytes). PNG decoded via stb;
    // gfx applies the RGBD→HDR decode and uploads to the cubemap face/mip.
    host.registerFunction("__bl_setEnvFace", [this](const Napi::CallbackInfo& info) -> Napi::Value {
        if (!gfx_) { return info.Env().Undefined(); }
        const int mip = int(argf(info, 0, 0));
        const int face = int(argf(info, 1, 0));
        size_t bytes = 0;
        const uint8_t* png = js::argBytes(info, 2, &bytes);
        if (!png || bytes == 0) { return info.Env().Undefined(); }
        DecodedImage img = decodeImageRGBA8(png, bytes);
        if (img.ok()) {
            gfx_->uploadEnvFace(mip, face, img.width, img.height, img.rgba.data());
        }
        return info.Env().Undefined();
    });
    // 9 pre-scaled SH irradiance vec4 (36 floats).
    host.registerFunction("__bl_setEnvSH", [this](const Napi::CallbackInfo& info) -> Napi::Value {
        size_t bytes = 0;
        const uint8_t* sh = js::argBytes(info, 0, &bytes);
        if (gfx_ && sh && bytes >= 36 * sizeof(float)) {
            gfx_->setEnvironmentSH(reinterpret_cast<const float*>(sh));
        }
        return info.Env().Undefined();
    });
    host.registerFunction("__bl_setEnvParams", [this](const Napi::CallbackInfo& info) -> Napi::Value {
        if (gfx_) {
            gfx_->setEnvironmentParams(float(argf(info, 0, 1)), float(argf(info, 1, 1)),
                                       float(argf(info, 2, 0.8)), float(argf(info, 3, 1.0)));
        }
        return info.Env().Undefined();
    });

    // ---- animation node graph + clips (orchestrated natively per Phase 9) ----
    // Number of native nodes so far (the base offset for the next glTF load's node indices).
    host.registerFunction("__bl_nodeCount", [this](const Napi::CallbackInfo& info) -> Napi::Value {
        return Napi::Number::New(info.Env(), int(nodes_.size()));
    });
    // Create a scene-graph node with rest-pose TRS (quaternion). Returns its index;
    // JS creates nodes in glTF node order so channels/skins can reference by index.
    host.registerFunction("__bl_createNode", [this](const Napi::CallbackInfo& info) -> Napi::Value {
        Node n;
        n.parent = int(argf(info, 0, -1));
        n.t[0] = float(argf(info, 1, 0)); n.t[1] = float(argf(info, 2, 0)); n.t[2] = float(argf(info, 3, 0));
        n.r[0] = float(argf(info, 4, 0)); n.r[1] = float(argf(info, 5, 0)); n.r[2] = float(argf(info, 6, 0)); n.r[3] = float(argf(info, 7, 1));
        n.s[0] = float(argf(info, 8, 1)); n.s[1] = float(argf(info, 9, 1)); n.s[2] = float(argf(info, 10, 1));
        nodes_.push_back(n);
        return Napi::Number::New(info.Env(), int(nodes_.size() - 1));
    });
    // Bind a mesh to a node so its world matrix follows that node each frame.
    host.registerFunction("__bl_setMeshNode", [this](const Napi::CallbackInfo& info) -> Napi::Value {
        const int id = int(argf(info, 0, -1));
        const int node = int(argf(info, 1, -1));
        if (id >= 0 && id < int(meshes_.size())) { meshes_[size_t(id)].node = node; }
        return info.Env().Undefined();
    });
    // Create an animation clip (AnimationGroup). Returns its index.
    host.registerFunction("__bl_createAnimation", [this](const Napi::CallbackInfo& info) -> Napi::Value {
        AnimClip clip;
        clip.name = js::argStr(info, 0);
        clip.fps = float(argf(info, 1, 60));
        anims_.push_back(std::move(clip));
        return Napi::Number::New(info.Env(), int(anims_.size() - 1));
    });
    // Add a sampler to a clip: (animId, inputTimes Float32, outputValues Float32, comp, interp).
    // Returns the sampler index within the clip. Updates the clip duration from the last key.
    host.registerFunction("__bl_addAnimSampler", [this](const Napi::CallbackInfo& info) -> Napi::Value {
        const int aid = int(argf(info, 0, -1));
        if (aid < 0 || aid >= int(anims_.size())) { return Napi::Number::New(info.Env(), -1); }
        size_t inBytes = 0, outBytes = 0;
        const uint8_t* in = js::argBytes(info, 1, &inBytes);
        const uint8_t* out = js::argBytes(info, 2, &outBytes);
        AnimSampler s;
        s.comp = int(argf(info, 3, 3));
        s.interp = int(argf(info, 4, 0));
        if (in && inBytes) { s.input.assign(reinterpret_cast<const float*>(in), reinterpret_cast<const float*>(in) + inBytes / 4); }
        if (out && outBytes) { s.output.assign(reinterpret_cast<const float*>(out), reinterpret_cast<const float*>(out) + outBytes / 4); }
        AnimClip& clip = anims_[size_t(aid)];
        if (!s.input.empty()) { clip.duration = std::fmax(clip.duration, s.input.back()); }
        clip.samplers.push_back(std::move(s));
        return Napi::Number::New(info.Env(), int(clip.samplers.size() - 1));
    });
    // Add a channel: (animId, targetNode, path[0=T,1=R,2=S,3=W], samplerIdx).
    host.registerFunction("__bl_addAnimChannel", [this](const Napi::CallbackInfo& info) -> Napi::Value {
        const int aid = int(argf(info, 0, -1));
        if (aid < 0 || aid >= int(anims_.size())) { return info.Env().Undefined(); }
        AnimChannel ch;
        ch.node = int(argf(info, 1, -1));
        ch.path = int(argf(info, 2, 0));
        ch.sampler = int(argf(info, 3, -1));
        anims_[size_t(aid)].channels.push_back(ch);
        return info.Env().Undefined();
    });
    // Animation playback control: (animId, op[0=play,1=pause,2=stop,3=goToFrame], arg).
    host.registerFunction("__bl_animControl", [this](const Napi::CallbackInfo& info) -> Napi::Value {
        const int aid = int(argf(info, 0, -1));
        if (aid < 0 || aid >= int(anims_.size())) { return info.Env().Undefined(); }
        AnimClip& clip = anims_[size_t(aid)];
        const int op = int(argf(info, 1, 0));
        switch (op) {
            case 0: clip.playing = true; break;                                   // play
            case 1: clip.playing = false; break;                                  // pause
            case 2: clip.playing = false; clip.time = 0.0f; break;                // stop
            case 3: {                                                             // goToFrame
                clip.time = float(argf(info, 2, 0)) / (clip.fps > 0 ? clip.fps : 60.0f);
                // Apply the pose immediately (sample channels at the new time).
                for (const AnimChannel& ch : clip.channels) {
                    if (ch.node < 0 || ch.node >= int(nodes_.size()) || ch.sampler < 0) { continue; }
                    Node& n = nodes_[size_t(ch.node)];
                    if (ch.path == 3) { // morph weights
                        const int wcount = clip.samplers[size_t(ch.sampler)].comp;
                        if (wcount <= 0) { continue; }
                        if (int(n.weights.size()) < wcount) { n.weights.resize(size_t(wcount), 0.0f); }
                        sampleChannel(clip, ch, clip.time, n.weights.data());
                        continue;
                    }
                    float v[4] = { 0, 0, 0, 1 };
                    sampleChannel(clip, ch, clip.time, v);
                    if (ch.path == 0) { n.t[0] = v[0]; n.t[1] = v[1]; n.t[2] = v[2]; }
                    else if (ch.path == 1) { n.r[0] = v[0]; n.r[1] = v[1]; n.r[2] = v[2]; n.r[3] = v[3]; }
                    else if (ch.path == 2) { n.s[0] = v[0]; n.s[1] = v[1]; n.s[2] = v[2]; }
                }
                break;
            }
            default: break;
        }
        return info.Env().Undefined();
    });
    host.registerFunction("__bl_setAnimLoop", [this](const Napi::CallbackInfo& info) -> Napi::Value {
        const int aid = int(argf(info, 0, -1));
        if (aid >= 0 && aid < int(anims_.size())) { anims_[size_t(aid)].loop = argf(info, 1, 1) != 0.0; }
        return info.Env().Undefined();
    });

    host.registerFunction("__bl_createTextureEncoded", [this](const Napi::CallbackInfo& info) -> Napi::Value {
        Napi::Env env = info.Env();
        if (!gfx_ || info.Length() < 1) { return Napi::Number::New(env, -1); }
        size_t bytes = 0;
        const uint8_t* enc = js::argBytes(info, 0, &bytes);
        if (!enc || bytes == 0) { return Napi::Number::New(env, -1); }
        DecodedImage img = decodeImageRGBA8(enc, bytes);
        if (!img.ok()) { return Napi::Number::New(env, -1); }
        const int id = gfx_->createTexture2D(img.width, img.height, img.rgba.data());
        return Napi::Number::New(env, id);
    });

    host.registerFunction("__bl_createSolidTexture", [this](const Napi::CallbackInfo& info) -> Napi::Value {
        Napi::Env env = info.Env();
        if (!gfx_) { return Napi::Number::New(env, -1); }
        auto c8 = [](double v) -> uint8_t { v = v < 0 ? 0 : (v > 1 ? 1 : v); return uint8_t(v * 255.0 + 0.5); };
        const uint8_t px[4] = { c8(argf(info, 0, 1)), c8(argf(info, 1, 1)), c8(argf(info, 2, 1)), 255 };
        return Napi::Number::New(env, gfx_->createTexture2D(1, 1, px));
    });

    host.registerFunction("__bl_createPbrMaterial", [this](const Napi::CallbackInfo& info) -> Napi::Value {
        Material m;
        m.isPbr = true;
        materials_.push_back(m);
        return Napi::Number::New(info.Env(), int(materials_.size() - 1));
    });
    host.registerFunction("__bl_setPbrMaterial", [this](const Napi::CallbackInfo& info) -> Napi::Value {
        const int id = int(argf(info, 0, -1));
        if (id < 0 || id >= int(materials_.size())) { return info.Env().Undefined(); }
        Material& m = materials_[size_t(id)];
        m.isPbr = true;
        m.diffuse[0] = float(argf(info, 1, 1)); m.diffuse[1] = float(argf(info, 2, 1)); m.diffuse[2] = float(argf(info, 3, 1));
        m.alpha = float(argf(info, 4, 1));
        m.metallic = float(argf(info, 5, 1));
        m.roughness = float(argf(info, 6, 1));
        m.occlusionStrength = float(argf(info, 7, 1));
        m.alphaCutoff = float(argf(info, 8, 0));
        m.emissive[0] = float(argf(info, 9, 0)); m.emissive[1] = float(argf(info, 10, 0)); m.emissive[2] = float(argf(info, 11, 0));
        m.texBase = int(argf(info, 12, -1));
        m.texMR = int(argf(info, 13, -1));
        m.texNormal = int(argf(info, 14, -1));
        m.texEmissive = int(argf(info, 15, -1));
        m.texOcclusion = int(argf(info, 16, -1));
        return info.Env().Undefined();
    });

    // --- cascaded shadow maps (directional CSM; ESM/PCF factories collapse onto this) ---
    host.registerFunction("__bl_createShadowGen", [this](const Napi::CallbackInfo& info) -> Napi::Value {
        ShadowGen g;
        g.lightId = int(argf(info, 0, -1));
        g.mapSize = int(argf(info, 1, 2048));
        g.numCascades = int(argf(info, 2, 4));
        g.lambda = float(argf(info, 3, 0.7));
        g.bias = float(argf(info, 4, 0.0008));
        if (g.numCascades < 1) { g.numCascades = 1; }
        if (g.numCascades > 4) { g.numCascades = 4; }
        shadowGens_.push_back(std::move(g));
        return Napi::Number::New(info.Env(), int(shadowGens_.size() - 1));
    });
    host.registerFunction("__bl_setShadowCasters", [this](const Napi::CallbackInfo& info) -> Napi::Value {
        const int g = int(argf(info, 0, -1));
        if (g < 0 || g >= int(shadowGens_.size())) { return info.Env().Undefined(); }
        size_t bytes = 0;
        const uint8_t* mb = js::argBytes(info, 1, &bytes);
        std::vector<int>& cs = shadowGens_[size_t(g)].casters;
        cs.clear();
        if (mb) {
            const int32_t* ids = reinterpret_cast<const int32_t*>(mb);
            const size_t n = bytes / sizeof(int32_t);
            for (size_t i = 0; i < n; ++i) { cs.push_back(ids[i]); }
        }
        return info.Env().Undefined();
    });
    host.registerFunction("__bl_enableShadows", [this](const Napi::CallbackInfo& info) -> Napi::Value {
        const int s = int(argf(info, 0, -1));
        const int g = int(argf(info, 1, -1));
        if (s >= 0 && s < int(scenes_.size())) {
            scenes_[size_t(s)].shadows = true;
            scenes_[size_t(s)].shadowGenId = g;
        }
        return info.Env().Undefined();
    });

    // --- lifecycle ---
    host.registerFunction("__bl_registerScene", [this](const Napi::CallbackInfo& info) -> Napi::Value {
        return info.Env().Undefined(); // geometry/bounds already prepared eagerly in v1
    });
    host.registerFunction("__bl_startEngine", [this](const Napi::CallbackInfo& info) -> Napi::Value {
        const int s = int(argf(info, 0, 0));
        if (s >= 0 && s < int(scenes_.size())) {
            scenes_[size_t(s)].active = true;
            activeScene_ = s;
        }
        return info.Env().Undefined();
    });
}

} // namespace lite
