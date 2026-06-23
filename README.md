# Babylon-Lite Native Layer (prototype)

A Dawn-free native host that runs JavaScript orchestration on top of a native
**bgfx** (Direct3D 11) renderer — the "JS orchestrates, C++ renders" seam
(Option C) described in `../.ai/babylon-lite-native-layer-approach.md`.

## What it does

- Boots a JavaScript engine through **Node-API (node-addon-api / `Napi::`)**, the
  same engine-abstraction Babylon Native uses. The engine is selected at build time
  via **JsRuntimeHost** (`-DJS_ENGINE=…`); on Windows it defaults to the **in-box
  Chakra** runtime (`chakrart.lib` → `C:\Windows\System32\Chakra.dll`), so the engine
  adds ~no size to the `.exe`.
- Creates a Win32 window and initialises **bgfx** on it (D3D11 backend), the same
  rendering library Babylon Native uses.
- Exposes a tiny native rendering seam to JS (`gfx.createMesh`, `gfx.setCamera`,
  `gfx.drawMesh`, `gfx.setClearColor`).
- Loads `js/cube.js`, which builds a cube (geometry + camera + a per-frame spin
  matrix, all in JS) and calls into `gfx.*` each frame. C++ owns the render loop
  and the GPU work.
- The cube is shaded with the **Standard material** shader **hand-ported from
  Babylon-Lite's WGSL** to bgfx `.sc` (`shaders/`), compiled to D3D11 bytecode by
  bgfx's `shaderc` at build time (no runtime WGSL translation, no Dawn). The compiled
  shaders ship as standalone `.bin` files in `shaders/` next to the exe (not embedded
  in the binary), loaded at startup from `<exeDir>/shaders/` — keeping the `.exe` small.

## Layout

```
CMakeLists.txt        bgfx + JsRuntimeHost(napi) via FetchContent; shaderc compiles shaders to standalone .bin files
src/
  main.cpp            window + bgfx init + native render loop + bench timer
  native_window.*     minimal Win32 window (reused from the webgpu sample)
  js/                 JS engine layer (Node-API host); engine swappable via JS_ENGINE
    js_host.*         Napi:: host (console, function binding, frame callback, microtask pump)
    napi_helpers.h    arg-coercion helpers for the native seam (CallbackInfo -> num/int/str/bytes)
  gfx.*               native rendering seam over bgfx (standard + PBR pipelines, textures)
  scene.*             native per-frame task-graph executor (animate→world→cull→draw)
  lite.*              native Babylon-Lite engine (scene/mesh/material/camera/light, render; data-driven seam)
  mathx.h             shared column-major matrix + frustum helpers
  third_party/        vendored stb_image (PNG/JPEG decode for textures)
shaders/
  vs_cube.sc / fs_cube.sc      Standard material (hemispheric), ported from WGSL
  vs_pbr.sc  / fs_pbr.sc       glTF metallic-roughness PBR (Cook-Torrance)
  varying.def.sc / varying_pbr.def.sc
js/
  lite/               thin Babylon-Lite API mirror, modular (mirrors Lite's package layout):
    index.js          bootstrap (shims + __bl_require + install public API)
    core.js math.js engine.js scene.js camera.js light.js mesh.js material.js
    loaders/gltf.js   JS glTF/GLB parser (mirrors loader-gltf) → __bl_* data seam
    loaders/environment.js (stub)
  lite-demo.js        consumer-style primitives scene (Phase 3)
  lite-boombox.js     scene1-style glTF PBR scene (Phase 4)
  cube.js / stress.js / main.js   Phase 0–2A demos
assets/
  BoomBox.glb         glTF model (downloaded from the Babylon playground CDN)
```

**Architecture split:** JS owns app logic + asset loading (glTF parsing mirrors
Babylon-Lite's `loader-gltf`); C++ owns the render loop + rendering commands (mesh/texture/
material creation + bgfx draw). No WebGPU; no cgltf.

## Build (Windows, x64)

Requires Visual Studio 2022, CMake, Ninja. From a *Developer* shell (or call
`vcvars64.bat` first):

```powershell
cmake -S . -B build -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build build --target app
```

The first configure clones bgfx (BabylonJS fork, pinned to Babylon Native's tag)
and JsRuntimeHost (for the Node-API `napi` target — same commit Babylon Native pins).
The first build also compiles bgfx's `shaderc` (slow, one-time).

### JS engine selection

The native seam is written against **Node-API (`Napi::`)**, so the JavaScript engine
is chosen at build time (exactly like Babylon Native):

```powershell
cmake -S . -B build -G Ninja -DCMAKE_BUILD_TYPE=Release -DJS_ENGINE=Chakra
```

`JS_ENGINE` maps to JsRuntimeHost's `NAPI_JAVASCRIPT_ENGINE`. On Windows it defaults
to **Chakra**, which links the in-box `Chakra.dll` via `chakrart.lib` (nothing extra
to ship, and the engine is *not* statically linked into the `.exe`). Note the in-box
Chakra is frozen at ~ES2017, so the host installs a small `globalThis` shim; the
Babylon-Lite JS here avoids ES2019+ syntax (no `?.` / `??`).

## Run

```powershell
# Interactive window:
build/bin/app.exe

# Headless verification (render N frames, capture a TGA near the end):
build/bin/app.exe --frames 30 --width 480 --height 360 --screenshot out.tga

# Other flags: --script <path>  --warp (D3D11 software adapter)
```

The screenshot TGA is top-origin/BGRA; load it directly (do **not** vertically
flip) to view it right-side up.

**Runtime files:** the app loads its compiled shaders from `<exeDir>/shaders/*.bin`
(produced by the build into `build/bin/shaders/`), and the `js/` + `assets/` folders
are staged next to the exe. When deploying, ship `app.exe` together with its
`shaders/`, `js/`, and `assets/` folders.

## Size-optimized build

For the smallest `.exe`, configure a separate build dir with link-time optimization
and a D3D11-only bgfx:

```powershell
cmake -S . -B build-min -G Ninja -DCMAKE_BUILD_TYPE=MinSizeRel -DMINIMIZE_SIZE=ON
cmake --build build-min --target app
```

Compiled shaders are emitted as standalone `.bin` files rather than embedded C arrays,
so the shader bytecode lives outside the binary.

### `app.exe` size by JS engine (Release / size-opt)

| JS engine | Release | MinSizeRel + `MINIMIZE_SIZE` |
|---|---|---|
| QuickJS (static, prior) | 1.54 MB | 1.18 MB |
| **Chakra (in-box, Node-API)** | **0.80 MB** | **0.67 MB** |

Chakra nearly halves the binary because the engine is the OS-provided DLL instead of
~0.7 MB of statically-linked engine code. See `../.ai/phase6-napi-engine-abstraction.md`.

## Status

- **Phase 0** — Dawn-free harness (window + bgfx/D3D11 + QuickJS driving the
  loop). ✅
- **Phase 1** — lit, spinning cube via the native seam + ported Standard shader. ✅
- **Phase 2A** — native per-frame **task-graph executor** (scene walk → world
  matrices → cull → draw) that JS hands off to, with a JS-per-frame baseline for
  comparison. ✅ Measured ~75–90× faster scene traversal in native vs QuickJS — see
  `../.ai/phase2a-native-task-graph.md`.
- **Phase 3** — **Babylon-Lite API mirror**: a thin JS layer exposing the same
  `@babylonjs/lite` API, backed entirely by the native C++/bgfx engine. Consumers write
  ordinary Babylon-Lite web code; it renders natively, no WebGPU. ✅ See
  `../.ai/phase3-babylon-lite-api-mirror.md`.
- **Phase 4** — **glTF loading + PBR materials**: native glTF/GLB loader (cgltf) +
  metallic-roughness PBR + textures (stb_image), rendering the scene1 BoomBox via the
  same thin API. ✅ (IBL/tone-mapping for strict parity is the next step.) See
  `../.ai/phase4-gltf-pbr.md`.
- **Phase 5** — moved glTF parsing into JS (mirroring Babylon-Lite's `loader-gltf`,
  cgltf removed) and split the thin JS layer into per-concern modules. ✅
- **Phase 6** — **JS engine abstraction via Node-API**: the seam now targets
  node-addon-api (`Napi::`) instead of a specific engine, with the engine chosen at
  build time through JsRuntimeHost (`JS_ENGINE`). Default Windows engine switched from
  static QuickJS to the in-box **Chakra** (−43–48% `.exe`). ✅ See
  `../.ai/phase6-napi-engine-abstraction.md`.

## Phase 4: glTF + PBR (BoomBox)

```powershell
# Load + render a glTF PBR model (BoomBox) through the native engine:
build/bin/app.exe --prelude js/lite/index.js --script js/lite-boombox.js
# headless: add --frames 12 --screenshot out.tga
```

## Phase 3: Babylon-Lite API mirror (the headline feature)

`js/lite/index.js` mirrors the public Babylon-Lite API as a **thin** JS proxy layer;
`src/lite.{h,cpp}` is the native engine (scene graph, hierarchy, materials, camera,
light, geometry, traversal, culling, draw). `js/lite-demo.js` is consumer-style code
that looks exactly like a Babylon-Lite web scene.

```powershell
# Render a Babylon-Lite-style scene through the native engine:
build/bin/app.exe --prelude js/lite/index.js --script js/lite-demo.js
# headless: add --frames 6 --screenshot out.tga
```

## Phase 2A: task-graph stress benchmark

`js/stress.js` builds a grid of spinning cubes and runs the per-frame work either in
the **native** task-graph executor (`src/scene.{h,cpp}`) or in **JS** (the no-JIT
baseline). Both render identically; only where the CPU scene-walk runs differs.

```powershell
# 6400 cubes, 200 frames, uncapped — prints a BENCH line (cpu_traverse_ms, avg_ms, fps):
build/bin/app.exe --script js/stress.js --cpu native --grid 80 --frames 200
build/bin/app.exe --script js/stress.js --cpu js     --grid 80 --frames 200
```

| Flag | Meaning |
|------|---------|
| `--cpu js\|native` | where per-frame CPU work runs (default native) |
| `--grid N` | grid dimension (N×N cubes) |
| `--frames N` | run N frames then print BENCH (implies no-vsync) |
| `--bench` | force the BENCH line |
