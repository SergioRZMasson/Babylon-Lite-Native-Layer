#pragma once

// JS host for the Babylon-Lite Native Layer, written against Node-API
// (node-addon-api / Napi::) so the JavaScript engine is swapped at build time
// exactly like Babylon Native (see CMake JS_ENGINE / NAPI_JAVASCRIPT_ENGINE).
//
// Responsibilities (Option C seam):
//   - own the JS engine runtime/context + the Napi::Env attached to it
//   - expose console.* and let C++ register native functions on globalThis
//   - run a classic script file
//   - drive a per-frame JS callback from the native (C++) render loop
//   - pump the promise microtask (job) queue
//
// JS orchestrates; C++ (bgfx) renders. The native rendering functions are
// registered by the gfx/lite/scene layers via registerFunction().
//
// Only this translation unit is engine-aware (it bootstraps the engine and pumps
// its microtask queue). Everything else in the app uses the engine-agnostic Napi::
// value/type API, so the seam code is portable across engines (and into Babylon
// Native, which uses the same node-addon-api contract).

#include <functional>
#include <memory>
#include <mutex>
#include <queue>
#include <string>
#include <vector>

#include <napi/napi.h>

namespace js {

class Host {
public:
    // A native function callback: receives the JS call args, returns a JS value
    // (use info.Env().Undefined() for void).
    using NativeFn = std::function<Napi::Value(const Napi::CallbackInfo& info)>;

    Host() = default;
    ~Host();

    bool initialize();
    void shutdown();

    // Register `fn` as globalThis[name] (or on a nested namespace if name contains a
    // dot, e.g. "gfx.drawMesh" creates/uses a global `gfx` object).
    void registerFunction(const char* name, NativeFn fn);

    // Run a classic script (not an ES module). Returns false on error (logged).
    bool runScript(const std::string& source, const std::string& filename);
    bool runFile(const std::string& path);

    // The JS side calls setFrameCallback(fn) to register its per-frame function.
    // callFrame invokes it with (timeMs, frameNo). Returns false if it threw.
    bool callFrame(double timeMs, int frameNo);
    bool hasFrameCallback() const { return !frameCallback_.IsEmpty(); }

    // Drain the pending promise-continuation (microtask) queue.
    void pumpJobs();

    // Drain async completions (e.g. XHR/HTTP downloads) that polyfills dispatch from
    // background threads onto the JS thread. No-op unless a polyfill is enabled/active.
    void pumpDispatch();

    // True when the JsRuntime + polyfills (URL / XMLHttpRequest) were initialized, so the
    // bootstrap can pump the dispatch queue while async asset loads are in flight.
    bool polyfillsActive() const { return polyfillsActive_; }

    Napi::Env env() const { return env_; }

private:
    void installConsole();
    static Napi::Value trampoline(const Napi::CallbackInfo& info);

#if defined(BL_POLYFILL_URL) || defined(BL_POLYFILL_XMLHTTPREQUEST)
    void initializePolyfills();
    std::mutex dispatchMutex_;
    std::queue<std::function<void(Napi::Env)>> dispatchQueue_;  // async completions → JS thread
#endif
    bool polyfillsActive_ = false;

    void* runtime_ = nullptr;       // engine runtime handle (JsRuntimeHandle), opaque here
    Napi::Env env_{nullptr};        // napi_env attached to the engine's current context
    Napi::FunctionReference frameCallback_;
    std::vector<std::unique_ptr<NativeFn>> fns_;  // keep native callbacks alive for the env
    std::queue<void*> microtasks_;  // queued promise continuations (JsValueRef), opaque here
};

} // namespace js
