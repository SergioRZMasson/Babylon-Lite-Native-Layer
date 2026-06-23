#pragma once

// Native per-frame task-graph executor (Phase 2A / S9).
//
// Babylon-Lite does its per-frame CPU work in JS: walk the scene graph, compose
// local->world matrices (lazy, version-gated), cull, then record GPU work. Without
// a JIT (QuickJS/Chakra interpreter) that traversal is the suspected bottleneck.
//
// This Scene moves that per-frame CPU work to native C++. JS describes the scene
// ONCE (addNode/setParent), then calls scene.start(); after that the native
// executor runs four data-oriented tasks each frame over a struct-of-arrays node
// store, composing with the bgfx "frame graph" (the draw task):
//
//   Task 1  animate : local_i  = T(base) * R(spinAxis, phase + speed*t) * S(scale)
//   Task 2  world   : world_i  = parent<0 ? local_i : world[parent] * local_i
//   Task 3  cull    : visible_i = sphere(world_i.center, radius) inside frustum
//   Task 4  draw    : for visible_i -> bgfx submit (the GPU frame-graph bridge)
//
// The identical four tasks are also implemented in js/ for an apples-to-apples
// "per-frame CPU work in JS vs native" measurement.

#include <cstdint>
#include <vector>

namespace js { class Host; }
namespace gfx { class Gfx; }

namespace scene {

class Scene {
public:
    // Add a node. parent < 0 = root; a parent's index MUST be < the child's index
    // (callers add parents first) so the world task is a single parents-first pass.
    // Returns the new node index.
    int addNode(int meshId, int parent,
                float px, float py, float pz, float scale,
                float axisX, float axisY, float axisZ,
                float spinSpeed, float phase, float boundRadius);

    int nodeCount() const { return int(parent_.size()); }

    // Switch on native per-frame execution (JS stops doing per-frame work).
    void start() { started_ = true; }
    bool started() const { return started_; }

    // Run the four tasks for time `timeSec`. Returns the number of draw calls.
    // Reads the active camera/frustum from `g`.
    int executeFrame(gfx::Gfx& g, float timeSec);

    int lastVisible() const { return lastVisible_; }

    // Wall time (ms) of the last frame's animate+world+cull tasks (the per-frame CPU
    // scene-traversal work — excludes the GPU draw submission). This is the quantity
    // the S9 hypothesis is about: JS scene traversal without JIT vs native.
    double lastTraverseMs() const { return lastTraverseMs_; }

    // Expose scene.* on the JS host.
    void registerOn(js::Host& host);

private:
    void taskAnimate(float timeSec);
    void taskWorld();
    void taskCull(const float frustum[6][4]);
    int taskDraw(gfx::Gfx& g);

    // SoA node store.
    std::vector<int> parent_;
    std::vector<int> meshId_;
    std::vector<float> px_, py_, pz_;
    std::vector<float> scale_;
    std::vector<float> ax_, ay_, az_;     // normalized spin axis
    std::vector<float> spinSpeed_, phase_;
    std::vector<float> radius_;

    // Per-frame scratch (column-major 4x4, 16 floats per node).
    std::vector<float> local_;
    std::vector<float> world_;
    std::vector<uint8_t> visible_;

    bool started_ = false;
    int lastVisible_ = 0;
    double lastTraverseMs_ = 0.0;
};

} // namespace scene
