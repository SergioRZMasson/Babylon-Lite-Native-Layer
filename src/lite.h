#pragma once

// Native Babylon-Lite engine (Phase 3). The public Babylon-Lite JS API is mirrored
// by a thin JS layer (js/lite/index.js) whose calls land here as __bl_* functions.
// All scene state — engine, scenes, meshes, hierarchy, materials, cameras, lights,
// geometry, traversal, culling and rendering — lives in C++ and renders via bgfx
// (reusing the gfx layer + the ported Standard-material shader).
//
// JS is reduced to: build the scene once, set properties, then startEngine(). The
// per-frame scene walk + draw runs natively (the S9 model from Phase 2A, now driven
// by a Babylon-Lite-shaped API instead of a bespoke one).

#include <cstdint>
#include <string>
#include <vector>

namespace js { class Host; }
namespace gfx { class Gfx; }

namespace lite {

struct Material {
    float diffuse[3] = { 1, 1, 1 };   // PBR: baseColor.rgb / Standard: diffuseColor
    float alpha = 1.0f;
    float specular[3] = { 1, 1, 1 };
    float specularPower = 64.0f;

    // PBR (glTF metallic-roughness) extension.
    bool isPbr = false;
    float metallic = 1.0f, roughness = 1.0f, occlusionStrength = 1.0f, alphaCutoff = 0.0f;
    float emissive[3] = { 0, 0, 0 };
    int texBase = -1, texMR = -1, texNormal = -1, texEmissive = -1, texOcclusion = -1;
};

struct Light {
    float dir[3] = { 0, 1, 0 };
    float intensity = 1.0f;
    float diffuse[3] = { 1, 1, 1 };
    float ground[3] = { 0, 0, 0 };
};

struct Camera {
    float alpha = 0.0f, beta = 1.0f, radius = 10.0f;
    float target[3] = { 0, 0, 0 };
    float fov = 0.8f;          // vertical FOV in radians (Babylon default)
    float nearPlane = 0.1f, farPlane = 1000.0f;
};

struct Mesh {
    int geomId = -1;           // gfx mesh handle (geometry)
    int materialId = -1;
    int parent = -1;
    bool pbr = false;          // uses the PBR program (pos/normal/uv/tangent geometry)
    bool hasBaseMatrix = false; // glTF nodes supply a baked local→world matrix (column-major)
    int node = -1;             // bound animation node (mesh world follows nodes_[node].world)
    int skin = -1;             // skin index for GPU skinning (-1 = not skinned)
    float baseMatrix[16] = { 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1 };
    float pos[3] = { 0, 0, 0 };
    float rot[3] = { 0, 0, 0 }; // euler radians (Babylon yaw-pitch-roll)
    float scale[3] = { 1, 1, 1 };
    float boundRadius = 1.0f;   // local bounding-sphere radius (pre-scale)
    std::vector<float> thin;    // 16 floats per thin-instance (optional)
    int thinCount = 0;
    float world[16] = { 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1 };
    bool worldDone = false;     // per-frame guard for parent-first composition
};

// A glTF scene-graph node: local TRS (rest pose, mutated by animation each frame) +
// parent link. World matrices are recomposed per frame; the root applies the Babylon
// RH→LH conversion (diag(-1,1,1)). Animation channels target nodes by index.
struct Node {
    int parent = -1;
    float t[3] = { 0, 0, 0 };
    float r[4] = { 0, 0, 0, 1 };   // quaternion (x,y,z,w)
    float s[3] = { 1, 1, 1 };
    float world[16] = { 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1 };
    bool worldDone = false;
};

// One animation sampler: keyframe times (input) + packed output values, interpolation.
struct AnimSampler {
    std::vector<float> input;   // keyframe times, seconds (sorted)
    std::vector<float> output;  // comp values per key (CUBICSPLINE packs in*3: a,v,b)
    int comp = 0;               // 3=translation/scale, 4=rotation quat, N=morph weights
    int interp = 0;             // 0=LINEAR, 1=STEP, 2=CUBICSPLINE
};

// One animation channel: which node + property the sampler drives.
struct AnimChannel {
    int node = -1;
    int path = 0;               // 0=translation, 1=rotation, 2=scale, 3=weights
    int sampler = -1;
};

// An animation clip (glTF animation) = AnimationGroup. Carries playback state.
struct AnimClip {
    std::string name;
    float fps = 60.0f;
    float duration = 0.0f;
    std::vector<AnimSampler> samplers;
    std::vector<AnimChannel> channels;
    float time = 0.0f;
    bool playing = false;
    bool loop = true;
    float speed = 1.0f;
};

// A glTF skin: joint nodes + inverse bind matrices. Bone palette per frame =
// invMeshWorld · jointWorld · IBM (computed natively, uploaded for GPU skinning).
struct Skin {
    std::vector<int> joints;    // node indices
    std::vector<float> ibm;     // 16 * joints.size()
    int meshNode = -1;          // node the skinned mesh is attached to (invMeshWorld source)
};

struct Scene {
    uint32_t clearRgba = 0x0d0f17ff;
    int cameraId = -1;
    int lightId = -1;           // v1: a single hemispheric light
    std::vector<int> meshIds;
    bool active = false;
};

class Engine {
public:
    void init(gfx::Gfx* g) { gfx_ = g; }
    void setAssetsDir(const char* d) { assetsDir_ = d ? d : ""; }
    void registerOn(js::Host& host);

    bool hasActiveScene() const { return activeScene_ >= 0; }
    int renderFrame(float timeSec); // returns draw calls; reads/sets gfx camera+light

    int lastDrawn() const { return lastDrawn_; }

private:
    void computeWorld(int meshId);
    void computeNodeWorld(int nodeIdx);   // recursive, root applies RH→LH (diag(-1,1,1))
    void updateAnimations(float dt);      // advance + sample active clips, write node TRS
    void sampleChannel(const AnimClip& clip, const AnimChannel& ch, float time, float* out4);

    gfx::Gfx* gfx_ = nullptr;
    std::vector<Material> materials_;
    std::vector<Light> lights_;
    std::vector<Camera> cameras_;
    std::vector<Mesh> meshes_;
    std::vector<Scene> scenes_;
    std::vector<Node> nodes_;
    std::vector<AnimClip> anims_;
    std::vector<Skin> skins_;
    std::vector<float> bonePalette_;      // scratch: 16 floats per joint, per draw
    int activeScene_ = -1;
    int lastDrawn_ = 0;
    float lastTimeSec_ = -1.0f;           // for per-frame dt (animation advance)
    std::string assetsDir_;
};

} // namespace lite
