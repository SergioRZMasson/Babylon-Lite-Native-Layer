#pragma once

// Small helpers for reading arguments out of a Napi::CallbackInfo in the native
// seam (gfx/lite/scene). They mirror the QuickJS arg-coercion the seam used before
// the Node-API port (tolerant: out-of-range / wrong-type args fall back to a default).

#include <cstdint>
#include <string>

#include <napi/napi.h>

namespace js {

inline double argNum(const Napi::CallbackInfo& info, size_t i, double def = 0.0) {
    return (i < info.Length() && info[i].IsNumber()) ? info[i].As<Napi::Number>().DoubleValue() : def;
}

inline int argInt(const Napi::CallbackInfo& info, size_t i, int def = 0) {
    return (i < info.Length() && info[i].IsNumber()) ? info[i].As<Napi::Number>().Int32Value() : def;
}

inline std::string argStr(const Napi::CallbackInfo& info, size_t i, const char* def = "") {
    return (i < info.Length() && info[i].IsString()) ? info[i].As<Napi::String>().Utf8Value()
                                                     : std::string(def);
}

// Raw bytes (and byte length) backing a typed-array argument. Returns nullptr and
// sets *outLen = 0 if the argument is missing or not a typed array.
inline const uint8_t* argBytes(const Napi::CallbackInfo& info, size_t i, size_t* outLen) {
    *outLen = 0;
    if (i >= info.Length() || !info[i].IsTypedArray()) {
        return nullptr;
    }
    Napi::TypedArray ta = info[i].As<Napi::TypedArray>();
    Napi::ArrayBuffer ab = ta.ArrayBuffer();
    *outLen = ta.ByteLength();
    return static_cast<const uint8_t*>(ab.Data()) + ta.ByteOffset();
}

inline bool argIsUint32Array(const Napi::CallbackInfo& info, size_t i) {
    return i < info.Length() && info[i].IsTypedArray() &&
           info[i].As<Napi::TypedArray>().TypedArrayType() == napi_uint32_array;
}

} // namespace js
