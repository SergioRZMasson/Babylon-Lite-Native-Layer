// main.cpp — Babylon-Lite Native Layer prototype.
//
// Phase 0/1: Dawn-free harness (Win32 window + bgfx/D3D11 + QuickJS) rendering a
// JS-orchestrated cube. Phase 2A: a native per-frame task-graph executor (scene
// walk -> world matrices -> cull -> draw) that JS hands off to, plus an
// equivalent JS-per-frame baseline for an apples-to-apples comparison.
//
// Flags:
//   --frames N        run N frames then exit (0 = run until window closed)
//   --screenshot PATH capture a TGA of the backbuffer shortly before exit
//   --width / --height
//   --warp            force the D3D11 WARP software adapter (no-GPU machines)
//   --script PATH     JS entry script (default js/cube.js)
//   --cpu js|native   where per-frame CPU work runs (default native); exposed to JS
//   --grid N          stress-scene grid dimension (exposed to JS as appGridSize())
//   --bench           print a BENCH frame-time line on exit (implied by --frames)

#include "native_window.h"

#include <bgfx/bgfx.h>
#include <bgfx/platform.h>
#include <bx/bx.h>

#include "js_host.h"
#include "napi_helpers.h"
#include "gfx.h"
#include "scene.h"
#include "lite.h"

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>

#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstdarg>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <filesystem>
#include <string>
#include <vector>

namespace fs = std::filesystem;

namespace {

constexpr int kInitialWidth = 1024;
constexpr int kInitialHeight = 768;

std::string executableDir() {
    wchar_t buf[1024];
    DWORD n = ::GetModuleFileNameW(nullptr, buf, 1024);
    if (n == 0) {
        return ".";
    }
    return fs::path(std::wstring(buf, n)).parent_path().string();
}

struct Args {
    int frames = 0;        // 0 = infinite
    int width = 0;
    int height = 0;
    bool warp = false;
    bool bench = false;
    int grid = 0;          // 0 = let the script choose
    std::string cpu = "native";
    std::string screenshotPath;
    std::string scriptPath;
    std::string preludePath;
};

Args parseArgs(int argc, char** argv) {
    Args a;
    for (int i = 1; i < argc; ++i) {
        std::string s = argv[i];
        if ((s == "--frames" || s == "--max-frames") && i + 1 < argc) {
            a.frames = std::atoi(argv[++i]);
            a.bench = true;
        } else if (s == "--width" && i + 1 < argc) {
            a.width = std::atoi(argv[++i]);
        } else if (s == "--height" && i + 1 < argc) {
            a.height = std::atoi(argv[++i]);
        } else if (s == "--warp") {
            a.warp = true;
        } else if (s == "--bench") {
            a.bench = true;
        } else if (s == "--cpu" && i + 1 < argc) {
            a.cpu = argv[++i];
        } else if (s == "--grid" && i + 1 < argc) {
            a.grid = std::atoi(argv[++i]);
        } else if (s == "--screenshot" && i + 1 < argc) {
            a.screenshotPath = argv[++i];
        } else if (s == "--script" && i + 1 < argc) {
            a.scriptPath = argv[++i];
        } else if (s == "--prelude" && i + 1 < argc) {
            a.preludePath = argv[++i];
        }
    }
    return a;
}

// Write a 32-bit uncompressed TGA (BGRA). Orientation handling is intentionally
// simple here (Phase 0 only renders a flat colour); it will be revisited when we
// render real geometry. `data` is BGRA8 with `pitch` bytes per row.
void writeTga(const char* path, uint32_t width, uint32_t height, uint32_t pitch, const void* data, bool topOrigin) {
    FILE* f = std::fopen(path, "wb");
    if (!f) {
        std::fprintf(stderr, "[gfx] screenshot: cannot open %s\n", path);
        return;
    }
    uint8_t header[18] = {};
    header[2] = 2; // uncompressed true-colour
    header[12] = uint8_t(width & 0xff);
    header[13] = uint8_t((width >> 8) & 0xff);
    header[14] = uint8_t(height & 0xff);
    header[15] = uint8_t((height >> 8) & 0xff);
    header[16] = 32;                      // bits per pixel
    header[17] = uint8_t(0x08 | (topOrigin ? 0x20 : 0x00)); // 8 alpha bits, origin
    std::fwrite(header, 1, sizeof(header), f);
    const uint8_t* base = static_cast<const uint8_t*>(data);
    for (uint32_t y = 0; y < height; ++y) {
        std::fwrite(base + size_t(y) * pitch, 1, size_t(width) * 4, f);
    }
    std::fclose(f);
    std::fprintf(stderr, "[gfx] screenshot written: %s (%ux%u)\n", path, width, height);
}

// bgfx callback: routes engine logs to stderr and saves requested screenshots.
struct BgfxCallback : public bgfx::CallbackI {
    ~BgfxCallback() override {}

    void fatal(const char* filePath, uint16_t line, bgfx::Fatal::Enum code, const char* str) override {
        std::fprintf(stderr, "[bgfx FATAL] %s(%u): code=%d %s\n", filePath, line, int(code), str);
        std::abort();
    }
    void traceVargs(const char* /*filePath*/, uint16_t /*line*/, const char* format, va_list argList) override {
        std::vfprintf(stderr, format, argList);
    }
    void profilerBegin(const char*, uint32_t, const char*, uint16_t) override {}
    void profilerBeginLiteral(const char*, uint32_t, const char*, uint16_t) override {}
    void profilerEnd() override {}
    uint32_t cacheReadSize(uint64_t) override { return 0; }
    bool cacheRead(uint64_t, void*, uint32_t) override { return false; }
    void cacheWrite(uint64_t, const void*, uint32_t) override {}
    void screenShot(const char* filePath, uint32_t width, uint32_t height, uint32_t pitch, bgfx::TextureFormat::Enum /*format*/, const void* data, uint32_t /*size*/, bool yflip) override {
        // bgfx passes yflip=true when the data origin is bottom-left. TGA with the
        // top-origin bit clear is bottom-up, so map accordingly. Backbuffer format
        // is BGRA8 on the D3D11 backend, which matches the TGA byte order.
        writeTga(filePath, width, height, pitch, data, /*topOrigin=*/!yflip);
    }
    void captureBegin(uint32_t, uint32_t, uint32_t, bgfx::TextureFormat::Enum, bool) override {}
    void captureEnd() override {}
    void captureFrame(const void*, uint32_t) override {}
};

// Per-frame wall-time collector for the BENCH line (first frame dropped as warmup).
struct FrameTimer {
    using clock = std::chrono::steady_clock;
    clock::time_point t0;
    std::vector<double> ms;
    void reserve(size_t n) { ms.reserve(n); }
    void startFrame() { t0 = clock::now(); }
    void endFrame() {
        const double d = std::chrono::duration<double, std::milli>(clock::now() - t0).count();
        ms.push_back(d);
    }
    void printBench(const char* scene, const char* cpu, int nodes, int visible, double cpuAvgMs) {
        if (ms.size() <= 1) {
            return;
        }
        std::vector<double> s(ms.begin() + 1, ms.end()); // drop warmup
        std::sort(s.begin(), s.end());
        double sum = 0;
        for (double v : s) { sum += v; }
        const double avg = sum / s.size();
        const double p95 = s[size_t(0.95 * (s.size() - 1))];
        std::fprintf(stderr,
            "BENCH scene=%s cpu=%s nodes=%d visible=%d frames=%zu wall_ms=%.1f min_ms=%.3f avg_ms=%.3f max_ms=%.3f p95_ms=%.3f cpu_traverse_ms=%.4f fps=%.1f\n",
            scene, cpu, nodes, visible, s.size(), sum, s.front(), avg, s.back(), p95, cpuAvgMs, 1000.0 / avg);
    }
};

} // namespace

int main(int argc, char** argv) {
    std::setvbuf(stderr, nullptr, _IONBF, 0);
    std::setvbuf(stdout, nullptr, _IONBF, 0);
    std::fprintf(stderr, "[main] Babylon-Lite Native Layer starting...\n");

    Args cli = parseArgs(argc, argv);
    int width = cli.width > 0 ? cli.width : kInitialWidth;
    int height = cli.height > 0 ? cli.height : kInitialHeight;

    native_window::Window window;
    if (!window.create(width, height, "Babylon Lite Native Layer")) {
        std::fprintf(stderr, "[main] window.create failed\n");
        return 1;
    }
    int fbW = 0, fbH = 0;
    window.getClientSize(fbW, fbH);
    if (fbW <= 0 || fbH <= 0) { fbW = width; fbH = height; }

    // bgfx single-threaded init on this window's HWND. Bench runs uncap the frame
    // rate (no vsync) so measured frame time reflects real CPU/GPU work, not refresh.
    const uint32_t resetFlags = cli.bench ? BGFX_RESET_NONE : BGFX_RESET_VSYNC;
    BgfxCallback callback;
    bgfx::Init init;
    init.type = bgfx::RendererType::Direct3D11;
    init.platformData.nwh = window.hwnd();
    init.resolution.width = uint32_t(fbW);
    init.resolution.height = uint32_t(fbH);
    init.resolution.reset = resetFlags;
    init.callback = &callback;
    if (cli.warp) {
        init.vendorId = BGFX_PCI_ID_SOFTWARE_RASTERIZER; // D3D11 WARP
    }
    if (!bgfx::init(init)) {
        std::fprintf(stderr, "[main] bgfx::init failed\n");
        return 1;
    }
    std::fprintf(stderr, "[main] bgfx renderer: %s\n", bgfx::getRendererName(bgfx::getRendererType()));

    // ---- Native rendering seam (bgfx) ----
    gfx::Gfx renderer;
    renderer.setShadersDir((fs::path(executableDir()) / "shaders").string().c_str());
    if (!renderer.initialize()) {
        std::fprintf(stderr, "[main] gfx init failed\n");
        return 1;
    }

    // ---- JavaScript host: JS orchestrates, C++ renders (Option C seam) ----
    js::Host host;
    if (!host.initialize()) {
        std::fprintf(stderr, "[main] JS host init failed\n");
        return 1;
    }
    renderer.registerOn(host);

    // ---- Native per-frame task-graph executor (Phase 2A / S9) ----
    scene::Scene world;
    world.registerOn(host);

    // ---- Native Babylon-Lite engine (Phase 3): thin JS API → C++ scene + bgfx ----
    lite::Engine lite;
    lite.init(&renderer);
    lite.setAssetsDir((fs::path(executableDir()) / "assets").string().c_str());
    lite.registerOn(host);

    // Expose the run mode + grid size to JS so the same scene script can either
    // hand off to the native executor or run the per-frame work in JS itself.
    const std::string cpuMode = cli.cpu;
    const int gridSize = cli.grid;
    host.registerFunction("appMode", [cpuMode](const Napi::CallbackInfo& info) -> Napi::Value {
        return Napi::String::New(info.Env(), cpuMode);
    });
    host.registerFunction("appGridSize", [gridSize](const Napi::CallbackInfo& info) -> Napi::Value {
        return Napi::Number::New(info.Env(), gridSize);
    });

    // High-resolution clock + a per-frame CPU-traversal time sink, so the JS-baseline
    // path can time its own scene walk and report it back for the BENCH comparison.
    std::vector<double> cpuMs;
    int jsNodeCount = 0;
    int jsVisible = 0;
    host.registerFunction("perfNow", [](const Napi::CallbackInfo& info) -> Napi::Value {
        const double ms = std::chrono::duration<double, std::milli>(
            std::chrono::steady_clock::now().time_since_epoch()).count();
        return Napi::Number::New(info.Env(), ms);
    });
    host.registerFunction("benchCpu", [&cpuMs, &jsVisible](const Napi::CallbackInfo& info) -> Napi::Value {
        cpuMs.push_back(js::argNum(info, 0, 0));
        jsVisible = js::argInt(info, 1, jsVisible);
        return info.Env().Undefined();
    });
    host.registerFunction("benchNodes", [&jsNodeCount](const Napi::CallbackInfo& info) -> Napi::Value {
        jsNodeCount = js::argInt(info, 0, jsNodeCount);
        return info.Env().Undefined();
    });

    // Optional prelude (e.g. the Babylon-Lite API mirror) loaded before the entry
    // script so the consumer script sees the installed globals. The prelude can pull
    // in sibling module files via __bl_require(relPath) (resolved against its dir).
    if (!cli.preludePath.empty()) {
        const std::string preludeDir = fs::path(cli.preludePath).parent_path().string();
        host.registerFunction("__bl_require", [&host, preludeDir](const Napi::CallbackInfo& info) -> Napi::Value {
            const std::string rel = js::argStr(info, 0);
            if (!rel.empty()) {
                const std::string full = (fs::path(preludeDir) / rel).string();
                if (!host.runFile(full)) {
                    std::fprintf(stderr, "[main] __bl_require failed: %s\n", full.c_str());
                }
            }
            return info.Env().Undefined();
        });
        std::fprintf(stderr, "[main] loading prelude: %s\n", cli.preludePath.c_str());
        if (!host.runFile(cli.preludePath)) {
            std::fprintf(stderr, "[main] prelude failed to load\n");
            return 1;
        }
    }

    std::string scriptPath = cli.scriptPath;
    if (scriptPath.empty()) {
        scriptPath = (fs::path(executableDir()) / "js" / "cube.js").string();
    }
    std::fprintf(stderr, "[main] loading script: %s (cpu=%s grid=%d)\n", scriptPath.c_str(), cli.cpu.c_str(), cli.grid);
    if (!host.runFile(scriptPath)) {
        std::fprintf(stderr, "[main] script failed to load\n");
        return 1;
    }
    host.pumpJobs(); // let the demo's async main() settle (registerScene/startEngine)

    bool resized = false;
    window.setResizeCallback([&](int w, int h) {
        if (w > 0 && h > 0) {
            fbW = w; fbH = h; resized = true;
        }
    });

    const bool liteActive = lite.hasActiveScene();
    const bool nativeScene = world.started();
    std::fprintf(stderr, "[main] entering render loop (frames=%d, mode=%s)...\n",
                 cli.frames, liteActive ? "lite-native" : (nativeScene ? "native-scene" : "js"));
    int frameNo = 0;
    bool screenshotRequested = false;
    int screenshotFrame = cli.frames > 0 ? (cli.frames - 2) : -1; // capture near the end

    FrameTimer timer;
    if (cli.frames > 0) { timer.reserve(size_t(cli.frames)); }

    while (window.pumpEvents()) {
        if (resized) {
            bgfx::reset(uint32_t(fbW), uint32_t(fbH), resetFlags);
            resized = false;
        }
        timer.startFrame();

        // Deterministic fixed timestep so the JS and native paths animate identically
        // (fair comparison + identical rendering for parity).
        const double timeMs = double(frameNo) * (1000.0 / 60.0);
        const float timeSec = float(frameNo) / 60.0f;

        renderer.beginFrame(fbW, fbH);
        if (liteActive) {
            // Babylon-Lite API mirror: native engine owns the whole frame (scene
            // walk → world matrices → cull → draw) from the JS-described scene.
            lite.renderFrame(timeSec);
        } else if (nativeScene) {
            // Native executor owns the per-frame CPU work; JS did its job at load time.
            world.executeFrame(renderer, timeSec);
            cpuMs.push_back(world.lastTraverseMs());
        } else {
            // JS owns the per-frame work (scene walk/update/cull) and submits via gfx.*.
            // It reports its own traversal time via benchCpu().
            host.callFrame(timeMs, frameNo);
        }

        if (!cli.screenshotPath.empty() && !screenshotRequested && screenshotFrame >= 0 && frameNo >= screenshotFrame) {
            bgfx::requestScreenShot(BGFX_INVALID_HANDLE, cli.screenshotPath.c_str());
            screenshotRequested = true;
            std::fprintf(stderr, "[main] screenshot requested at frame %d\n", frameNo);
        }

        bgfx::frame();
        timer.endFrame();
        ++frameNo;

        if (cli.frames > 0 && frameNo >= cli.frames) {
            std::fprintf(stderr, "[main] reached frame budget (%d)\n", cli.frames);
            break;
        }
    }

    std::fprintf(stderr, "[main] shutting down (rendered %d frames, visible=%d)\n", frameNo, world.lastVisible());
    if (cli.bench) {
        // Average per-frame CPU scene-traversal time (drop warmup frame).
        double cpuAvg = 0.0;
        if (cpuMs.size() > 1) {
            double sum = 0;
            for (size_t i = 1; i < cpuMs.size(); ++i) { sum += cpuMs[i]; }
            cpuAvg = sum / double(cpuMs.size() - 1);
        }
        const int nodes = nativeScene ? world.nodeCount() : jsNodeCount;
        const int vis = nativeScene ? world.lastVisible() : jsVisible;
        timer.printBench("stress", cli.cpu.c_str(), nodes, vis, cpuAvg);
    }
    host.shutdown();
    renderer.shutdown();
    bgfx::shutdown();
    window.destroy();
    return 0;
}
