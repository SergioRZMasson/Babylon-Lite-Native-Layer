#include "js_host.h"

// Edge-mode Chakra (chakra.dll / chakrart.lib), matching JsRuntimeHost's
// js_native_api_chakra.h. Without this the <jsrt.h> stub pulls the legacy IE11
// jsrt9 API (different JsCreateRuntime/JsCreateContext signatures).
#define USE_EDGEMODE_JSRT
#include <jsrt.h>

#include <napi/env.h>

#include <cstdio>
#include <fstream>
#include <sstream>

namespace js {

namespace {

// Chakra invokes this when a promise continuation (microtask) is queued. We stash
// the task (add-ref'd to survive GC) and drain it later in Host::pumpJobs().
void CALLBACK promiseContinuation(JsValueRef task, void* state) {
    auto* q = static_cast<std::queue<void*>*>(state);
    JsAddRef(task, nullptr);
    q->push(task);
}

// console.* implementation: stringify every argument and print to stderr.
Napi::Value consoleLog(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    std::string line;
    for (size_t i = 0; i < info.Length(); ++i) {
        if (i) {
            line += ' ';
        }
        std::string s;
        try {
            s = info[i].ToString().Utf8Value();
        } catch (const Napi::Error&) {
            s = "<unprintable>";
        }
        line += s;
    }
    std::fprintf(stderr, "%s\n", line.c_str());
    return env.Undefined();
}

void reportError(const char* where, const Napi::Error& e) {
    std::fprintf(stderr, "[js] exception in %s: %s\n", where, e.what());
    Napi::Value stack = e.Value().Get("stack");
    if (stack.IsString()) {
        std::fprintf(stderr, "%s\n", stack.As<Napi::String>().Utf8Value().c_str());
    }
}

} // namespace

Host::~Host() { shutdown(); }

bool Host::initialize() {
    JsRuntimeHandle runtime = JS_INVALID_RUNTIME_HANDLE;
    if (JsCreateRuntime(JsRuntimeAttributeNone, nullptr, &runtime) != JsNoError) {
        std::fprintf(stderr, "[js] JsCreateRuntime failed\n");
        return false;
    }
    runtime_ = runtime;

    JsContextRef context = JS_INVALID_REFERENCE;
    if (JsCreateContext(runtime, &context) != JsNoError) {
        std::fprintf(stderr, "[js] JsCreateContext failed\n");
        return false;
    }
    if (JsSetCurrentContext(context) != JsNoError) {
        std::fprintf(stderr, "[js] JsSetCurrentContext failed\n");
        return false;
    }
    JsSetPromiseContinuationCallback(&promiseContinuation, &microtasks_);

    env_ = Napi::Attach();
    // Legacy (in-box) Chakra predates ES2020's `globalThis`; the Babylon-Lite JS
    // modules rely on it (the __BL namespace, __bl_require, installed API). Point a
    // `globalThis` property at the global object so bare `globalThis` resolves.
    {
        Napi::HandleScope scope(env_);
        env_.Global().Set("globalThis", env_.Global());
    }
    installConsole();

    // setFrameCallback(fn): JS registers its per-frame function here.
    registerFunction("setFrameCallback", [this](const Napi::CallbackInfo& info) -> Napi::Value {
        if (info.Length() >= 1 && info[0].IsFunction()) {
            frameCallback_ = Napi::Persistent(info[0].As<Napi::Function>());
        }
        return info.Env().Undefined();
    });
    return true;
}

void Host::shutdown() {
    if (!runtime_) {
        return;
    }
    frameCallback_.Reset();
    while (!microtasks_.empty()) {
        JsRelease(static_cast<JsValueRef>(microtasks_.front()), nullptr);
        microtasks_.pop();
    }
    Napi::Detach(env_);
    env_ = Napi::Env(nullptr);
    JsSetCurrentContext(JS_INVALID_REFERENCE);
    JsDisposeRuntime(static_cast<JsRuntimeHandle>(runtime_));
    runtime_ = nullptr;
}

void Host::installConsole() {
    Napi::HandleScope scope(env_);
    Napi::Object console = Napi::Object::New(env_);
    Napi::Function logFn = Napi::Function::New(env_, &consoleLog, "log");
    console.Set("log", logFn);
    console.Set("info", logFn);
    console.Set("warn", logFn);
    console.Set("error", logFn);
    console.Set("debug", logFn);
    env_.Global().Set("console", console);
}

Napi::Value Host::trampoline(const Napi::CallbackInfo& info) {
    auto* fn = static_cast<NativeFn*>(info.Data());
    if (!fn) {
        return info.Env().Undefined();
    }
    return (*fn)(info);
}

void Host::registerFunction(const char* name, NativeFn fn) {
    fns_.push_back(std::make_unique<NativeFn>(std::move(fn)));
    NativeFn* ptr = fns_.back().get();

    Napi::HandleScope scope(env_);
    Napi::Function cfun = Napi::Function::New(env_, &Host::trampoline, name, ptr);

    Napi::Object global = env_.Global();
    const std::string n(name);
    const size_t dot = n.find('.');
    if (dot == std::string::npos) {
        global.Set(n, cfun);
        return;
    }
    const std::string ns = n.substr(0, dot);
    const std::string fnName = n.substr(dot + 1);
    Napi::Value existing = global.Get(ns);
    Napi::Object nsObj;
    if (existing.IsObject()) {
        nsObj = existing.As<Napi::Object>();
    } else {
        nsObj = Napi::Object::New(env_);
        global.Set(ns, nsObj);
    }
    nsObj.Set(fnName, cfun);
}

bool Host::runScript(const std::string& source, const std::string& filename) {
    bool ok = true;
    {
        Napi::HandleScope scope(env_);
        try {
            Napi::Eval(env_, source.c_str(), filename.c_str());
        } catch (const Napi::Error& e) {
            reportError(filename.c_str(), e);
            ok = false;
        }
    }
    pumpJobs();
    return ok;
}

bool Host::runFile(const std::string& path) {
    std::ifstream in(path, std::ios::binary);
    if (!in) {
        std::fprintf(stderr, "[js] cannot open script: %s\n", path.c_str());
        return false;
    }
    std::ostringstream ss;
    ss << in.rdbuf();
    return runScript(ss.str(), path);
}

bool Host::callFrame(double timeMs, int frameNo) {
    if (frameCallback_.IsEmpty()) {
        return true;
    }
    bool ok = true;
    {
        Napi::HandleScope scope(env_);
        try {
            frameCallback_.Call({ Napi::Number::New(env_, timeMs),
                                  Napi::Number::New(env_, frameNo) });
        } catch (const Napi::Error& e) {
            reportError("frame", e);
            ok = false;
        }
    }
    pumpJobs();
    return ok;
}

void Host::pumpJobs() {
    while (!microtasks_.empty()) {
        JsValueRef task = static_cast<JsValueRef>(microtasks_.front());
        microtasks_.pop();
        {
            Napi::HandleScope scope(env_);
            try {
                // napi_value and JsValueRef are bit-compatible in the Chakra Node-API
                // impl, so we can route the continuation through node-addon-api for
                // unified error handling.
                Napi::Function fn(env_, reinterpret_cast<napi_value>(task));
                fn.Call({});
            } catch (const Napi::Error& e) {
                std::fprintf(stderr, "[js] microtask exception: %s\n", e.what());
            }
        }
        JsRelease(task, nullptr);
    }
}

} // namespace js
