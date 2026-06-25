cmake_minimum_required(VERSION 3.20)

project(BabylonLiteNativeLayer C CXX)

set(CMAKE_CXX_STANDARD 20)  # bx/bgfx require C++20
set(CMAKE_CXX_STANDARD_REQUIRED ON)

if(NOT WIN32)
    message(FATAL_ERROR "Babylon-Lite-Native-Layer prototype currently targets Windows (D3D11) only.")
endif()

# ---------------------------------------------------------------------------
# Optional aggressive size optimization (cmake -DMINIMIZE_SIZE=ON). Applies LTO
# (whole-program dead-code elimination), /Os, function/data-level linking +
# dead-strip, and trims bgfx to the D3D11 backend only. Set BEFORE FetchContent so
# the bgfx/napi targets inherit it.
# ---------------------------------------------------------------------------
option(MINIMIZE_SIZE "Aggressively optimize for binary size" OFF)
if(MINIMIZE_SIZE)
    cmake_policy(SET CMP0069 NEW)
    set(CMAKE_POLICY_DEFAULT_CMP0069 NEW)
    set(CMAKE_INTERPROCEDURAL_OPTIMIZATION ON)
    if(MSVC)
        add_compile_options(/Os /Gy /Gw)
        add_link_options(/OPT:REF /OPT:ICF)
    endif()
endif()

include(FetchContent)

# ---------------------------------------------------------------------------
# bgfx (BabylonJS fork, pinned to the same tag Babylon Native uses so we render
# "the same way Babylon Native does"). D3D11 backend.
# ---------------------------------------------------------------------------
set(BGFX_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(BGFX_BUILD_TOOLS ON CACHE BOOL "" FORCE)              # need shaderc to compile .sc shaders
set(BGFX_BUILD_TOOLS_SHADER ON CACHE BOOL "" FORCE)
set(BGFX_BUILD_TOOLS_GEOMETRY OFF CACHE BOOL "" FORCE)
set(BGFX_BUILD_TOOLS_TEXTURE OFF CACHE BOOL "" FORCE)
set(BGFX_BUILD_TOOLS_BIN2C ON CACHE BOOL "" FORCE)
set(BGFX_CONFIG_MULTITHREADED ON CACHE BOOL "" FORCE)
set(BGFX_CUSTOM_TARGETS OFF CACHE BOOL "" FORCE)
set(BGFX_INSTALL OFF CACHE BOOL "" FORCE)
set(BGFX_USE_DEBUG_SUFFIX OFF CACHE BOOL "" FORCE)

FetchContent_Declare(bgfx_cmake
    GIT_REPOSITORY https://github.com/BabylonJS/bgfx.cmake.git
    GIT_TAG be578c80f6c1c1e4d2b5baa163bd452f1d3b88fa)
FetchContent_MakeAvailable(bgfx_cmake)

# Force the D3D11 renderer on (mirrors BabylonNative/Dependencies/CMakeLists.txt).
target_compile_definitions(bgfx PRIVATE BGFX_CONFIG_RENDERER_DIRECT3D11=1)

# Size build: compile ONLY the D3D11 renderer into bgfx (drop GL/GLES/D3D12/Vulkan/
# Metal/WebGPU/etc. code paths entirely).
if(MINIMIZE_SIZE)
    target_compile_definitions(bgfx PRIVATE
        BGFX_CONFIG_RENDERER_OPENGL=0
        BGFX_CONFIG_RENDERER_OPENGLES=0
        BGFX_CONFIG_RENDERER_DIRECT3D9=0
        BGFX_CONFIG_RENDERER_DIRECT3D12=0
        BGFX_CONFIG_RENDERER_VULKAN=0
        BGFX_CONFIG_RENDERER_METAL=0
        BGFX_CONFIG_RENDERER_WEBGPU=0
        BGFX_CONFIG_RENDERER_GNM=0
        BGFX_CONFIG_RENDERER_NVN=0
        BGFX_CONFIG_RENDERER_AGC=0)
endif()

# ---------------------------------------------------------------------------
# JS engine via Node-API (node-addon-api). The native seam is written against the
# engine-agnostic Napi:: API, so the engine is swapped at build time exactly like
# Babylon Native. JsRuntimeHost provides the Node-API implementation per engine.
#   -DJS_ENGINE=Chakra  (Windows in-box engine, linked via chakrart.lib → Chakra.dll)
#
# Optional browser-like polyfills (JsRuntimeHost), each a separate static library
# toggled at configure time — the same model Babylon Native uses. Both default ON so
# the standard build can download remote assets over HTTP (turn OFF for a minimal
# napi-only build, e.g. size experiments):
#   -DBL_POLYFILL_URL=ON             URL / URLSearchParams
#   -DBL_POLYFILL_XMLHTTPREQUEST=ON  XMLHttpRequest (HTTP; pulls UrlLib + arcana)
# When any polyfill is enabled we pull the full JsRuntimeHost root (so JsRuntime +
# the polyfills build); otherwise we pull ONLY its `napi` target to stay minimal.
# ---------------------------------------------------------------------------
option(BL_POLYFILL_URL "Include the JsRuntimeHost URL/URLSearchParams polyfill" ON)
option(BL_POLYFILL_XMLHTTPREQUEST "Include the JsRuntimeHost XMLHttpRequest polyfill (HTTP downloads; pulls UrlLib)" ON)

set(JS_ENGINE "Chakra" CACHE STRING "JavaScript engine for the Node-API host (Chakra)")
set(NAPI_JAVASCRIPT_ENGINE "${JS_ENGINE}" CACHE STRING "" FORCE)
set(NAPI_BUILD_ABI ON CACHE BOOL "" FORCE)  # compile the engine's Node-API impl from source

set(_BL_POLYFILLS OFF)
if(BL_POLYFILL_URL OR BL_POLYFILL_XMLHTTPREQUEST)
    set(_BL_POLYFILLS ON)
endif()

if(_BL_POLYFILLS)
    # Pull the full JsRuntimeHost root: builds Core (napi + napi-extensions + Foundation +
    # JsRuntime) and the selected polyfills. Disable everything we don't use to stay lean.
    set(JSRUNTIMEHOST_TESTS OFF CACHE BOOL "" FORCE)
    set(JSRUNTIMEHOST_CORE_APPRUNTIME OFF CACHE BOOL "" FORCE)
    set(JSRUNTIMEHOST_CORE_SCRIPTLOADER OFF CACHE BOOL "" FORCE)
    set(JSRUNTIMEHOST_POLYFILL_CONSOLE OFF CACHE BOOL "" FORCE)
    set(JSRUNTIMEHOST_POLYFILL_SCHEDULING OFF CACHE BOOL "" FORCE)
    set(JSRUNTIMEHOST_POLYFILL_ABORT_CONTROLLER OFF CACHE BOOL "" FORCE)
    set(JSRUNTIMEHOST_POLYFILL_WEBSOCKET OFF CACHE BOOL "" FORCE)
    set(JSRUNTIMEHOST_POLYFILL_BLOB OFF CACHE BOOL "" FORCE)
    set(JSRUNTIMEHOST_POLYFILL_PERFORMANCE OFF CACHE BOOL "" FORCE)
    set(JSRUNTIMEHOST_POLYFILL_TEXTDECODER OFF CACHE BOOL "" FORCE)
    if(BL_POLYFILL_URL)
        set(JSRUNTIMEHOST_POLYFILL_URL ON CACHE BOOL "" FORCE)
    else()
        set(JSRUNTIMEHOST_POLYFILL_URL OFF CACHE BOOL "" FORCE)
    endif()
    if(BL_POLYFILL_XMLHTTPREQUEST)
        set(JSRUNTIMEHOST_POLYFILL_XMLHTTPREQUEST ON CACHE BOOL "" FORCE)
    else()
        set(JSRUNTIMEHOST_POLYFILL_XMLHTTPREQUEST OFF CACHE BOOL "" FORCE)
    endif()
    FetchContent_Declare(jsRuntimeHost
        GIT_REPOSITORY https://github.com/BabylonJS/JsRuntimeHost.git
        GIT_TAG 808601482588b7f806d91231288310b94766dc84)      # same commit Babylon Native pins
else()
    # Minimal: pull ONLY the `napi` target (SOURCE_SUBDIR Core/Node-API), not the heavy root.
    FetchContent_Declare(jsRuntimeHost
        GIT_REPOSITORY https://github.com/BabylonJS/JsRuntimeHost.git
        GIT_TAG 808601482588b7f806d91231288310b94766dc84
        SOURCE_SUBDIR Core/Node-API)
endif()
FetchContent_MakeAvailable(jsRuntimeHost)

# node-addon-api requires exactly one exception mode to be selected. PUBLIC so it
# (and the napi include dirs + chakrart.lib) propagate to everything linking napi.
target_compile_definitions(napi PUBLIC NAPI_CPP_EXCEPTIONS)

# ---------------------------------------------------------------------------
# Shaders → standalone bgfx binaries loaded at runtime (NOT embedded in the exe,
# to keep the binary small). shaderc emits raw .bin for the s_5_0 (dx11) profile
# straight into bin/shaders/ next to the executable.
# ---------------------------------------------------------------------------
set(SHADER_OUT_DIR "${CMAKE_BINARY_DIR}/bin/shaders")
file(MAKE_DIRECTORY "${SHADER_OUT_DIR}")
set(BGFX_SHADER_INCLUDE "${bgfx_cmake_SOURCE_DIR}/bgfx/src")
set(SHADER_DIR "${CMAKE_CURRENT_SOURCE_DIR}/shaders")
set(SHADER_BINS "")

function(compile_shader_bin STAGE SRC VARYING OUTNAME)
    set(OUT "${SHADER_OUT_DIR}/${OUTNAME}")
    add_custom_command(
        OUTPUT "${OUT}"
        COMMAND $<TARGET_FILE:shaderc>
            -f "${SHADER_DIR}/${SRC}"
            -o "${OUT}"
            --type ${STAGE}
            --platform windows
            -p s_5_0 -O 3
            --varyingdef "${SHADER_DIR}/${VARYING}"
            -i "${BGFX_SHADER_INCLUDE}"
        DEPENDS "${SHADER_DIR}/${SRC}" "${SHADER_DIR}/${VARYING}" shaderc
        COMMENT "shaderc ${SRC} -> shaders/${OUTNAME} (dx11)"
        VERBATIM)
    set(SHADER_BINS "${SHADER_BINS};${OUT}" PARENT_SCOPE)
endfunction()

compile_shader_bin(vertex   vs_cube.sc varying.def.sc     vs_cube.bin)
compile_shader_bin(fragment fs_cube.sc varying.def.sc     fs_cube.bin)
compile_shader_bin(vertex   vs_pbr.sc  varying_pbr.def.sc vs_pbr.bin)
compile_shader_bin(fragment fs_pbr.sc  varying_pbr.def.sc fs_pbr.bin)
compile_shader_bin(vertex   vs_skinned.sc varying_skinned.def.sc vs_skinned.bin)
add_custom_target(shaders ALL DEPENDS ${SHADER_BINS})

# ---------------------------------------------------------------------------
# app
# ---------------------------------------------------------------------------
add_executable(app
    src/main.cpp
    src/native_window.cpp
    src/js/js_host.cpp
    src/gfx.cpp
    src/scene.cpp
    src/lite.cpp
    src/bench.cpp
    src/third_party/impl.cpp)
add_dependencies(app shaders)

target_include_directories(app PRIVATE src src/js src/third_party)
target_link_libraries(app PRIVATE bgfx bx bimg napi)
target_compile_definitions(app PRIVATE NOMINMAX WIN32_LEAN_AND_MEAN
    BL_JS_ENGINE="${JS_ENGINE}")

# Optional polyfill static libraries (JsRuntimeHost). Each links JsRuntime transitively;
# the host (src/js/js_host.cpp) gates its Initialize() calls on the same macros.
if(BL_POLYFILL_URL)
    target_link_libraries(app PRIVATE URL)
    target_compile_definitions(app PRIVATE BL_POLYFILL_URL)
endif()
if(BL_POLYFILL_XMLHTTPREQUEST)
    target_link_libraries(app PRIVATE XMLHttpRequest)
    target_compile_definitions(app PRIVATE BL_POLYFILL_XMLHTTPREQUEST)
endif()

set_target_properties(app PROPERTIES
    RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/bin")

# ---------------------------------------------------------------------------
# JavaScript: bundle the TypeScript scenes into self-contained JS and stage them
# (+ assets) next to the executable.
#
# The `js/` folder is a TypeScript project (the Babylon-Lite API mirror + scene entry
# points). `node js/build.mjs` bundles each scene with esbuild — tree-shaking the mirror
# down to just what the scene uses + minifying — into `js/dist/<name>.js` (and the parity
# tests into `js/dist/tests/`). Each output is a SELF-CONTAINED classic script the host
# loads standalone (no separate prelude). The bundles are then copied to `bin/js/`.
# ---------------------------------------------------------------------------
set_target_properties(app PROPERTIES
    RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/bin")

find_program(NODE_EXECUTABLE NAMES node)
find_program(NPM_EXECUTABLE NAMES npm npm.cmd)
set(JS_DIR "${CMAKE_CURRENT_SOURCE_DIR}/js")

# Stage assets next to the exe (if present).
if(EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/assets")
    add_custom_target(stage_assets ALL
        COMMAND ${CMAKE_COMMAND} -E copy_directory
            "${CMAKE_CURRENT_SOURCE_DIR}/assets" "${CMAKE_BINARY_DIR}/bin/assets"
        COMMENT "Staging assets/ next to app.exe")
    add_dependencies(stage_assets app)
endif()

if(NODE_EXECUTABLE)
    # Install the bundler's dev dependency (esbuild) once, at configure time, if missing.
    if(NOT EXISTS "${JS_DIR}/node_modules" AND NPM_EXECUTABLE)
        message(STATUS "Installing JS bundler dependencies (npm install in js/)...")
        execute_process(COMMAND "${NPM_EXECUTABLE}" install --no-audit --no-fund
            WORKING_DIRECTORY "${JS_DIR}" RESULT_VARIABLE _npm_res)
        if(NOT _npm_res EQUAL 0)
            message(WARNING "npm install failed (${_npm_res}); scene bundles may not build.")
        endif()
    endif()
    # Bundle every build (esbuild is fast) so the staged JS stays in sync with TS edits,
    # then copy the bundles next to the exe. No byproducts → runs on every `cmake --build`.
    add_custom_target(js_bundles ALL
        COMMAND "${NODE_EXECUTABLE}" "${JS_DIR}/build.mjs"
        COMMAND ${CMAKE_COMMAND} -E copy_directory "${JS_DIR}/dist" "${CMAKE_BINARY_DIR}/bin/js"
        COMMAND ${CMAKE_COMMAND} -E copy_directory "${JS_DIR}/legacy" "${CMAKE_BINARY_DIR}/bin/js/legacy"
        WORKING_DIRECTORY "${JS_DIR}"
        COMMENT "Bundling TypeScript scenes (esbuild) → bin/js")
    add_dependencies(js_bundles app)
else()
    message(WARNING "node not found: skipping TypeScript scene bundling. Install Node.js "
                    "and re-configure, or run `node js/build.mjs` manually, to produce bin/js.")
endif()
