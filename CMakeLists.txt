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
# Babylon Native. JsRuntimeHost provides the Node-API implementation per engine; we
# pull ONLY its `napi` target (SOURCE_SUBDIR Core/Node-API), not its heavy root.
#   -DJS_ENGINE=Chakra  (Windows in-box engine, linked via chakrart.lib → Chakra.dll)
# ---------------------------------------------------------------------------
set(JS_ENGINE "Chakra" CACHE STRING "JavaScript engine for the Node-API host (Chakra)")
set(NAPI_JAVASCRIPT_ENGINE "${JS_ENGINE}" CACHE STRING "" FORCE)
set(NAPI_BUILD_ABI ON CACHE BOOL "" FORCE)  # compile the engine's Node-API impl from source
FetchContent_Declare(jsRuntimeHost
    GIT_REPOSITORY https://github.com/BabylonJS/JsRuntimeHost.git
    GIT_TAG 808601482588b7f806d91231288310b94766dc84      # same commit Babylon Native pins
    SOURCE_SUBDIR Core/Node-API)
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

set_target_properties(app PROPERTIES
    RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/bin")

# Stage js/ (and assets/ if present) next to the executable. Use an ALL custom target
# with no byproducts so it re-runs on EVERY `cmake --build` — keeping the staged copy in
# sync even when only JS files changed (which doesn't relink the app). NOTE: pure JS
# edits still require re-running this (or just run the app from the project root, where
# js/ and assets/ are the live source).
set(STAGE_CMDS
    COMMAND ${CMAKE_COMMAND} -E copy_directory
        "${CMAKE_CURRENT_SOURCE_DIR}/js" "${CMAKE_BINARY_DIR}/bin/js")
if(EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/assets")
    list(APPEND STAGE_CMDS
        COMMAND ${CMAKE_COMMAND} -E copy_directory
            "${CMAKE_CURRENT_SOURCE_DIR}/assets" "${CMAKE_BINARY_DIR}/bin/assets")
endif()
add_custom_target(stage_runtime ALL ${STAGE_CMDS}
    COMMENT "Staging js/ + assets/ next to app.exe")
add_dependencies(stage_runtime app)
