#pragma once

// Native rendering seam (Option C) over bgfx. JS orchestrates; these functions
// own the GPU work. Exposed to JS as gfx.createMesh / gfx.setCamera /
// gfx.drawMesh / gfx.setClearColor by registerGfx().

#include <cstdint>
#include <string>
#include <vector>

#include <bgfx/bgfx.h>

namespace js { class Host; }

namespace gfx {

// Parameters for a single glTF metallic-roughness PBR draw. Texture ids are gfx
// texture handles (see createTexture2D); -1 = absent (a default is bound + flagged off).
struct PbrDraw {
    float baseColor[4] = { 1, 1, 1, 1 };
    float metallic = 1.0f, roughness = 1.0f, occlusionStrength = 1.0f, alphaCutoff = 0.0f;
    float emissive[3] = { 0, 0, 0 };
    int texBase = -1, texMR = -1, texNormal = -1, texEmissive = -1, texOcclusion = -1;
};

class Gfx {
public:
    bool initialize();
    void shutdown();

    // Directory containing the compiled shader .bin files (vs_cube.bin, fs_cube.bin,
    // vs_pbr.bin, fs_pbr.bin). Must be set before initialize(). Defaults to "shaders".
    void setShadersDir(const char* dir);

    // Per-frame: set the active framebuffer size (view 0 rect) and clear colour.
    void beginFrame(int width, int height);

    int createMesh(const float* positions, uint32_t vertexCount,
                   const float* normals, uint32_t normalCount,
                   const void* indices, uint32_t indexCount, bool index32);

    // eye/target in world space; vertical FOV in degrees. Computes view+proj with
    // bgfx-correct NDC for the active renderer (D3D11).
    void setCamera(const float eye[3], const float target[3], float fovYDeg, float nearZ, float farZ);

    void setClearColor(float r, float g, float b, float a);

    // Standard-material light/material parameters used by the ported shader. Defaults
    // match the Phase-1 red cube; the lite engine overrides them per material/light.
    void setLightHemispheric(float dx, float dy, float dz,
                             float diffR, float diffG, float diffB,
                             float groundR, float groundG, float groundB);
    void setStandardMaterial(float diffR, float diffG, float diffB, float alpha,
                             float specR, float specG, float specB, float glossiness);

    // worldMatrix: 16 floats, column-major (bgfx convention).
    void drawMesh(int meshId, const float worldMatrix[16]);

    // Draw `count` instances of `meshId`, each with a 16-float column-major world
    // matrix packed back-to-back in `worldMatrices`. Used by the JS-baseline path
    // (one JS→C++ crossing per frame). Returns the number of draw calls issued.
    int drawInstances(int meshId, const float* worldMatrices, uint32_t count);

    // Register gfx.* on the JS host.
    void registerOn(js::Host& host);

    uint32_t clearRgba() const { return clearRgba_; }

    // Camera accessors for native culling. viewProj is column-major (proj*view).
    void getViewProj(float out[16]) const;
    const float* eye() const { return eyePos_; }

    // ---- PBR (glTF metallic-roughness) ----
    // Create an RGBA8 2D texture (with mipmaps). Returns a gfx texture id, or -1.
    int createTexture2D(int width, int height, const uint8_t* rgba);
    // Create a PBR mesh (pos3/normal3/uv2/tangent4). Counts are float counts (uv = 2/vertex,
    // tangent = 4/vertex); indices are uint16 or uint32. Returns a gfx mesh id.
    int createMeshPBR(const float* pos, uint32_t posCount, const float* nrm, uint32_t nrmCount,
                      const float* uv, uint32_t uvCount, const float* tan, uint32_t tanCount,
                      const void* indices, uint32_t indexCount, bool index32);
    // Per-frame PBR lighting (direct light + hemispheric ambient stand-in for IBL).
    void setPbrLight(float dx, float dy, float dz, float cr, float cg, float cb,
                     float skyR, float skyG, float skyB, float gndR, float gndG, float gndB);
    void drawMeshPBR(int meshId, const float worldMatrix[16], const PbrDraw& mat);

    // ---- Skeletal animation (GPU skinning) ----
    // Create a skinned PBR mesh: PBR vertex data + per-vertex bone indices (4 uint32/vertex,
    // packed to uint8 in the buffer) and weights (4 float/vertex). Returns a gfx mesh id.
    int createMeshSkinnedPBR(const float* pos, uint32_t posCount, const float* nrm, uint32_t nrmCount,
                             const float* uv, uint32_t uvCount, const float* tan, uint32_t tanCount,
                             const uint32_t* joints, const float* weights,
                             const void* indices, uint32_t indexCount, bool index32);
    // Draw a skinned mesh with a bone palette (`boneCount` column-major mat4, world space)
    // and mesh world matrix. Uses the skinned PBR program.
    void drawMeshSkinnedPBR(int meshId, const float worldMatrix[16],
                            const float* bonePalette, int boneCount, const PbrDraw& mat);

    // ---- Morph targets (CPU morph -> dynamic vertex buffer) ----
    // Create a morph-capable PBR mesh (optionally skinned). `dPos`/`dNrm` hold per-target
    // position/normal deltas (targetCount * numVerts * 3 floats, target-major); `dNrm` may
    // be null. The vertex buffer is dynamic and rebuilt each frame from base + Σ weight·delta.
    int createMeshMorphPBR(const float* pos, uint32_t posCount, const float* nrm, uint32_t nrmCount,
                           const float* uv, uint32_t uvCount, const float* tan, uint32_t tanCount,
                           const void* indices, uint32_t indexCount, bool index32,
                           const float* dPos, const float* dNrm, int targetCount);
    int createMeshMorphSkinnedPBR(const float* pos, uint32_t posCount, const float* nrm, uint32_t nrmCount,
                                  const float* uv, uint32_t uvCount, const float* tan, uint32_t tanCount,
                                  const uint32_t* joints, const float* weights,
                                  const void* indices, uint32_t indexCount, bool index32,
                                  const float* dPos, const float* dNrm, int targetCount);
    // Re-evaluate a morph mesh's vertices: pos/normal = base + Σ weights[t]·delta[t]; uploads
    // to the dynamic vertex buffer. `count` weights are applied (clamped to the target count).
    void updateMeshMorph(int meshId, const float* weights, int count);

    // ---- Image-based lighting (environment) ----
    // Create the prefiltered specular cubemap (RGBA16F, `numMips` mip levels, `faceSize`²).
    void createEnvironment(int faceSize, int numMips);
    // Upload one cubemap face/mip from RGBD-encoded RGBA8 pixels (decoded to linear HDR half).
    void uploadEnvFace(int mip, int face, int width, int height, const uint8_t* rgba8);
    // 9 pre-scaled SH irradiance coefficients (36 floats = 9 × vec4, rgb + pad).
    void setEnvironmentSH(const float* sh36);
    // Activate IBL with the given environment intensity + tonemap exposure, plus the
    // prefilter LOD-generation scale and contrast (image-processing) from the .env.
    void setEnvironmentParams(float intensity, float exposure, float lodScale, float contrast);

private:
    struct Mesh {
        bgfx::VertexBufferHandle vbh = BGFX_INVALID_HANDLE;
        bgfx::IndexBufferHandle ibh = BGFX_INVALID_HANDLE;
        // Morph targets: when set, the mesh draws from `dvbh` (a dynamic vertex buffer)
        // re-evaluated each frame as base + Σ weight·delta. `morphBase` is the interleaved
        // rest-pose buffer; position lives at float offset 0, normal at 3 (both layouts).
        bgfx::DynamicVertexBufferHandle dvbh = BGFX_INVALID_HANDLE;
        uint32_t stride = 0, numVerts = 0;
        int morphTargets = 0;
        std::vector<uint8_t> morphBase;            // numVerts * stride
        std::vector<float> morphDPos, morphDNrm;   // morphTargets * numVerts * 3
    };

    bgfx::ProgramHandle program_ = BGFX_INVALID_HANDLE;
    bgfx::VertexLayout layout_;
    std::vector<Mesh> meshes_;

    // Where to load compiled shader .bin files from (set before initialize()).
    std::string shadersDir_ = "shaders";
    // Read <shadersDir_>/<name> and create a bgfx shader; logs + returns invalid on failure.
    bgfx::ShaderHandle loadShader(const char* name);

    // PBR pipeline.
    bgfx::ProgramHandle pbrProgram_ = BGFX_INVALID_HANDLE;
    bgfx::VertexLayout pbrLayout_;
    // Skinned PBR pipeline (vs_skinned + fs_pbr).
    bgfx::ProgramHandle pbrSkinnedProgram_ = BGFX_INVALID_HANDLE;
    bgfx::VertexLayout pbrSkinnedLayout_;
    bgfx::UniformHandle uBones_ = BGFX_INVALID_HANDLE;
    static const int kMaxBones = 128;
    std::vector<bgfx::TextureHandle> textures_;
    bgfx::TextureHandle whiteTex_ = BGFX_INVALID_HANDLE;
    bgfx::TextureHandle flatNormalTex_ = BGFX_INVALID_HANDLE;
    bgfx::UniformHandle uBaseColorFactor_ = BGFX_INVALID_HANDLE;
    bgfx::UniformHandle uMrParams_ = BGFX_INVALID_HANDLE;
    bgfx::UniformHandle uEmissiveFactor_ = BGFX_INVALID_HANDLE;
    bgfx::UniformHandle uTexFlags_ = BGFX_INVALID_HANDLE;
    bgfx::UniformHandle uOccFlag_ = BGFX_INVALID_HANDLE;
    bgfx::UniformHandle uPbrLightDir_ = BGFX_INVALID_HANDLE;
    bgfx::UniformHandle uPbrLightColor_ = BGFX_INVALID_HANDLE;
    bgfx::UniformHandle uAmbientSky_ = BGFX_INVALID_HANDLE;
    bgfx::UniformHandle uAmbientGround_ = BGFX_INVALID_HANDLE;
    bgfx::UniformHandle sBaseColor_ = BGFX_INVALID_HANDLE;
    bgfx::UniformHandle sMetalRough_ = BGFX_INVALID_HANDLE;
    bgfx::UniformHandle sNormalTex_ = BGFX_INVALID_HANDLE;
    bgfx::UniformHandle sEmissive_ = BGFX_INVALID_HANDLE;
    bgfx::UniformHandle sOcclusion_ = BGFX_INVALID_HANDLE;
    // IBL / environment.
    bgfx::TextureHandle envCube_ = BGFX_INVALID_HANDLE;     // prefiltered specular cubemap
    bgfx::TextureHandle blackCube_ = BGFX_INVALID_HANDLE;   // 1x1 default when no env bound
    bgfx::UniformHandle sEnvSpecular_ = BGFX_INVALID_HANDLE;
    bgfx::UniformHandle uEnvParams_ = BGFX_INVALID_HANDLE;  // x=numMips,y=intensity,z=hasEnv,w=exposure
    bgfx::UniformHandle uEnvParams2_ = BGFX_INVALID_HANDLE; // x=lodGenerationScale,y=contrast
    bgfx::UniformHandle uEnvSH_ = BGFX_INVALID_HANDLE;      // 9 × vec4
    float envParams_[4] = { 1.0f, 1.0f, 0.0f, 1.0f };
    float envParams2_[4] = { 0.8f, 1.0f, 0.0f, 0.0f };     // lodGenerationScale, contrast
    float envSH_[36] = { 0 };
    float pbrLightDir_[4] = { 0, 1, 0, 0 };
    float pbrLightColor_[4] = { 1, 1, 1, 1 };
    float pbrAmbientSky_[4] = { 0.4f, 0.45f, 0.5f, 1 };
    float pbrAmbientGround_[4] = { 0.1f, 0.1f, 0.12f, 1 };

    // Ported Standard-material uniforms.
    bgfx::UniformHandle uLightDir_ = BGFX_INVALID_HANDLE;
    bgfx::UniformHandle uLightDiffuse_ = BGFX_INVALID_HANDLE;
    bgfx::UniformHandle uLightGround_ = BGFX_INVALID_HANDLE;
    bgfx::UniformHandle uDiffuseColor_ = BGFX_INVALID_HANDLE;
    bgfx::UniformHandle uSpecular_ = BGFX_INVALID_HANDLE;
    bgfx::UniformHandle uEyePos_ = BGFX_INVALID_HANDLE;

    float eyePos_[4] = { 0, 0, -5, 0 };
    uint32_t clearRgba_ = 0x202830ff;

    // Standard-material light + material uniform values (defaults = Phase-1 red cube).
    float mLightDir_[4] = { 0.0f, 1.0f, 0.0f, 0.0f };
    float mLightDiffuse_[4] = { 0.9f, 0.9f, 0.9f, 1.0f };
    float mLightGround_[4] = { 0.05f, 0.05f, 0.08f, 1.0f };
    float mDiffuse_[4] = { 0.85f, 0.20f, 0.20f, 1.0f };
    float mSpecular_[4] = { 1.0f, 1.0f, 1.0f, 64.0f };

    // Last applied camera matrices (column-major), kept for native frustum culling.
    float view_[16] = { 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1 };
    float proj_[16] = { 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1 };

    // Bind the ported Standard-material light/material uniforms for a draw.
    void bindStandardUniforms();

    // Camera intrinsics (applied with the live framebuffer aspect each frame).
    float camTarget_[3] = { 0, 0, 0 };
    float camFovYDeg_ = 60.0f;
    float camNear_ = 0.1f;
    float camFar_ = 100.0f;
    float aspect_ = 1.0f;
    void applyCamera();
};

} // namespace gfx
