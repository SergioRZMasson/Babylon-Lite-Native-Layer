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

The first configure clones bgfx (BabylonJS fork, pinned to Babylon Native's tag) and
JsRuntimeHost (Node-API + the URL/XMLHttpRequest polyfills + `UrlLib`, all pinned to the
commit Babylon Native uses). The first build also compiles bgfx's `shaderc` (slow,
one-time). The standard build includes the HTTP polyfills (see below).

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

### Polyfills (browser-like globals)

JsRuntimeHost ships browser-like features as separate Node-API polyfill **static
libraries**, each toggled at configure time — the same model Babylon Native uses. Two are
wired here and **enabled by default** (the standard build above includes them):

- `BL_POLYFILL_URL` — `URL` / `URLSearchParams`.
- `BL_POLYFILL_XMLHTTPREQUEST` — `XMLHttpRequest` (HTTP; pulls JsRuntimeHost's `UrlLib`, a
  native Win32 HTTP client — no curl).

Because they're on, **scenes download their assets over HTTP on demand**: `loadGltf` /
`loadEnvironment` fetch a remote model/`.env` (and, for a `.gltf`, its external `.bin` +
image files — resolved against the document URL via the URL polyfill) when they aren't on
disk, caching them into `assets/` so later runs are offline. So a scene referencing
`https://…/Foo.gltf` just works without pre-placing the files. See
`../.ai/phase12-polyfills-http.md`.

To build a minimal `napi`-only binary without the HTTP stack (e.g. for size experiments),
turn them off — this also restores the lean JsRuntimeHost `napi`-target-only fetch:

```powershell
cmake -S . -B build-min -G Ninja -DCMAKE_BUILD_TYPE=MinSizeRel `
      -DMINIMIZE_SIZE=ON -DBL_POLYFILL_URL=OFF -DBL_POLYFILL_XMLHTTPREQUEST=OFF
cmake --build build-min --target app
```

## Run

```powershell
# Interactive window:
build/bin/app.exe

# Live perf scene with an on-screen FPS overlay (windowed; close the window to exit):
build/bin/app.exe --prelude js/lite/index.js --script js/bench/scene200.js --no-vsync
#   - omit --no-vsync to see the vsync-capped (display refresh) rate
#   - the overlay shows FPS / ms-per-frame / draw count; FPS also prints to the console
#   - --show-fps forces the overlay on for any scene

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

The default build now includes the HTTP polyfills (URL + XMLHttpRequest → UrlLib). For the
smallest possible `.exe`, configure a separate build dir that turns those off and enables
link-time optimization + a D3D11-only bgfx:

```powershell
cmake -S . -B build-min -G Ninja -DCMAKE_BUILD_TYPE=MinSizeRel -DMINIMIZE_SIZE=ON `
      -DBL_POLYFILL_URL=OFF -DBL_POLYFILL_XMLHTTPREQUEST=OFF
cmake --build build-min --target app
```

Compiled shaders are emitted as standalone `.bin` files rather than embedded C arrays,
so the shader bytecode lives outside the binary.

### `app.exe` size by JS engine (napi-only, no polyfills)

| JS engine | Release | MinSizeRel + `MINIMIZE_SIZE` |
|---|---|---|
| QuickJS (static, prior) | 1.54 MB | 1.18 MB |
| **Chakra (in-box, Node-API)** | **0.80 MB** | **0.67 MB** |

Chakra nearly halves the binary because the engine is the OS-provided DLL instead of
~0.7 MB of statically-linked engine code. The default polyfill build adds the URL +
XMLHttpRequest/UrlLib static libs (~+0.3 MB, still no extra DLLs — HTTP is in-box Win32).
See `../.ai/phase6-napi-engine-abstraction.md` and `../.ai/phase12-polyfills-http.md`.

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
- **Phase 7** — **parity-scene run + compare framework**: all 199 Babylon-Lite parity
  scenes translated to runnable JS (`js/tests/`), a manifest categorizing each by
  required API, and a runner that renders each headless and computes MAD vs the
  reference goldens. First feature batch (directional/point/spot lights, fog hook,
  solid textures, `onBeforeRender`, tuple colors) lands procedural scenes. ✅ See
  `../.ai/phase7-parity-framework.md`.
- **Phase 8** — **perf benchmark tooling**: a `bench::FrameTimer` + `BENCH` line and a
  runner matching Cedric's DawnTest methodology (scene200 workload, vsync off, warmup
  drop, min/avg/p95/max ms + FPS), so our numbers slot into the same table as his
  DawnTest / BabylonNative results. ✅ See `../.ai/phase8-perf-bench.md`.
- **Phase 9** — **animation + skeletal animation, orchestrated in C++**: glTF node (TRS)
  animation + GPU skinning, with per-frame keyframe sampling (LINEAR/STEP/CUBICSPLINE,
  SLERP), world-matrix recompose, and bone-palette computation all native. `loadGltf`
  returns animation groups; `playAnimation`/`goToFrame`/etc. drive native playback. ✅
  See `../.ai/phase9-animation-skinning.md`.
- **Phase 10** — **environment maps / image-based lighting (IBL)**: `loadEnvironment`
  parses a Babylon `.env` (prefiltered specular cubemap + SH irradiance) in JS and pushes
  it to a native bgfx RGBA16F cubemap; the PBR shader does SH diffuse + prefiltered-cube
  specular IBL + ACES tone mapping. BoomBox now shows realistic metallic reflections. ✅
  See `../.ai/phase10-ibl-environment.md`.
- **Phase 11** — **morph targets (blend shapes)**: the loader reads primitive `targets`
  (POSITION/NORMAL deltas) + weight-animation channels; the native engine samples weights
  per frame and rebuilds morphed vertices on the CPU (`base + Σ wᵢ·deltaᵢ`) into a dynamic
  vertex buffer **before** GPU skinning, so the skinned+morphed scene5 Alien deforms
  correctly. Also: external glTF image files now load. ✅
  See `../.ai/phase11-morph-targets.md`.
- **Phase 12** — **polyfill infrastructure + HTTP asset loading**: JsRuntimeHost polyfills
  as separate static libraries toggled at configure time (`BL_POLYFILL_URL`,
  `BL_POLYFILL_XMLHTTPREQUEST`), the Babylon Native model. With them on, the host creates a
  `JsRuntime` + dispatcher and `loadGltf`/`loadEnvironment` **download remote assets over
  HTTP** (URL-resolved, cached locally) so test assets needn't be on disk. ✅
  See `../.ai/phase12-polyfills-http.md`.
- **Phase 13** — **Littlest Tokyo demo + single build**: the animated diorama
  (`js/demo-littlest-tokyo.js`, 71 meshes, skin + node animation, PBR/IBL, PNG+JPEG)
  renders natively; the polyfills are now **on by default** so there's one standard build
  (the old size-opt `build-min` is opt-in via flags). ✅

## Environment maps / IBL (Phase 10)

PBR materials can be lit by an environment instead of the hemispheric stand-in. The JS
loader parses a Babylon `.env` (8-byte magic + JSON manifest + RGBD-encoded PNG faces),
converts the 9 SH polynomial coefficients to pre-scaled harmonics, and uploads the 8 mip
levels × 6 faces to a native cubemap; the fragment shader evaluates SH irradiance for
diffuse and samples the prefiltered cube (LOD from roughness) for specular, with an
analytic env-BRDF. The specular reflection LOD (`log2(cubemapDim·alphaG)·lodScale`), specular
+ horizon occlusion, and the image-processing (exposure → exponential tonemap → gamma →
contrast) match Babylon Lite's `pbr-mr-helper` reference, so env-lit materials read with the
right gloss instead of looking over-shiny. Scenes without an environment fall back to the
previous hemispheric + Reinhard path unchanged.

```bat
:: BoomBox lit by environmentSpecular.env (headless: add --frames 3 --screenshot out.tga)
build\bin\app.exe --prelude js\lite\index.js --script js\lite-boombox.js
```

Gaps toward strict parity: skybox/ground background not drawn, `loadHdrEnvironment`
(`.hdr`) not implemented, and an analytic env-BRDF instead of the BRDF-LUT texture. See
`../.ai/phase10-ibl-environment.md` and `../.ai/phase14-pbr-ibl-fidelity-fix.md`.

## Animation + skeletal animation (Phase 9)

glTF node animations and skeletons are driven entirely by the native engine (JS only
parses the asset + controls playback). `loadGltf` exposes `scene.animationGroups`, which
auto-play; the C++ render loop samples keyframes, recomposes node world matrices, and (for
skins) computes the bone palette for GPU skinning each frame.

```powershell
# Node (TRS) animation — a box hierarchy that moves/rotates:
build/bin/app.exe --prelude js/lite/index.js --script js/anim-boxanimated.js --show-fps

# Skeletal animation (GPU skinning) — a walking figure / a fox:
build/bin/app.exe --prelude js/lite/index.js --script js/anim-cesiumman.js --show-fps
build/bin/app.exe --prelude js/lite/index.js --script js/anim-fox.js --show-fps
```

Animated/skinned glTF assets live in `assets/` (BoxAnimated, CesiumMan, Fox GLBs +
AnimatedTriangle/SimpleSkin). The loader handles GLB, multi-buffer `.gltf` (external
`.bin` / data-URI), generates normals when absent, and reverses winding for the Babylon
RH→LH convention.

## Morph targets (Phase 11)

Morph-target (blend-shape) animation is evaluated natively. The loader reads each
primitive's `targets` (POSITION/NORMAL deltas) and the weight-animation channels; the C++
engine samples the weights each frame and rebuilds the morphed vertices on the CPU into a
dynamic vertex buffer (`base + Σ weightᵢ·deltaᵢ`), **before** GPU skinning — so a mesh that
is both skinned and morphed (the Alien) deforms correctly. Works for skinned and
non-skinned morph meshes alike.

```powershell
# Scene 5 — Alien: a skinned + morph-target bust (facial blend + head motion):
build/bin/app.exe --prelude js/lite/index.js --script js/tests/scene5-alien.js --show-fps
```

The Alien is a larger model downloaded from the playground CDN (like the GLBs, it is
git-ignored). Fetch it into `assets/` before running:

```powershell
$base = "https://playground.babylonjs.com/scenes/Alien/"
foreach ($f in @("Alien.gltf","Alien.bin","Alien_baseColor.png","Alien_occlusionRoughnessMetallic.png","Alien_normal.png")) {
  Invoke-WebRequest -Uri ($base + $f) -OutFile "assets/$f" -UseBasicParsing
}
```

The loader now also loads **external** glTF image files (`image.uri`), not just
GLB-embedded textures, so the Alien's separate PNG maps render.

## Demos

`js/demo-*.js` are showcase scenes (vs the `js/tests/` parity scenes). **Littlest Tokyo** —
Glen Fox's animated diorama (71 meshes, skinned + node animation, PBR + IBL, PNG/JPEG
textures) — exercises most of the engine at once:

```powershell
build/bin/app.exe --prelude js/lite/index.js --script js/demo-littlest-tokyo.js --show-fps
```

The model is large (~10 MB) and lives in the Babylon-Lite repo (no public CDN URL), so copy
it into `assets/` once (it's git-ignored like the other GLBs):

```powershell
Copy-Item ..\Babylon-Lite\lab\public\bundle\demos\littlest-tokyo\LittlestTokyo.glb assets\
```

It's a native adaptation of `lab/lite/src/demos/littlest-tokyo.ts` — the browser-only bits
(progress UI, the visible HDR skybox, DDS env → uses the local `environmentSpecular.env`
for IBL) are omitted. (For models that *do* have a working URL, the HTTP polyfills download
them automatically on first run — no manual copy needed.)

## Perf benchmark (Phase 8)

Measure per-frame time the same way Cedric's DawnTest bench does, so the numbers are
directly comparable in format + methodology.

```powershell
cmake --build build --target app
node tools/bench/run-bench.mjs --frames 600        # --no-open to skip the browser
```

The app renders `js/bench/scene200.js` (the thin-instance stress workload) with vsync
off, drops the first frame as warmup, and prints one `BENCH …` line; the runner parses
it into min/avg/p95/max ms + **FPS = 1000/avg_ms**, writing
`tools/bench/out/bench-report.html`. It also **auto-discovers and runs Cedric's DawnTest
(`Samples/webgpu-cross-platform-app/build-*/`) and the BabylonNative Playground** if
they're built on this machine — giving a true same-hardware side-by-side — and always
lists his published reference numbers as clearly-tagged cross-machine baselines.

> ⚠️ Absolute ms is only comparable **on the same machine**. Our procedural meshes also
> shade with the Standard shader (no PBR+IBL) and draw one call per visible instance (no
> GPU instancing yet), so our ms/frame is lower than an equal-cost comparison would give.
> See `../.ai/phase8-perf-bench.md` for the full caveats.

## Parity test framework (Phase 7)

Run Babylon-Lite's parity scenes in the native host and compare to the reference
goldens. Tooling lives in `tools/`; the JS scene equivalents in `js/tests/`.

```powershell
# 1. (once) install esbuild for the translator
npm install --no-save esbuild

# 2. translate every lab/lite/src/lite/sceneN.ts -> js/tests/<slug>.js (ES2017)
node tools/translate_scenes.mjs

# 3. categorize all scenes -> js/tests/manifest.json (id, tags, golden?, missing API)
python tools/gen_manifest.py

# 4. run + compare (needs Pillow): app.exe per scene, screenshot @1280x720, MAD vs golden
python tools/run_parity.py --filter supported     # or: --filter golden | all | --ids 2,3,6
```

Outcome per scene: `compared` (MAD reported), `rendered` (content, no local golden),
`blank`, `js-error` (unsupported API — message captured), `timeout`. The report is
written to `build/parity-out/report.json`. **Status:** 199/199 translate + run; the
first feature batch renders the procedural/standard scenes (sphere, fog boxes, emissive
grid of 2500 spheres, spotlights). The long tail errors on subsystems not yet built
(NME, sprites, physics, shadows, gaussian splatting, navigation, animation, gizmos) —
the manifest's `missingApi` prioritizes them.

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
