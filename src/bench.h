// FrameTimer — per-frame wall-time collector for benchmark mode.
//
// Mirrors the methodology of the DawnTest sample's src/framework/bench.{h,cpp}
// (E:\...\Samples\webgpu-cross-platform-app) so our numbers are directly comparable
// with Cedric's runner: the BENCH line uses the same keys + format, the first frame is
// excluded as warmup (shader/PSO compile + first asset upload), and stats are min / avg
// / max / p95 over the post-warmup per-frame deltas. cpu_ms (process kernel+user time)
// and mem_peak_bytes (peak working set) are reported for cross-engine CPU/memory
// comparison. Not thread-safe; call start/endFrame on the render thread.

#pragma once

#include <cstddef>
#include <cstdint>
#include <string>
#include <vector>

namespace bench {

struct FrameStats {
    int    frameCount = 0;   // frames included in the stats (excludes warmup)
    double wallMs = 0;       // sum of all included per-frame deltas, ms
    double minMs = 0;
    double avgMs = 0;
    double maxMs = 0;
    double p95Ms = 0;
};

class FrameTimer {
public:
    // The first `warmupFrames` rendered frames are excluded from the stats (default 1).
    void setWarmupFrames(int n);
    void reserve(size_t n);

    void startFrame();   // call once per frame, before per-frame work begins
    void endFrame();     // records elapsed ms since startFrame() if past warmup

    FrameStats finish() const;

    // Emit one machine-readable line to stdout, parsed by tools/bench/run-bench.mjs:
    //   BENCH scene=<name> frames=<N> wall_ms=<X> min_ms=<X> avg_ms=<X> max_ms=<X>
    //         p95_ms=<X> cpu_ms=<X> mem_peak_bytes=<N> [extra k=v ...]
    // `extra` is appended verbatim (e.g. "engine=Chakra gfx=D3D11 fps=...").
    void printBenchLine(const std::string& sceneName, const std::string& extra = "") const;

private:
    int                 m_warmupFrames = 1;
    int                 m_seenFrames = 0;
    double              m_startMs = 0;
    std::vector<double> m_deltas;
};

double   monotonicMillis();
double   processCpuMillis();      // total kernel+user CPU time, ms (0 if unavailable)
uint64_t peakWorkingSetBytes();   // peak working set, bytes (0 if unavailable)

} // namespace bench
