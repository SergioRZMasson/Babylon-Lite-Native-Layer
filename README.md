# Babylon-Lite Native Layer

A Dawn-free native Windows host that runs **Babylon-Lite** JavaScript on top of a native
**bgfx (Direct3D 12)** renderer: the JS owns app logic + glTF/asset loading and calls a thin
`__bl_*` native seam; C++ owns the render loop, scene traversal, and all GPU work. Consumers
write ordinary Babylon-Lite code (`import { ... } from "babylon-lite"`) and it renders
natively — no WebGPU.

## Prerequisites

- Windows x64, a GPU/driver with **Direct3D 12**
- **Visual Studio 2022**, **CMake**, **Ninja**
- **Node.js** (bundles the TypeScript scenes)

Run all commands from a **Developer PowerShell for VS 2022** (or after calling
`vcvars64.bat`).

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

### JS engine

The native seam targets **Node-API (`Napi::`)**, so the JS engine is chosen at build time via
`-DJS_ENGINE=…` (mapped to JsRuntimeHost's `NAPI_JAVASCRIPT_ENGINE`):

- **Chakra** (default) — the in-box `Chakra.dll`; nothing extra to ship, smallest `.exe`. Note
  it's frozen at ~ES2017 (the scene bundles target ES2017 to match).
- **V8** — used for the performance benchmark. **Requires the MSVC compiler** (`cl`); the V8
  NuGet's arch detection rejects clang. The build stages the V8 redist (`v8.dll` + `icudtl.dat`
  + helpers) next to `app.exe` automatically.

```powershell
cmake -S . -B build-v8 -G Ninja -DCMAKE_BUILD_TYPE=Release -DJS_ENGINE=V8 `
      -DCMAKE_C_COMPILER=cl -DCMAKE_CXX_COMPILER=cl
cmake --build build-v8
```

### Polyfills (HTTP asset loading)

JsRuntimeHost's **URL** + **XMLHttpRequest** polyfills are linked by default, so scenes
**download their assets over HTTP on demand**: `loadGltf` / `loadEnvironment` fetch a remote
model / `.env` (and a `.gltf`'s external `.bin` + images) when not already cached locally — no
need to pre-place files. Turn them off for a minimal build with
`-DBL_POLYFILL_URL=OFF -DBL_POLYFILL_XMLHTTPREQUEST=OFF`.

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
| `--warp` | use the D3D12 WARP software adapter |

The `BENCH` line reports `min/avg/p95/max` ms, total render time, ms/frame, FPS, `cpu_ms`, and
`mem_peak_bytes` (`PeakWorkingSetSize`).

**Deploying:** ship `app.exe` with its sibling `shaders/` and `js/` folders (and, for the V8
build, the staged `v8.dll` + `icudtl.dat` + helper DLLs).

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

- **D3D12-only bgfx** — only the Direct3D12 backend is compiled in; every other backend is
  disabled. bgfx is also bumped to upstream with `BGFX_CONFIG_C99_API=0`, `BGFX_CONFIG_VIDEO=0`,
  and DXBC-only embedded shaders (pinned via `SergioRZMasson/bgfx.cmake`).
- **LTO + dead-strip** — link-time optimization + `/OPT:REF /OPT:ICF`.
- **OS image decode** — textures/IBL faces decode via the Windows Imaging Component (WIC), so
  no software image decoder is bundled.
- Shaders ship as standalone `.bin` files next to the exe, not embedded in the binary.

The V8 benchmark `app.exe` is ~0.95 MB (the V8 redist DLLs it ships alongside dominate the
overall footprint).
