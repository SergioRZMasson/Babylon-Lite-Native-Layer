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

void Gfx::setEnvironmentParams(float intensity, float exposure) {
    envParams_[1] = intensity;
    envParams_[2] = 1.0f; // hasEnv
    envParams_[3] = exposure;
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
}

void Gfx::beginFrame(int width, int height) {
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
}

void Gfx::drawMesh(int meshId, const float worldMatrix[16]) {
    if (meshId < 0 || meshId >= int(meshes_.size())) {
        return;
    }
    const Mesh& m = meshes_[meshId];
    bindStandardUniforms();
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
