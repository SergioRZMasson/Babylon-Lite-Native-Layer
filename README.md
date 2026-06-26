# Babylon-Lite Native Layer

A Dawn-free native Windows host that runs **Babylon-Lite** JavaScript on top of a native
**bgfx (Direct3D 12)** renderer: the JS owns app logic + glTF/asset loading and calls a thin
`__bl_*` native seam; C++ owns the render loop, scene traversal, and all GPU work. Consumers
write ordinary Babylon-Lite code (`import { ... } from "babylon-lite"`) and it renders
natively — no WebGPU.

## Prerequisites

- Windows x64, a GPU/driver with **Direct3D 12** (or D3D11 — selectable, see *Renderer backend*)
- **Visual Studio 2022**, **CMake**, **Ninja**
- **Node.js** (bundles the TypeScript scenes)

Run all commands from a **Developer PowerShell for VS 2022** (or after calling
`vcvars64.bat`) — the default V8 build requires the MSVC compiler.

## Build

Two commands build everything — C++ **and** the JS scene bundles:

```powershell
cmake -S . -B build -G Ninja -DCMAKE_BUILD_TYPE=Release   # configure (+ npm install in js/)
cmake --build build                                        # app.exe + shaders + JS bundles
```

The first configure fetches bgfx + JsRuntimeHost (and runs `npm install` in `js/`); the first
build also compiles bgfx's `shaderc` (slow, one-time). `cmake --build build` builds the
default target — the `app` exe, its `shaders`, and the `js_bundles` step (TypeScript →
`build/bin/js`). Build just the exe with `cmake --build build --target app`.

The default build is **V8 + Direct3D 12** (see below to change either). A fresh configure in a
Developer shell selects the MSVC compiler (`cl`), which V8 requires.

### JS engine

The native seam targets **Node-API (`Napi::`)**, so the JS engine is chosen at build time via
`-DJS_ENGINE=…` (mapped to JsRuntimeHost's `NAPI_JAVASCRIPT_ENGINE`):

- **V8** (default) — JIT, used for the performance benchmark. **Requires the MSVC compiler**
  (`cl`); the V8 NuGet's arch detection rejects clang, so configure fails fast with a clear
  message if a non-MSVC compiler is selected. Build from a Developer PowerShell (cl is picked
  automatically) or pass `-DCMAKE_C_COMPILER=cl -DCMAKE_CXX_COMPILER=cl`. The build stages the
  V8 redist (`v8.dll` + `icudtl.dat` + helpers) next to `app.exe` automatically.
- **Chakra** — the in-box `Chakra.dll`; nothing extra to ship, smallest `.exe`, and builds with
  any compiler (clang included). Frozen at ~ES2017 (the scene bundles target ES2017 to match).

```powershell
cmake -S . -B build -G Ninja -DCMAKE_BUILD_TYPE=Release -DJS_ENGINE=Chakra
```

### Renderer backend

A single bgfx backend is compiled in per build (smaller binary), selected at configure time:

```powershell
cmake -S . -B build -G Ninja -DCMAKE_BUILD_TYPE=Release -DBL_RENDERER=D3D11   # or D3D12 (default)
```

The app inits the matching `bgfx::RendererType` at runtime. Both backends use the same DXBC
(`s_5_0`) shaders, so no shader change is needed.

### Polyfills (HTTP asset loading)

JsRuntimeHost's **URL** + **XMLHttpRequest** polyfills are linked by default, so scenes
**download their assets over HTTP on demand**: `loadGltf` / `loadEnvironment` fetch a remote
model / `.env` (and a `.gltf`'s external `.bin` + images) when not already cached locally — no
need to pre-place files. Turn them off for a minimal build with
`-DBL_POLYFILL_URL=OFF -DBL_POLYFILL_XMLHTTPREQUEST=OFF`.

> **First run downloads assets.** The default benchmark scene fetches the BoomBox glTF (~11 MB)
> + an `.env` the first time, so the window stays blank for a few seconds while they download;
> they're cached into `<exeDir>/assets/` so later runs render immediately. To ship a
> self-contained build (no network, instant render), copy that `assets/` folder next to the exe.

## Run

```powershell
# Interactive window (default scene = the 400-BoomBox + CSM benchmark):
build/bin/app.exe

# Run a specific scene bundle:
build/bin/app.exe --script build/bin/js/lite-boombox.js

# Live FPS overlay, uncapped (close the window to exit):
build/bin/app.exe --script build/bin/js/bench-scene200.js --no-vsync

# Headless: render N frames then print a BENCH line; optional screenshot:
build/bin/app.exe --frames 1000 --width 640 --height 400 --screenshot out.tga
```

| Flag | Meaning |
|------|---------|
| `--script <path>` | scene bundle to load (default: `js/bench-csm-boombox.js`) |
| `--frames N` | render N frames then exit + print the `BENCH` line (implies no-vsync) |
| `--width` / `--height` | window / framebuffer size |
| `--no-vsync` | present immediately (uncapped throughput, for perf measurement) |
| `--show-fps` | force the on-screen FPS overlay |
| `--screenshot <path>` | capture a TGA near the end (top-origin/BGRA — don't flip) |
| `--warp` | use the WARP software adapter (for the build's backend) |

The scene bundle may also be passed as a bare **positional** argument (e.g.
`app.exe scene.js --frames 1000`), matching benchmark-harness conventions; `--script` and the
positional form are equivalent.

The `BENCH` line reports `min/avg/p95/max` ms, total render time (start of frame 1 → end of the
last frame), ms/frame, FPS, `render_cpu_ms` (process CPU strictly across the render loop), and
`mem_peak_bytes` (`PeakWorkingSetSize`).

**Deploying:** ship `app.exe` with its sibling `shaders/` and `js/` folders, the `assets/`
folder (so it renders without downloading), and — for the V8 build — the staged `v8.dll` +
`icudtl.dat` + helper DLLs.

## TypeScript scenes

`js/` is a TypeScript project packaged like Babylon-Lite (ESM + esbuild, tree-shaking +
minify). `src/babylon-lite/` is the API mirror (each export forwards to a `__bl_*` native
function); `src/scenes/*.ts` are the scene entry points. `node js/build.mjs` bundles each scene
into a **self-contained** `js/dist/<name>.js` the host loads standalone — run automatically by
the `js_bundles` build target, or on its own:

```powershell
node js/build.mjs                 # bundle all scenes
npm --prefix js run typecheck     # tsc --noEmit over the project
```

## Binary size

Every build optimizes for **speed** (`/O2`) while applying the size reductions that cost
nothing in speed:

- **Single-backend bgfx** — only the selected renderer (`BL_RENDERER`, default D3D12) is
  compiled in; every other backend is disabled. bgfx is also bumped to upstream with
  `BGFX_CONFIG_C99_API=0`, `BGFX_CONFIG_VIDEO=0`, and DXBC-only embedded shaders (pinned via
  `SergioRZMasson/bgfx.cmake`).
- **LTO + dead-strip** — link-time optimization + `/OPT:REF /OPT:ICF`.
- **OS image decode** — textures/IBL faces decode via the Windows Imaging Component (WIC), so
  no software image decoder is bundled.
- Shaders ship as standalone `.bin` files next to the exe, not embedded in the binary.

The V8 benchmark `app.exe` is ~0.95 MB (the V8 redist DLLs it ships alongside dominate the
overall footprint).
