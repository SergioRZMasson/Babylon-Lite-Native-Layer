#include "gfx.h"

#include "js_host.h"
#include "napi_helpers.h"

#include <bx/math.h>

#include <cmath>
#include <cstdio>
#include <cstring>
#include <vector>

namespace gfx {

namespace {

// Read an entire file into a byte vector. Returns false (empty out) on failure.
bool readFileBytes(const char* path, std::vector<uint8_t>& out) {
    FILE* f = std::fopen(path, "rb");
    if (!f) {
        return false;
    }
    std::fseek(f, 0, SEEK_END);
    long n = std::ftell(f);
    std::fseek(f, 0, SEEK_SET);
    if (n <= 0) {
        std::fclose(f);
        return false;
    }
    out.resize(static_cast<size_t>(n));
    size_t got = std::fread(out.data(), 1, static_cast<size_t>(n), f);
    std::fclose(f);
    if (got != static_cast<size_t>(n)) {
        out.clear();
        return false;
    }
    return true;
}

// Column-major matrix product out = a * b, matching getViewProj()'s convention (so a CSM
// cascade VP built here multiplies in the shader exactly like the main view-proj does).
void mulColMajor(float out[16], const float a[16], const float b[16]) {
    for (int c = 0; c < 4; ++c) {
        for (int r = 0; r < 4; ++r) {
            float s = 0.0f;
            for (int k = 0; k < 4; ++k) { s += a[k * 4 + r] * b[c * 4 + k]; }
            out[c * 4 + r] = s;
        }
    }
}

void normalize3(float v[3]) {
    const float l = std::sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    const float inv = l > 1e-8f ? 1.0f / l : 1.0f;
    v[0] *= inv; v[1] *= inv; v[2] *= inv;
}

void cross3(float out[3], const float a[3], const float b[3]) {
    out[0] = a[1] * b[2] - a[2] * b[1];
    out[1] = a[2] * b[0] - a[0] * b[2];
    out[2] = a[0] * b[1] - a[1] * b[0];
}

// Practical (PSSM) split: lambda blends logarithmic and uniform distance splits.
float practicalSplit(int i, int n, float nearZ, float farZ, float lambda) {
    const float p = float(i) / float(n);
    const float logS = nearZ * std::pow(farZ / nearZ, p);
    const float uniS = nearZ + (farZ - nearZ) * p;
    return lambda * logS + (1.0f - lambda) * uniS;
}

// Largest column scale of a column-major affine matrix (for a bounding-sphere radius).
float maxColumnScale(const float m[16]) {
    const float sx = std::sqrt(m[0] * m[0] + m[1] * m[1] + m[2] * m[2]);
    const float sy = std::sqrt(m[4] * m[4] + m[5] * m[5] + m[6] * m[6]);
    const float sz = std::sqrt(m[8] * m[8] + m[9] * m[9] + m[10] * m[10]);
    return std::fmax(sx, std::fmax(sy, sz));
}

} // namespace

void Gfx::setShadersDir(const char* dir) {
    if (dir && *dir) {
        shadersDir_ = dir;
    }
}

bgfx::ShaderHandle Gfx::loadShader(const char* name) {
    std::string path = shadersDir_;
    if (!path.empty() && path.back() != '/' && path.back() != '\\') {
        path += '/';
    }
    path += name;
    std::vector<uint8_t> bytes;
    if (!readFileBytes(path.c_str(), bytes)) {
        std::fprintf(stderr, "[gfx] cannot read shader '%s'\n", path.c_str());
        return BGFX_INVALID_HANDLE;
    }
    // copy() so bgfx owns the memory past this stack frame.
    bgfx::ShaderHandle h = bgfx::createShader(
        bgfx::copy(bytes.data(), static_cast<uint32_t>(bytes.size())));
    return h;
}

bool Gfx::initialize() {
    layout_.begin()
        .add(bgfx::Attrib::Position, 3, bgfx::AttribType::Float)
        .add(bgfx::Attrib::Normal, 3, bgfx::AttribType::Float)
        .end();

    bgfx::ShaderHandle vsh = loadShader("vs_cube.bin");
    bgfx::ShaderHandle fsh = loadShader("fs_cube.bin");
    if (!bgfx::isValid(vsh) || !bgfx::isValid(fsh)) {
        std::fprintf(stderr, "[gfx] createShader failed\n");
        return false;
    }
    program_ = bgfx::createProgram(vsh, fsh, /*destroyShaders=*/true);
    if (!bgfx::isValid(program_)) {
        std::fprintf(stderr, "[gfx] createProgram failed\n");
        return false;
    }

    uLightDir_ = bgfx::createUniform("u_lightDir", bgfx::UniformType::Vec4);
    uLightDiffuse_ = bgfx::createUniform("u_lightDiffuse", bgfx::UniformType::Vec4);
    uLightGround_ = bgfx::createUniform("u_lightGround", bgfx::UniformType::Vec4);
    uDiffuseColor_ = bgfx::createUniform("u_diffuseColor", bgfx::UniformType::Vec4);
    uSpecular_ = bgfx::createUniform("u_specular", bgfx::UniformType::Vec4);
    uEyePos_ = bgfx::createUniform("u_eyePos", bgfx::UniformType::Vec4);

    // ---- PBR pipeline ----
    pbrLayout_.begin()
        .add(bgfx::Attrib::Position, 3, bgfx::AttribType::Float)
        .add(bgfx::Attrib::Normal, 3, bgfx::AttribType::Float)
        .add(bgfx::Attrib::TexCoord0, 2, bgfx::AttribType::Float)
        .add(bgfx::Attrib::Tangent, 4, bgfx::AttribType::Float)
        .end();
    bgfx::ShaderHandle pvsh = loadShader("vs_pbr.bin");
    bgfx::ShaderHandle pfsh = loadShader("fs_pbr.bin");
    if (!bgfx::isValid(pvsh) || !bgfx::isValid(pfsh)) {
        std::fprintf(stderr, "[gfx] PBR createShader failed\n");
        return false;
    }
    pbrProgram_ = bgfx::createProgram(pvsh, pfsh, true);
    if (!bgfx::isValid(pbrProgram_)) {
        std::fprintf(stderr, "[gfx] PBR createProgram failed\n");
        return false;
    }
    uBaseColorFactor_ = bgfx::createUniform("u_baseColorFactor", bgfx::UniformType::Vec4);
    uMrParams_ = bgfx::createUniform("u_mrParams", bgfx::UniformType::Vec4);
    uEmissiveFactor_ = bgfx::createUniform("u_emissiveFactor", bgfx::UniformType::Vec4);
    uTexFlags_ = bgfx::createUniform("u_texFlags", bgfx::UniformType::Vec4);
    uOccFlag_ = bgfx::createUniform("u_occFlag", bgfx::UniformType::Vec4);
    uPbrLightDir_ = bgfx::createUniform("u_lightDir", bgfx::UniformType::Vec4);
    uPbrLightColor_ = bgfx::createUniform("u_lightColor", bgfx::UniformType::Vec4);
    uAmbientSky_ = bgfx::createUniform("u_ambientSky", bgfx::UniformType::Vec4);
    uAmbientGround_ = bgfx::createUniform("u_ambientGround", bgfx::UniformType::Vec4);
    sBaseColor_ = bgfx::createUniform("s_baseColor", bgfx::UniformType::Sampler);
    sMetalRough_ = bgfx::createUniform("s_metalRough", bgfx::UniformType::Sampler);
    sNormalTex_ = bgfx::createUniform("s_normalTex", bgfx::UniformType::Sampler);
    sEmissive_ = bgfx::createUniform("s_emissive", bgfx::UniformType::Sampler);
    sOcclusion_ = bgfx::createUniform("s_occlusion", bgfx::UniformType::Sampler);
    // IBL / environment uniforms.
    sEnvSpecular_ = bgfx::createUniform("s_envSpecular", bgfx::UniformType::Sampler);
    uEnvParams_ = bgfx::createUniform("u_envParams", bgfx::UniformType::Vec4);
    uEnvParams2_ = bgfx::createUniform("u_envParams2", bgfx::UniformType::Vec4);
    uEnvSH_ = bgfx::createUniform("u_envSH", bgfx::UniformType::Vec4, 9);

    // ---- Skinned PBR pipeline (vs_skinned + fs_pbr) ----
    pbrSkinnedLayout_.begin()
        .add(bgfx::Attrib::Position, 3, bgfx::AttribType::Float)
        .add(bgfx::Attrib::Normal, 3, bgfx::AttribType::Float)
        .add(bgfx::Attrib::TexCoord0, 2, bgfx::AttribType::Float)
        .add(bgfx::Attrib::Tangent, 4, bgfx::AttribType::Float)
        .add(bgfx::Attrib::Indices, 4, bgfx::AttribType::Float)
        .add(bgfx::Attrib::Weight, 4, bgfx::AttribType::Float)
        .end();
    bgfx::ShaderHandle svsh = loadShader("vs_skinned.bin");
    if (bgfx::isValid(svsh)) {
        // fs_pbr is consumed by the non-skinned program (destroyShaders=true above), so
        // load a fresh copy for the skinned program.
        bgfx::ShaderHandle sfsh = loadShader("fs_pbr.bin");
        pbrSkinnedProgram_ = bgfx::createProgram(svsh, sfsh, true);
        uBones_ = bgfx::createUniform("u_bones", bgfx::UniformType::Mat4, kMaxBones);
        if (!bgfx::isValid(pbrSkinnedProgram_)) {
            std::fprintf(stderr, "[gfx] skinned createProgram failed\n");
        }
    } else {
        std::fprintf(stderr, "[gfx] skinned vertex shader missing (skinning disabled)\n");
    }

    // ---- CSM shadow pipeline (vs_shadow + fs_shadow → R32F depth atlas) ----
    {
        bgfx::ShaderHandle shvsh = loadShader("vs_shadow.bin");
        bgfx::ShaderHandle shfsh = loadShader("fs_shadow.bin");
        if (bgfx::isValid(shvsh) && bgfx::isValid(shfsh)) {
            shadowProgram_ = bgfx::createProgram(shvsh, shfsh, true);
        }
        if (!bgfx::isValid(shadowProgram_)) {
            std::fprintf(stderr, "[gfx] shadow program unavailable (CSM disabled)\n");
        }
        uCsmVP_ = bgfx::createUniform("u_csmVP", bgfx::UniformType::Mat4, 4);
        uCsmSplits_ = bgfx::createUniform("u_csmSplits", bgfx::UniformType::Vec4);
        uShadowParams_ = bgfx::createUniform("u_shadowParams", bgfx::UniformType::Vec4);
        uShadowEnable_ = bgfx::createUniform("u_shadowEnable", bgfx::UniformType::Vec4);
        uSunDir_ = bgfx::createUniform("u_sunDir", bgfx::UniformType::Vec4);
        uSunColor_ = bgfx::createUniform("u_sunColor", bgfx::UniformType::Vec4);
        uCamForward_ = bgfx::createUniform("u_camForward", bgfx::UniformType::Vec4);
        sShadowAtlas_ = bgfx::createUniform("s_shadowAtlas", bgfx::UniformType::Sampler);
    }

    // Default 1x1 textures for unbound slots.
    const uint8_t white[4] = { 255, 255, 255, 255 };
    const uint8_t flatN[4] = { 128, 128, 255, 255 };
    whiteTex_ = bgfx::createTexture2D(1, 1, false, 1, bgfx::TextureFormat::RGBA8, 0, bgfx::copy(white, 4));
    flatNormalTex_ = bgfx::createTexture2D(1, 1, false, 1, bgfx::TextureFormat::RGBA8, 0, bgfx::copy(flatN, 4));
    // Default 1x1 black cubemap so s_envSpecular is always bound (no-IBL scenes).
    {
        const uint8_t black[4] = { 0, 0, 0, 255 };
        blackCube_ = bgfx::createTextureCube(1, false, 1, bgfx::TextureFormat::RGBA8);
        for (int f = 0; f < 6; ++f) {
            bgfx::updateTextureCube(blackCube_, 0, uint8_t(f), 0, 0, 0, 1, 1, bgfx::copy(black, 4));
        }
    }
    return true;
}

void Gfx::createEnvironment(int faceSize, int numMips) {
    if (bgfx::isValid(envCube_)) { bgfx::destroy(envCube_); }
    envCube_ = bgfx::createTextureCube(uint16_t(faceSize), numMips > 1, 1,
                                       bgfx::TextureFormat::RGBA16F,
                                       BGFX_SAMPLER_NONE);
    envParams_[0] = float(numMips);
}

void Gfx::uploadEnvFace(int mip, int face, int width, int height, const uint8_t* rgba8) {
    if (!bgfx::isValid(envCube_) || !rgba8) { return; }
    // RGBD decode → linear HDR (rgb = pow(c,2.2)/max(a,1/255)), then float→half RGBA16F.
    const int n = width * height;
    std::vector<uint16_t> half(size_t(n) * 4);
    for (int i = 0; i < n; ++i) {
        const float r = std::pow(rgba8[i * 4 + 0] / 255.0f, 2.2f);
        const float g = std::pow(rgba8[i * 4 + 1] / 255.0f, 2.2f);
        const float b = std::pow(rgba8[i * 4 + 2] / 255.0f, 2.2f);
        const float d = std::fmax(rgba8[i * 4 + 3] / 255.0f, 1.0f / 255.0f);
        half[size_t(i) * 4 + 0] = bx::halfFromFloat(r / d);
        half[size_t(i) * 4 + 1] = bx::halfFromFloat(g / d);
        half[size_t(i) * 4 + 2] = bx::halfFromFloat(b / d);
        half[size_t(i) * 4 + 3] = bx::halfFromFloat(1.0f);
    }
    const bgfx::Memory* mem = bgfx::copy(half.data(), uint32_t(half.size() * sizeof(uint16_t)));
    bgfx::updateTextureCube(envCube_, 0, uint8_t(face), uint8_t(mip), 0, 0,
                            uint16_t(width), uint16_t(height), mem);
}

void Gfx::setEnvironmentSH(const float* sh36) {
    if (sh36) { std::memcpy(envSH_, sh36, sizeof(envSH_)); }
}

void Gfx::setEnvironmentParams(float intensity, float exposure, float lodScale, float contrast) {
    envParams_[1] = intensity;
    envParams_[2] = 1.0f; // hasEnv
    envParams_[3] = exposure;
    envParams2_[0] = lodScale > 0.0f ? lodScale : 0.8f;
    envParams2_[1] = contrast;
}

void Gfx::setSun(float dx, float dy, float dz, float r, float g, float b) {
    sunDir_[0] = dx; sunDir_[1] = dy; sunDir_[2] = dz;
    normalize3(sunDir_);
    sunColor_[0] = r; sunColor_[1] = g; sunColor_[2] = b;
}

void Gfx::ensureShadowTargets(int mapSize) {
    if (mapSize < 256) { mapSize = 256; }
    if (mapSize > 4096) { mapSize = 4096; } // 2x2 atlas tile cap (atlas ≤ 8192²)
    if (shadowMapSize_ == mapSize && bgfx::isValid(shadowFb_)) { return; }
    if (bgfx::isValid(shadowFb_)) { bgfx::destroy(shadowFb_); shadowFb_ = BGFX_INVALID_HANDLE; }
    if (bgfx::isValid(shadowAtlas_)) { bgfx::destroy(shadowAtlas_); shadowAtlas_ = BGFX_INVALID_HANDLE; }
    if (bgfx::isValid(shadowDepth_)) { bgfx::destroy(shadowDepth_); shadowDepth_ = BGFX_INVALID_HANDLE; }
    shadowMapSize_ = mapSize;
    const uint16_t dim = uint16_t(mapSize * 2);
    const uint64_t rt = BGFX_TEXTURE_RT | BGFX_SAMPLER_MIN_POINT | BGFX_SAMPLER_MAG_POINT
                        | BGFX_SAMPLER_U_CLAMP | BGFX_SAMPLER_V_CLAMP;
    shadowAtlas_ = bgfx::createTexture2D(dim, dim, false, 1, bgfx::TextureFormat::R32F, rt);
    shadowDepth_ = bgfx::createTexture2D(dim, dim, false, 1, bgfx::TextureFormat::D32F, BGFX_TEXTURE_RT_WRITE_ONLY);
    bgfx::TextureHandle att[2] = { shadowAtlas_, shadowDepth_ };
    shadowFb_ = bgfx::createFrameBuffer(2, att, true);
    if (!bgfx::isValid(shadowFb_)) {
        std::fprintf(stderr, "[gfx] shadow framebuffer creation failed (mapSize=%d)\n", mapSize);
    }
}

void Gfx::beginShadowPass(int mapSize, int numCascades, float lambda, float bias,
                          const float sceneCenter[3], float sceneRadius) {
    if (!bgfx::isValid(shadowProgram_)) { return; }
    if (numCascades < 1) { numCascades = 1; }
    if (numCascades > 4) { numCascades = 4; }
    ensureShadowTargets(mapSize);
    if (!bgfx::isValid(shadowFb_)) { return; }
    shadowCascades_ = numCascades;
    shadowBias_ = bias;
    shadowsActive_ = true;

    // Camera basis from eye→target.
    float fwd[3] = { camTarget_[0] - eyePos_[0], camTarget_[1] - eyePos_[1], camTarget_[2] - eyePos_[2] };
    normalize3(fwd);
    camForward_[0] = fwd[0]; camForward_[1] = fwd[1]; camForward_[2] = fwd[2];
    const float worldUp[3] = { 0, 1, 0 };
    float right[3]; cross3(right, fwd, worldUp); normalize3(right);
    float up[3]; cross3(up, right, fwd); normalize3(up);

    // Cap the shadowed distance to the caster sphere so the cascades stay tight.
    float toCenter[3] = { sceneCenter[0] - eyePos_[0], sceneCenter[1] - eyePos_[1], sceneCenter[2] - eyePos_[2] };
    const float camDist = std::sqrt(toCenter[0] * toCenter[0] + toCenter[1] * toCenter[1] + toCenter[2] * toCenter[2]);
    float shadowNear = camNear_;
    float shadowFar = std::fmin(camFar_, camDist + sceneRadius);
    if (shadowFar <= shadowNear) { shadowFar = shadowNear + sceneRadius * 2.0f + 1.0f; }

    const float tanH = std::tan(0.5f * camFovYDeg_ * 3.14159265358979323846f / 180.0f);
    const float tanW = tanH * aspect_;

    float L[3] = { sunDir_[0], sunDir_[1], sunDir_[2] };
    normalize3(L);

    // Shadow cascades (views 1..N) must execute before the main pass (view 0).
    const bgfx::ViewId order[5] = { 1, 2, 3, 4, 0 };
    bgfx::setViewOrder(0, 5, order);

    for (int i = 0; i < numCascades; ++i) {
        const float sNear = practicalSplit(i, numCascades, shadowNear, shadowFar, lambda);
        const float sFar = practicalSplit(i + 1, numCascades, shadowNear, shadowFar, lambda);
        csmSplits_[i] = sFar;

        // 8 world corners of this frustum slice → its bounding sphere (stable cascade).
        float cen[3] = { 0, 0, 0};
        float corners[8][3];
        int ci = 0;
        for (int fi = 0; fi < 2; ++fi) {
            const float d = (fi == 0) ? sNear : sFar;
            const float hh = d * tanH, hw = d * tanW;
            const float cd[3] = { eyePos_[0] + fwd[0] * d, eyePos_[1] + fwd[1] * d, eyePos_[2] + fwd[2] * d };
            for (int sy = -1; sy <= 1; sy += 2) {
                for (int sx = -1; sx <= 1; sx += 2) {
                    corners[ci][0] = cd[0] + right[0] * hw * float(sx) + up[0] * hh * float(sy);
                    corners[ci][1] = cd[1] + right[1] * hw * float(sx) + up[1] * hh * float(sy);
                    corners[ci][2] = cd[2] + right[2] * hw * float(sx) + up[2] * hh * float(sy);
                    cen[0] += corners[ci][0]; cen[1] += corners[ci][1]; cen[2] += corners[ci][2];
                    ++ci;
                }
            }
        }
        cen[0] /= 8.0f; cen[1] /= 8.0f; cen[2] /= 8.0f;
        float rad = 0.0f;
        for (int k = 0; k < 8; ++k) {
            const float dx = corners[k][0] - cen[0], dy = corners[k][1] - cen[1], dz = corners[k][2] - cen[2];
            rad = std::fmax(rad, std::sqrt(dx * dx + dy * dy + dz * dz));
        }
        rad = std::ceil(rad * 16.0f) / 16.0f;

        const bx::Vec3 at = { cen[0], cen[1], cen[2] };
        const bx::Vec3 from = { cen[0] - L[0] * rad * 2.0f, cen[1] - L[1] * rad * 2.0f, cen[2] - L[2] * rad * 2.0f };
        const bx::Vec3 lup = (std::fabs(L[1]) > 0.99f) ? bx::Vec3{ 1, 0, 0 } : bx::Vec3{ 0, 1, 0 };
        float lview[16];
        bx::mtxLookAt(lview, from, at, lup);
        const bool hd = bgfx::getCaps()->homogeneousDepth;
        float lproj[16];
        bx::mtxOrtho(lproj, -rad, rad, -rad, rad, 0.0f, rad * 4.0f, 0.0f, hd);
        mulColMajor(csmVP_[i], lproj, lview);

        const uint16_t ms = uint16_t(shadowMapSize_);
        const uint16_t qx = (i == 1 || i == 3) ? ms : 0;
        const uint16_t qy = (i >= 2) ? ms : 0;
        const bgfx::ViewId vid = bgfx::ViewId(kShadowView0 + i);
        bgfx::setViewFrameBuffer(vid, shadowFb_);
        bgfx::setViewRect(vid, qx, qy, ms, ms);
        bgfx::setViewClear(vid, BGFX_CLEAR_COLOR | BGFX_CLEAR_DEPTH, 0xffffffff, 1.0f, 0);
        bgfx::setViewTransform(vid, lview, lproj);
        bgfx::touch(vid);
    }
    for (int i = numCascades; i < 4; ++i) { csmSplits_[i] = csmSplits_[numCascades - 1]; }
}

void Gfx::drawShadowCaster(int meshId, const float world[16]) {
    if (!shadowsActive_ || !bgfx::isValid(shadowProgram_)) { return; }
    if (meshId < 0 || meshId >= int(meshes_.size())) { return; }
    const Mesh& m = meshes_[size_t(meshId)];
    const bool dyn = bgfx::isValid(m.dvbh);
    if (!dyn && !bgfx::isValid(m.vbh)) { return; }
    for (int i = 0; i < shadowCascades_; ++i) {
        bgfx::setTransform(world);
        if (dyn) { bgfx::setVertexBuffer(0, m.dvbh); } else { bgfx::setVertexBuffer(0, m.vbh); }
        if (bgfx::isValid(m.ibh)) { bgfx::setIndexBuffer(m.ibh); }
        bgfx::setState(BGFX_STATE_WRITE_RGB | BGFX_STATE_WRITE_Z | BGFX_STATE_DEPTH_TEST_LESS);
        bgfx::submit(bgfx::ViewId(kShadowView0 + i), shadowProgram_);
    }
}

void Gfx::shutdown() {
    for (auto& m : meshes_) {
        if (bgfx::isValid(m.vbh)) { bgfx::destroy(m.vbh); }
        if (bgfx::isValid(m.ibh)) { bgfx::destroy(m.ibh); }
    }
    meshes_.clear();
    for (bgfx::TextureHandle t : textures_) { if (bgfx::isValid(t)) { bgfx::destroy(t); } }
    textures_.clear();
    for (bgfx::TextureHandle* t : { &whiteTex_, &flatNormalTex_ }) {
        if (bgfx::isValid(*t)) { bgfx::destroy(*t); *t = BGFX_INVALID_HANDLE; }
    }
    for (bgfx::UniformHandle* u : { &uLightDir_, &uLightDiffuse_, &uLightGround_, &uDiffuseColor_, &uSpecular_, &uEyePos_,
                                    &uBaseColorFactor_, &uMrParams_, &uEmissiveFactor_, &uTexFlags_, &uOccFlag_,
                                    &uPbrLightDir_, &uPbrLightColor_, &uAmbientSky_, &uAmbientGround_,
                                    &sBaseColor_, &sMetalRough_, &sNormalTex_, &sEmissive_, &sOcclusion_ }) {
        if (bgfx::isValid(*u)) { bgfx::destroy(*u); *u = BGFX_INVALID_HANDLE; }
    }
    if (bgfx::isValid(program_)) { bgfx::destroy(program_); program_ = BGFX_INVALID_HANDLE; }
    if (bgfx::isValid(pbrProgram_)) { bgfx::destroy(pbrProgram_); pbrProgram_ = BGFX_INVALID_HANDLE; }
    if (bgfx::isValid(shadowFb_)) { bgfx::destroy(shadowFb_); shadowFb_ = BGFX_INVALID_HANDLE; }
    if (bgfx::isValid(shadowProgram_)) { bgfx::destroy(shadowProgram_); shadowProgram_ = BGFX_INVALID_HANDLE; }
    for (bgfx::UniformHandle* u : { &uCsmVP_, &uCsmSplits_, &uShadowParams_, &uShadowEnable_,
                                    &uSunDir_, &uSunColor_, &uCamForward_, &sShadowAtlas_ }) {
        if (bgfx::isValid(*u)) { bgfx::destroy(*u); *u = BGFX_INVALID_HANDLE; }
    }
}

void Gfx::beginFrame(int width, int height) {
    shadowsActive_ = false;
    aspect_ = (height > 0) ? (float(width) / float(height)) : 1.0f;
    applyCamera();
    bgfx::setViewClear(0, BGFX_CLEAR_COLOR | BGFX_CLEAR_DEPTH, clearRgba_, 1.0f, 0);
    bgfx::setViewRect(0, 0, 0, uint16_t(width), uint16_t(height));
    bgfx::touch(0);
}

int Gfx::createMesh(const float* positions, uint32_t vertexCount,
                    const float* normals, uint32_t normalCount,
                    const void* indices, uint32_t indexCount, bool index32) {
    if (vertexCount != normalCount) {
        std::fprintf(stderr, "[gfx] createMesh: pos/normal count mismatch (%u vs %u)\n", vertexCount, normalCount);
        return -1;
    }
    const uint32_t numVerts = vertexCount / 3; // counts are float counts (3 per vertex)
    // Interleave into [px,py,pz,nx,ny,nz] per vertex.
    std::vector<float> interleaved(size_t(numVerts) * 6);
    for (uint32_t i = 0; i < numVerts; ++i) {
        interleaved[i * 6 + 0] = positions[i * 3 + 0];
        interleaved[i * 6 + 1] = positions[i * 3 + 1];
        interleaved[i * 6 + 2] = positions[i * 3 + 2];
        interleaved[i * 6 + 3] = normals[i * 3 + 0];
        interleaved[i * 6 + 4] = normals[i * 3 + 1];
        interleaved[i * 6 + 5] = normals[i * 3 + 2];
    }

    Mesh m;
    m.vbh = bgfx::createVertexBuffer(
        bgfx::copy(interleaved.data(), uint32_t(interleaved.size() * sizeof(float))), layout_);

    uint16_t flags = index32 ? BGFX_BUFFER_INDEX32 : BGFX_BUFFER_NONE;
    const uint32_t idxBytes = indexCount * (index32 ? 4u : 2u);
    m.ibh = bgfx::createIndexBuffer(bgfx::copy(indices, idxBytes), flags);

    meshes_.push_back(m);
    return int(meshes_.size() - 1);
}

void Gfx::setCamera(const float eye[3], const float target[3], float fovYDeg, float nearZ, float farZ) {
    eyePos_[0] = eye[0]; eyePos_[1] = eye[1]; eyePos_[2] = eye[2];
    camTarget_[0] = target[0]; camTarget_[1] = target[1]; camTarget_[2] = target[2];
    camFovYDeg_ = fovYDeg;
    camNear_ = nearZ;
    camFar_ = farZ;
    applyCamera();
}

void Gfx::applyCamera() {
    const bx::Vec3 at = { camTarget_[0], camTarget_[1], camTarget_[2] };
    const bx::Vec3 from = { eyePos_[0], eyePos_[1], eyePos_[2] };
    bx::mtxLookAt(view_, from, at);

    const bool homogeneousDepth = bgfx::getCaps()->homogeneousDepth;
    bx::mtxProj(proj_, camFovYDeg_, aspect_, camNear_, camFar_, homogeneousDepth);
    bgfx::setViewTransform(0, view_, proj_);
}

void Gfx::getViewProj(float out[16]) const {
    // Column-major proj * view (so clip = viewProj * worldPos, matching the shader's mul()).
    for (int c = 0; c < 4; ++c) {
        for (int r = 0; r < 4; ++r) {
            float s = 0.0f;
            for (int k = 0; k < 4; ++k) {
                s += proj_[k * 4 + r] * view_[c * 4 + k];
            }
            out[c * 4 + r] = s;
        }
    }
}

void Gfx::setClearColor(float r, float g, float b, float a) {
    auto c8 = [](float v) -> uint32_t {
        if (v < 0) v = 0;
        if (v > 1) v = 1;
        return uint32_t(v * 255.0f + 0.5f);
    };
    clearRgba_ = (c8(r) << 24) | (c8(g) << 16) | (c8(b) << 8) | c8(a);
}

void Gfx::setLightHemispheric(float dx, float dy, float dz,
                              float diffR, float diffG, float diffB,
                              float groundR, float groundG, float groundB) {
    // Normalize the direction (the shader normalizes too, but keep it clean).
    const float len = std::sqrt(dx * dx + dy * dy + dz * dz);
    const float inv = len > 1e-6f ? 1.0f / len : 1.0f;
    mLightDir_[0] = dx * inv; mLightDir_[1] = dy * inv; mLightDir_[2] = dz * inv;
    mLightDiffuse_[0] = diffR; mLightDiffuse_[1] = diffG; mLightDiffuse_[2] = diffB;
    mLightGround_[0] = groundR; mLightGround_[1] = groundG; mLightGround_[2] = groundB;
}

void Gfx::setStandardMaterial(float diffR, float diffG, float diffB, float alpha,
                              float specR, float specG, float specB, float glossiness) {
    mDiffuse_[0] = diffR; mDiffuse_[1] = diffG; mDiffuse_[2] = diffB; mDiffuse_[3] = alpha;
    mSpecular_[0] = specR; mSpecular_[1] = specG; mSpecular_[2] = specB; mSpecular_[3] = glossiness;
}

void Gfx::bindStandardUniforms() {
    bgfx::setUniform(uLightDir_, mLightDir_);
    bgfx::setUniform(uLightDiffuse_, mLightDiffuse_);
    bgfx::setUniform(uLightGround_, mLightGround_);
    bgfx::setUniform(uDiffuseColor_, mDiffuse_);
    bgfx::setUniform(uSpecular_, mSpecular_);
    bgfx::setUniform(uEyePos_, eyePos_);
    bindShadowUniforms();
}

// Bind the directional-sun + CSM uniforms for the standard program. Always called (so the
// sampler/uniforms are defined); u_sunColor is 0 and u_shadowEnable is per-draw, so scenes
// without a sun render exactly as before.
void Gfx::bindShadowUniforms() {
    bgfx::setUniform(uCsmVP_, csmVP_, 4);
    bgfx::setUniform(uCsmSplits_, csmSplits_);
    const bool obl = bgfx::getCaps()->originBottomLeft;
    const float atlasTexel = shadowMapSize_ > 0 ? 1.0f / float(shadowMapSize_ * 2) : 0.0f;
    const float params[4] = { float(shadowCascades_ > 0 ? shadowCascades_ : 1), shadowBias_, atlasTexel, obl ? 1.0f : 0.0f };
    bgfx::setUniform(uShadowParams_, params);
    bgfx::setUniform(uSunDir_, sunDir_);
    bgfx::setUniform(uSunColor_, sunColor_);
    bgfx::setUniform(uCamForward_, camForward_);
    const bgfx::TextureHandle atlas = (shadowsActive_ && bgfx::isValid(shadowAtlas_)) ? shadowAtlas_ : whiteTex_;
    bgfx::setTexture(0, sShadowAtlas_, atlas);
}

void Gfx::drawMesh(int meshId, const float worldMatrix[16], bool receiveShadows) {
    if (meshId < 0 || meshId >= int(meshes_.size())) {
        return;
    }
    const Mesh& m = meshes_[meshId];
    bindStandardUniforms();
    const float en[4] = { (receiveShadows && shadowsActive_) ? 1.0f : 0.0f, 0, 0, 0 };
    bgfx::setUniform(uShadowEnable_, en);
    bgfx::setTransform(worldMatrix);
    bgfx::setVertexBuffer(0, m.vbh);
    bgfx::setIndexBuffer(m.ibh);
    bgfx::setState(BGFX_STATE_WRITE_RGB | BGFX_STATE_WRITE_A | BGFX_STATE_WRITE_Z
                   | BGFX_STATE_DEPTH_TEST_LESS | BGFX_STATE_CULL_CCW | BGFX_STATE_MSAA);
    bgfx::submit(0, program_);
}

int Gfx::drawInstances(int meshId, const float* worldMatrices, uint32_t count) {
    if (meshId < 0 || meshId >= int(meshes_.size()) || !worldMatrices) {
        return 0;
    }
    const Mesh& m = meshes_[meshId];
    const uint64_t state = BGFX_STATE_WRITE_RGB | BGFX_STATE_WRITE_A | BGFX_STATE_WRITE_Z
                           | BGFX_STATE_DEPTH_TEST_LESS | BGFX_STATE_CULL_CCW | BGFX_STATE_MSAA;
    int draws = 0;
    for (uint32_t i = 0; i < count; ++i) {
        bindStandardUniforms();
        const float en[4] = { 0, 0, 0, 0 };
        bgfx::setUniform(uShadowEnable_, en);
        bgfx::setTransform(worldMatrices + size_t(i) * 16);
        bgfx::setVertexBuffer(0, m.vbh);
        bgfx::setIndexBuffer(m.ibh);
        bgfx::setState(state);
        bgfx::submit(0, program_);
        ++draws;
    }
    return draws;
}

int Gfx::createTexture2D(int width, int height, const uint8_t* rgba) {
    if (width <= 0 || height <= 0 || !rgba) { return -1; }
    const bgfx::Memory* mem = bgfx::copy(rgba, uint32_t(width) * uint32_t(height) * 4);
    bgfx::TextureHandle th = bgfx::createTexture2D(uint16_t(width), uint16_t(height), false, 1,
                                                   bgfx::TextureFormat::RGBA8,
                                                   BGFX_SAMPLER_NONE, mem);
    if (!bgfx::isValid(th)) { return -1; }
    textures_.push_back(th);
    return int(textures_.size() - 1);
}

int Gfx::createMeshPBR(const float* pos, uint32_t posCount, const float* nrm, uint32_t nrmCount,
                       const float* uv, uint32_t uvCount, const float* tan, uint32_t tanCount,
                       const void* indices, uint32_t indexCount, bool index32) {
    const uint32_t numVerts = posCount / 3;
    if (numVerts == 0 || nrmCount != posCount) { return -1; }
    // Interleave pos3 / normal3 / uv2 / tangent4 (= 12 floats per vertex).
    std::vector<float> v(size_t(numVerts) * 12);
    for (uint32_t i = 0; i < numVerts; ++i) {
        float* o = &v[size_t(i) * 12];
        o[0] = pos[i * 3 + 0]; o[1] = pos[i * 3 + 1]; o[2] = pos[i * 3 + 2];
        o[3] = nrm[i * 3 + 0]; o[4] = nrm[i * 3 + 1]; o[5] = nrm[i * 3 + 2];
        o[6] = (uv && uvCount >= (i + 1) * 2) ? uv[i * 2 + 0] : 0.0f;
        o[7] = (uv && uvCount >= (i + 1) * 2) ? uv[i * 2 + 1] : 0.0f;
        if (tan && tanCount >= (i + 1) * 4) {
            o[8] = tan[i * 4 + 0]; o[9] = tan[i * 4 + 1]; o[10] = tan[i * 4 + 2]; o[11] = tan[i * 4 + 3];
        } else {
            o[8] = 1.0f; o[9] = 0.0f; o[10] = 0.0f; o[11] = 1.0f;
        }
    }
    Mesh m;
    m.vbh = bgfx::createVertexBuffer(bgfx::copy(v.data(), uint32_t(v.size() * sizeof(float))), pbrLayout_);
    const uint16_t flags = index32 ? BGFX_BUFFER_INDEX32 : BGFX_BUFFER_NONE;
    m.ibh = bgfx::createIndexBuffer(bgfx::copy(indices, indexCount * (index32 ? 4u : 2u)), flags);
    meshes_.push_back(m);
    return int(meshes_.size() - 1);
}

void Gfx::setPbrLight(float dx, float dy, float dz, float cr, float cg, float cb,
                      float skyR, float skyG, float skyB, float gndR, float gndG, float gndB) {
    const float len = std::sqrt(dx * dx + dy * dy + dz * dz);
    const float inv = len > 1e-6f ? 1.0f / len : 1.0f;
    pbrLightDir_[0] = dx * inv; pbrLightDir_[1] = dy * inv; pbrLightDir_[2] = dz * inv;
    pbrLightColor_[0] = cr; pbrLightColor_[1] = cg; pbrLightColor_[2] = cb;
    pbrAmbientSky_[0] = skyR; pbrAmbientSky_[1] = skyG; pbrAmbientSky_[2] = skyB;
    pbrAmbientGround_[0] = gndR; pbrAmbientGround_[1] = gndG; pbrAmbientGround_[2] = gndB;
}

void Gfx::drawMeshPBR(int meshId, const float worldMatrix[16], const PbrDraw& mat) {
    if (meshId < 0 || meshId >= int(meshes_.size())) { return; }
    const Mesh& m = meshes_[size_t(meshId)];

    auto texOr = [&](int id, bgfx::TextureHandle def) -> bgfx::TextureHandle {
        return (id >= 0 && id < int(textures_.size()) && bgfx::isValid(textures_[size_t(id)])) ? textures_[size_t(id)] : def;
    };
    bgfx::setUniform(uBaseColorFactor_, mat.baseColor);
    const float mr[4] = { mat.metallic, mat.roughness, mat.occlusionStrength, mat.alphaCutoff };
    bgfx::setUniform(uMrParams_, mr);
    const float em[4] = { mat.emissive[0], mat.emissive[1], mat.emissive[2], 0.0f };
    bgfx::setUniform(uEmissiveFactor_, em);
    const float flags[4] = { mat.texBase >= 0 ? 1.0f : 0.0f, mat.texMR >= 0 ? 1.0f : 0.0f,
                             mat.texNormal >= 0 ? 1.0f : 0.0f, mat.texEmissive >= 0 ? 1.0f : 0.0f };
    bgfx::setUniform(uTexFlags_, flags);
    const float occ[4] = { mat.texOcclusion >= 0 ? 1.0f : 0.0f, 0, 0, 0 };
    bgfx::setUniform(uOccFlag_, occ);
    bgfx::setUniform(uPbrLightDir_, pbrLightDir_);
    bgfx::setUniform(uPbrLightColor_, pbrLightColor_);
    bgfx::setUniform(uAmbientSky_, pbrAmbientSky_);
    bgfx::setUniform(uAmbientGround_, pbrAmbientGround_);
    bgfx::setUniform(uEyePos_, eyePos_);

    bgfx::setTexture(0, sBaseColor_, texOr(mat.texBase, whiteTex_));
    bgfx::setTexture(1, sMetalRough_, texOr(mat.texMR, whiteTex_));
    bgfx::setTexture(2, sNormalTex_, texOr(mat.texNormal, flatNormalTex_));
    bgfx::setTexture(3, sEmissive_, texOr(mat.texEmissive, whiteTex_));
    bgfx::setTexture(4, sOcclusion_, texOr(mat.texOcclusion, whiteTex_));
    bgfx::setUniform(uEnvParams_, envParams_);
    bgfx::setUniform(uEnvParams2_, envParams2_);
    bgfx::setUniform(uEnvSH_, envSH_, 9);
    bgfx::setTexture(5, sEnvSpecular_, bgfx::isValid(envCube_) ? envCube_ : blackCube_);

    bgfx::setTransform(worldMatrix);
    if (m.morphTargets > 0 && bgfx::isValid(m.dvbh)) { bgfx::setVertexBuffer(0, m.dvbh); }
    else { bgfx::setVertexBuffer(0, m.vbh); }
    bgfx::setIndexBuffer(m.ibh);
    bgfx::setState(BGFX_STATE_WRITE_RGB | BGFX_STATE_WRITE_A | BGFX_STATE_WRITE_Z
                   | BGFX_STATE_DEPTH_TEST_LESS | BGFX_STATE_CULL_CCW | BGFX_STATE_MSAA);
    bgfx::submit(0, pbrProgram_);
}

int Gfx::createMeshSkinnedPBR(const float* pos, uint32_t posCount, const float* nrm, uint32_t nrmCount,
                              const float* uv, uint32_t uvCount, const float* tan, uint32_t tanCount,
                              const uint32_t* joints, const float* weights,
                              const void* indices, uint32_t indexCount, bool index32) {
    const uint32_t numVerts = posCount / 3;
    if (numVerts == 0 || nrmCount != posCount) { return -1; }
    // Interleave pos3/normal3/uv2/tangent4 (48 B) + indices4 f (16 B) + weight4 f (16 B) = 80 B.
    // Bone indices are stored as Float (not Uint8) so the shader reads them cleanly: bgfx maps
    // AttribType::Uint8 to an integer DXGI format, which a float `a_indices` would misread.
    const uint32_t stride = 80;
    std::vector<uint8_t> buf(size_t(numVerts) * stride);
    for (uint32_t i = 0; i < numVerts; ++i) {
        uint8_t* base = &buf[size_t(i) * stride];
        float* f = reinterpret_cast<float*>(base);
        f[0] = pos[i * 3 + 0]; f[1] = pos[i * 3 + 1]; f[2] = pos[i * 3 + 2];
        f[3] = nrm[i * 3 + 0]; f[4] = nrm[i * 3 + 1]; f[5] = nrm[i * 3 + 2];
        f[6] = (uv && uvCount >= (i + 1) * 2) ? uv[i * 2 + 0] : 0.0f;
        f[7] = (uv && uvCount >= (i + 1) * 2) ? uv[i * 2 + 1] : 0.0f;
        if (tan && tanCount >= (i + 1) * 4) {
            f[8] = tan[i * 4 + 0]; f[9] = tan[i * 4 + 1]; f[10] = tan[i * 4 + 2]; f[11] = tan[i * 4 + 3];
        } else {
            f[8] = 1.0f; f[9] = 0.0f; f[10] = 0.0f; f[11] = 1.0f;
        }
        // indices (4 float) at offset 48, weight (4 float) at offset 64.
        for (int k = 0; k < 4; ++k) {
            uint32_t j = joints ? joints[i * 4 + k] : 0;
            if (j >= uint32_t(kMaxBones)) { j = 0; }
            f[12 + k] = float(j);
        }
        if (weights) {
            f[16] = weights[i * 4 + 0]; f[17] = weights[i * 4 + 1]; f[18] = weights[i * 4 + 2]; f[19] = weights[i * 4 + 3];
        } else {
            f[16] = 1.0f; f[17] = f[18] = f[19] = 0.0f;
        }
    }
    Mesh m;
    m.vbh = bgfx::createVertexBuffer(bgfx::copy(buf.data(), uint32_t(buf.size())), pbrSkinnedLayout_);
    const uint16_t flags = index32 ? BGFX_BUFFER_INDEX32 : BGFX_BUFFER_NONE;
    m.ibh = bgfx::createIndexBuffer(bgfx::copy(indices, indexCount * (index32 ? 4u : 2u)), flags);
    meshes_.push_back(m);
    return int(meshes_.size() - 1);
}

void Gfx::drawMeshSkinnedPBR(int meshId, const float worldMatrix[16],
                             const float* bonePalette, int boneCount, const PbrDraw& mat) {
    if (meshId < 0 || meshId >= int(meshes_.size())) { return; }
    if (!bgfx::isValid(pbrSkinnedProgram_)) { return; }
    const Mesh& m = meshes_[size_t(meshId)];

    auto texOr = [&](int id, bgfx::TextureHandle def) -> bgfx::TextureHandle {
        return (id >= 0 && id < int(textures_.size()) && bgfx::isValid(textures_[size_t(id)])) ? textures_[size_t(id)] : def;
    };
    bgfx::setUniform(uBaseColorFactor_, mat.baseColor);
    const float mr[4] = { mat.metallic, mat.roughness, mat.occlusionStrength, mat.alphaCutoff };
    bgfx::setUniform(uMrParams_, mr);
    const float em[4] = { mat.emissive[0], mat.emissive[1], mat.emissive[2], 0.0f };
    bgfx::setUniform(uEmissiveFactor_, em);
    const float flags[4] = { mat.texBase >= 0 ? 1.0f : 0.0f, mat.texMR >= 0 ? 1.0f : 0.0f,
                             mat.texNormal >= 0 ? 1.0f : 0.0f, mat.texEmissive >= 0 ? 1.0f : 0.0f };
    bgfx::setUniform(uTexFlags_, flags);
    const float occ[4] = { mat.texOcclusion >= 0 ? 1.0f : 0.0f, 0, 0, 0 };
    bgfx::setUniform(uOccFlag_, occ);
    bgfx::setUniform(uPbrLightDir_, pbrLightDir_);
    bgfx::setUniform(uPbrLightColor_, pbrLightColor_);
    bgfx::setUniform(uAmbientSky_, pbrAmbientSky_);
    bgfx::setUniform(uAmbientGround_, pbrAmbientGround_);
    bgfx::setUniform(uEyePos_, eyePos_);

    if (boneCount > kMaxBones) { boneCount = kMaxBones; }
    bgfx::setUniform(uBones_, bonePalette, uint16_t(boneCount));

    bgfx::setTexture(0, sBaseColor_, texOr(mat.texBase, whiteTex_));
    bgfx::setTexture(1, sMetalRough_, texOr(mat.texMR, whiteTex_));
    bgfx::setTexture(2, sNormalTex_, texOr(mat.texNormal, flatNormalTex_));
    bgfx::setTexture(3, sEmissive_, texOr(mat.texEmissive, whiteTex_));
    bgfx::setTexture(4, sOcclusion_, texOr(mat.texOcclusion, whiteTex_));
    bgfx::setUniform(uEnvParams_, envParams_);
    bgfx::setUniform(uEnvParams2_, envParams2_);
    bgfx::setUniform(uEnvSH_, envSH_, 9);
    bgfx::setTexture(5, sEnvSpecular_, bgfx::isValid(envCube_) ? envCube_ : blackCube_);

    bgfx::setTransform(worldMatrix);
    if (m.morphTargets > 0 && bgfx::isValid(m.dvbh)) { bgfx::setVertexBuffer(0, m.dvbh); }
    else { bgfx::setVertexBuffer(0, m.vbh); }
    bgfx::setIndexBuffer(m.ibh);
    bgfx::setState(BGFX_STATE_WRITE_RGB | BGFX_STATE_WRITE_A | BGFX_STATE_WRITE_Z
                   | BGFX_STATE_DEPTH_TEST_LESS | BGFX_STATE_CULL_CCW | BGFX_STATE_MSAA);
    bgfx::submit(0, pbrSkinnedProgram_);
}

// Interleave PBR vertex data (pos3/normal3/uv2/tangent4 = 48 B) into `buf`.
static void interleavePBR(std::vector<uint8_t>& buf, uint32_t numVerts,
                          const float* pos, const float* nrm, const float* uv, uint32_t uvCount,
                          const float* tan, uint32_t tanCount) {
    buf.assign(size_t(numVerts) * 48, 0);
    for (uint32_t i = 0; i < numVerts; ++i) {
        float* o = reinterpret_cast<float*>(&buf[size_t(i) * 48]);
        o[0] = pos[i * 3 + 0]; o[1] = pos[i * 3 + 1]; o[2] = pos[i * 3 + 2];
        o[3] = nrm[i * 3 + 0]; o[4] = nrm[i * 3 + 1]; o[5] = nrm[i * 3 + 2];
        o[6] = (uv && uvCount >= (i + 1) * 2) ? uv[i * 2 + 0] : 0.0f;
        o[7] = (uv && uvCount >= (i + 1) * 2) ? uv[i * 2 + 1] : 0.0f;
        if (tan && tanCount >= (i + 1) * 4) { o[8] = tan[i*4+0]; o[9] = tan[i*4+1]; o[10] = tan[i*4+2]; o[11] = tan[i*4+3]; }
        else { o[8] = 1.0f; o[9] = 0.0f; o[10] = 0.0f; o[11] = 1.0f; }
    }
}

int Gfx::createMeshMorphPBR(const float* pos, uint32_t posCount, const float* nrm, uint32_t nrmCount,
                            const float* uv, uint32_t uvCount, const float* tan, uint32_t tanCount,
                            const void* indices, uint32_t indexCount, bool index32,
                            const float* dPos, const float* dNrm, int targetCount) {
    const uint32_t numVerts = posCount / 3;
    if (numVerts == 0 || nrmCount != posCount || targetCount <= 0) { return -1; }
    Mesh m;
    m.stride = 48; m.numVerts = numVerts; m.morphTargets = targetCount;
    interleavePBR(m.morphBase, numVerts, pos, nrm, uv, uvCount, tan, tanCount);
    m.morphDPos.assign(dPos, dPos + size_t(targetCount) * numVerts * 3);
    if (dNrm) { m.morphDNrm.assign(dNrm, dNrm + size_t(targetCount) * numVerts * 3); }
    m.dvbh = bgfx::createDynamicVertexBuffer(bgfx::copy(m.morphBase.data(), uint32_t(m.morphBase.size())), pbrLayout_);
    const uint16_t flags = index32 ? BGFX_BUFFER_INDEX32 : BGFX_BUFFER_NONE;
    m.ibh = bgfx::createIndexBuffer(bgfx::copy(indices, indexCount * (index32 ? 4u : 2u)), flags);
    meshes_.push_back(std::move(m));
    return int(meshes_.size() - 1);
}

int Gfx::createMeshMorphSkinnedPBR(const float* pos, uint32_t posCount, const float* nrm, uint32_t nrmCount,
                                   const float* uv, uint32_t uvCount, const float* tan, uint32_t tanCount,
                                   const uint32_t* joints, const float* weights,
                                   const void* indices, uint32_t indexCount, bool index32,
                                   const float* dPos, const float* dNrm, int targetCount) {
    const uint32_t numVerts = posCount / 3;
    if (numVerts == 0 || nrmCount != posCount || targetCount <= 0) { return -1; }
    const uint32_t stride = 80;
    Mesh m;
    m.stride = stride; m.numVerts = numVerts; m.morphTargets = targetCount;
    m.morphBase.assign(size_t(numVerts) * stride, 0);
    for (uint32_t i = 0; i < numVerts; ++i) {
        float* f = reinterpret_cast<float*>(&m.morphBase[size_t(i) * stride]);
        f[0] = pos[i*3+0]; f[1] = pos[i*3+1]; f[2] = pos[i*3+2];
        f[3] = nrm[i*3+0]; f[4] = nrm[i*3+1]; f[5] = nrm[i*3+2];
        f[6] = (uv && uvCount >= (i + 1) * 2) ? uv[i*2+0] : 0.0f;
        f[7] = (uv && uvCount >= (i + 1) * 2) ? uv[i*2+1] : 0.0f;
        if (tan && tanCount >= (i + 1) * 4) { f[8] = tan[i*4+0]; f[9] = tan[i*4+1]; f[10] = tan[i*4+2]; f[11] = tan[i*4+3]; }
        else { f[8] = 1.0f; f[9] = 0.0f; f[10] = 0.0f; f[11] = 1.0f; }
        for (int k = 0; k < 4; ++k) { uint32_t j = joints ? joints[i*4+k] : 0; if (j >= uint32_t(kMaxBones)) { j = 0; } f[12 + k] = float(j); }
        if (weights) { f[16] = weights[i*4+0]; f[17] = weights[i*4+1]; f[18] = weights[i*4+2]; f[19] = weights[i*4+3]; }
        else { f[16] = 1.0f; f[17] = f[18] = f[19] = 0.0f; }
    }
    m.morphDPos.assign(dPos, dPos + size_t(targetCount) * numVerts * 3);
    if (dNrm) { m.morphDNrm.assign(dNrm, dNrm + size_t(targetCount) * numVerts * 3); }
    m.dvbh = bgfx::createDynamicVertexBuffer(bgfx::copy(m.morphBase.data(), uint32_t(m.morphBase.size())), pbrSkinnedLayout_);
    const uint16_t flags = index32 ? BGFX_BUFFER_INDEX32 : BGFX_BUFFER_NONE;
    m.ibh = bgfx::createIndexBuffer(bgfx::copy(indices, indexCount * (index32 ? 4u : 2u)), flags);
    meshes_.push_back(std::move(m));
    return int(meshes_.size() - 1);
}

void Gfx::updateMeshMorph(int meshId, const float* weights, int count) {
    if (meshId < 0 || meshId >= int(meshes_.size())) { return; }
    Mesh& m = meshes_[size_t(meshId)];
    if (m.morphTargets <= 0 || !bgfx::isValid(m.dvbh) || m.morphBase.empty()) { return; }
    if (count > m.morphTargets) { count = m.morphTargets; }
    std::vector<uint8_t> work = m.morphBase;   // copy rest pose, then add weighted deltas
    const uint32_t nv = m.numVerts, stride = m.stride;
    const bool hasNrm = !m.morphDNrm.empty();
    for (int t = 0; t < count; ++t) {
        const float w = weights[t];
        if (w == 0.0f) { continue; }
        const float* dp = &m.morphDPos[size_t(t) * nv * 3];
        const float* dn = hasNrm ? &m.morphDNrm[size_t(t) * nv * 3] : nullptr;
        for (uint32_t i = 0; i < nv; ++i) {
            float* f = reinterpret_cast<float*>(&work[size_t(i) * stride]);
            f[0] += w * dp[i*3+0]; f[1] += w * dp[i*3+1]; f[2] += w * dp[i*3+2];
            if (dn) { f[3] += w * dn[i*3+0]; f[4] += w * dn[i*3+1]; f[5] += w * dn[i*3+2]; }
        }
    }
    bgfx::update(m.dvbh, 0, bgfx::copy(work.data(), uint32_t(work.size())));
}

void Gfx::registerOn(js::Host& host) {
    host.registerFunction("gfx.setClearColor", [this](const Napi::CallbackInfo& info) -> Napi::Value {
        setClearColor(float(js::argNum(info, 0, 0)), float(js::argNum(info, 1, 0)),
                      float(js::argNum(info, 2, 0)), float(js::argNum(info, 3, 1)));
        return info.Env().Undefined();
    });

    host.registerFunction("gfx.createMesh", [this](const Napi::CallbackInfo& info) -> Napi::Value {
        Napi::Env env = info.Env();
        if (info.Length() < 3) {
            return Napi::Number::New(env, -1);
        }
        size_t posLen = 0, nrmLen = 0, idxLen = 0;
        const uint8_t* pos = js::argBytes(info, 0, &posLen);
        const uint8_t* nrm = js::argBytes(info, 1, &nrmLen);
        const uint8_t* idx = js::argBytes(info, 2, &idxLen);
        if (!pos || !nrm || !idx) {
            std::fprintf(stderr, "[gfx] createMesh: expected typed arrays\n");
            return Napi::Number::New(env, -1);
        }
        const bool index32 = js::argIsUint32Array(info, 2);
        const uint32_t vCount = uint32_t(posLen / sizeof(float));
        const uint32_t nCount = uint32_t(nrmLen / sizeof(float));
        const uint32_t iCount = uint32_t(idxLen / (index32 ? 4 : 2));
        const int id = createMesh(reinterpret_cast<const float*>(pos), vCount,
                                  reinterpret_cast<const float*>(nrm), nCount,
                                  idx, iCount, index32);
        return Napi::Number::New(env, id);
    });

    host.registerFunction("gfx.setCamera", [this](const Napi::CallbackInfo& info) -> Napi::Value {
        // Args: eyeX,eyeY,eyeZ, targetX,targetY,targetZ, fovYDeg, near, far
        const double def[9] = { 0, 0, -5, 0, 0, 0, 60, 0.1, 100 };
        double a[9];
        for (int i = 0; i < 9; ++i) { a[i] = js::argNum(info, size_t(i), def[i]); }
        const float eye[3] = { float(a[0]), float(a[1]), float(a[2]) };
        const float target[3] = { float(a[3]), float(a[4]), float(a[5]) };
        setCamera(eye, target, float(a[6]), float(a[7]), float(a[8]));
        return info.Env().Undefined();
    });

    host.registerFunction("gfx.drawMesh", [this](const Napi::CallbackInfo& info) -> Napi::Value {
        Napi::Env env = info.Env();
        if (info.Length() < 2) {
            return env.Undefined();
        }
        const int id = js::argInt(info, 0, -1);
        size_t mLen = 0;
        const uint8_t* mb = js::argBytes(info, 1, &mLen);
        if (!mb || mLen < 16 * sizeof(float)) {
            return env.Undefined();
        }
        drawMesh(id, reinterpret_cast<const float*>(mb));
        return env.Undefined();
    });

    host.registerFunction("gfx.drawInstances", [this](const Napi::CallbackInfo& info) -> Napi::Value {
        Napi::Env env = info.Env();
        if (info.Length() < 3) {
            return Napi::Number::New(env, 0);
        }
        const int id = js::argInt(info, 0, -1);
        size_t bytes = 0;
        const uint8_t* mb = js::argBytes(info, 1, &bytes);
        const int count = js::argInt(info, 2, 0);
        if (!mb || count <= 0 || bytes < size_t(count) * 16 * sizeof(float)) {
            return Napi::Number::New(env, 0);
        }
        const int draws = drawInstances(id, reinterpret_cast<const float*>(mb), uint32_t(count));
        return Napi::Number::New(env, draws);
    });

    // Returns the current column-major viewProj (proj*view) as a 16-element JS array,
    // so the JS-baseline path can frustum-cull with the exact same matrices as native.
    host.registerFunction("gfx.getViewProj", [this](const Napi::CallbackInfo& info) -> Napi::Value {
        Napi::Env env = info.Env();
        float vp[16];
        getViewProj(vp);
        Napi::Array arr = Napi::Array::New(env, 16);
        for (uint32_t i = 0; i < 16; ++i) {
            arr.Set(i, Napi::Number::New(env, vp[i]));
        }
        return arr;
    });
}

} // namespace gfx
