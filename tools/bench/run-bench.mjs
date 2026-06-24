// run-bench.mjs — perf benchmark runner for the Babylon-Lite Native Layer.
//
// Mirrors the methodology of the DawnTest sample's tools/bench/run-bench.mjs so our
// numbers are produced + parsed the same way: each app renders N frames with vsync off,
// prints one `BENCH …` line on exit, and we aggregate min/avg/max/p95 ms + FPS
// (= 1000 / avg_ms) into a console table + JSON + a self-contained HTML report.
//
// It runs OUR app on js/bench/scene200.js, and — if you've also built them on this
// machine — auto-discovers and runs Cedric's DawnTest (Samples/webgpu-cross-platform-app
// build-*/app.exe) and the BabylonNative Playground for a true same-hardware side-by-side.
// Cedric's published reference numbers (Perf/Cedric.md) are always included as baseline
// rows, tagged as measured on his hardware (so cross-machine rows are clearly labelled).
//
// Usage (from the Babylon-Lite-Native-Layer dir):
//   node tools/bench/run-bench.mjs                       # default 600 frames, 1024x768
//   node tools/bench/run-bench.mjs --frames 200 --no-open
//   node tools/bench/run-bench.mjs --only nativelite-chakra-d3d11

import { spawn } from "node:child_process";
import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { platform } from "node:os";

const HERE = dirname(fileURLToPath(import.meta.url));
const NATIVE = resolve(HERE, "..", "..");                 // Babylon-Lite-Native-Layer
const ROOT = resolve(NATIVE, "..");                       // experimentation root
const SAMPLE = join(ROOT, "Samples", "webgpu-cross-platform-app");
const BN = join(ROOT, "BabylonNative");
const isWin = platform() === "win32";
const EXE = isWin ? "app.exe" : "app";

const opts = {
    frames: 600, width: 1024, height: 768,
    outDir: join(NATIVE, "tools", "bench", "out"),
    only: null, open: true, timeoutMs: 5 * 60 * 1000,
};
for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    const eat = () => process.argv[++i];
    if (a === "--frames") opts.frames = parseInt(eat(), 10);
    else if (a === "--width") opts.width = parseInt(eat(), 10);
    else if (a === "--height") opts.height = parseInt(eat(), 10);
    else if (a === "--out") opts.outDir = resolve(eat());
    else if (a === "--only") opts.only = eat().split(",");
    else if (a === "--no-open") opts.open = false;
    else if (a === "--list") opts.list = true;
    else if (a === "--help" || a === "-h") { printHelp(); process.exit(0); }
}

function printHelp() {
    console.log(`Usage: node tools/bench/run-bench.mjs [options]
  --frames N     frames to render per cell (default 600; first is warmup)
  --width/-height back-buffer size (default 1024x768)
  --only IDS     comma-separated cell ids to run
  --no-open      don't open the HTML report
  --list         list discovered cells and exit`);
}

// --- CMakeCache helper ----------------------------------------------------
function readCMakeCache(dir) {
    const p = join(dir, "CMakeCache.txt");
    if (!existsSync(p)) return null;
    const out = {};
    for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
        const m = line.match(/^([A-Z_][A-Za-z0-9_]*):[A-Z]+=(.*)$/);
        if (m) out[m[1]] = m[2];
    }
    return out;
}

// --- cell discovery -------------------------------------------------------
// A cell: { id, app, engine, gfx, exe, args, cross? } where cross=true means the
// reference numbers come from another machine (Cedric's table), not measured here.
function discoverNativeLite() {
    const cells = [];
    for (const bd of ["build", "build-min"]) {
        const buildDir = join(NATIVE, bd);
        const exe = join(buildDir, "bin", EXE);
        if (!existsSync(exe)) continue;
        const cache = readCMakeCache(buildDir);
        const engine = (cache?.JS_ENGINE || "Chakra").toLowerCase();
        const gfx = "d3d11";
        cells.push({
            id: `nativelite-${engine}-${gfx}${bd === "build-min" ? "-min" : ""}`,
            app: "NativeLite", engine, gfx, exe,
            cwd: NATIVE,
            args: ["--prelude", "js/lite/index.js", "--script", "js/bench/scene200.js",
                   "--scene-name", "scene200", "--frames", String(opts.frames),
                   "--no-vsync", "--width", String(opts.width), "--height", String(opts.height)],
        });
    }
    return cells;
}

function discoverDawnTest() {
    if (!existsSync(SAMPLE)) return [];
    const cells = [];
    for (const e of readdirSync(SAMPLE, { withFileTypes: true })) {
        if (!e.isDirectory() || !e.name.startsWith("build")) continue;
        const buildDir = join(SAMPLE, e.name);
        const cache = readCMakeCache(buildDir);
        if (!cache) continue;
        const exe = [join(buildDir, EXE), join(buildDir, "Release", EXE)].find(existsSync);
        if (!exe) continue;
        const engine = (cache.JS_ENGINE || "Chakra").toLowerCase();
        const gfx = (cache.GRAPHICS_API || "D3D12").toLowerCase();
        const bundle = engine === "chakra"
            ? join(SAMPLE, "assets", "script", "dist-chakra", "scene200.lite.js")
            : join(SAMPLE, "assets", "script", "dist", "scene200.lite.js");
        if (!existsSync(bundle)) continue;
        cells.push({
            id: `dawntest-${engine}-${gfx}`, app: "DawnTest", engine, gfx, exe,
            cwd: dirname(exe),
            args: [bundle, "--frames", String(opts.frames), "--width", String(opts.width),
                   "--height", String(opts.height), "--no-vsync"],
        });
    }
    return cells;
}

function discoverBN() {
    const buildRoot = join(BN, "build");
    if (!existsSync(buildRoot)) return [];
    const cells = [];
    for (const e of readdirSync(buildRoot, { withFileTypes: true })) {
        if (!e.isDirectory()) continue;
        const exe = [
            join(buildRoot, e.name, "Apps", "Playground", "Release", "Playground.exe"),
            join(buildRoot, e.name, "Apps", "Playground", "Playground.exe"),
        ].find(existsSync);
        if (!exe) continue;
        const engine = (e.name.match(/(chakra|v8|quickjs|hermes|jsc)/) || [, "chakra"])[1];
        const gfx = (e.name.match(/(d3d11|d3d12|vulkan|metal)/) || [, "d3d12"])[1];
        const script = join(BN, "Apps", "Playground", "Scripts", "scene200.js");
        cells.push({
            id: `bnplayground-${engine}-${gfx}`, app: "BNPlayground", engine, gfx, exe,
            cwd: dirname(exe),
            args: [script, "--frames", String(opts.frames), "--no-vsync"],
        });
    }
    return cells;
}

// Cedric's published reference numbers (Perf/Cedric.md) — measured on HIS hardware,
// so they're cross-machine baselines (clearly tagged). avg_ms drives the derived FPS.
function referenceCells() {
    return [
        { id: "ref-dawntest-quickjs-d3d12", app: "DawnTest (ref)", engine: "quickjs", gfx: "d3d12",
          cross: true, bench: { scene: "scene200", avg_ms: 40.00 } },
        { id: "ref-bnplayground-chakra-d3d12", app: "BNPlayground (ref)", engine: "chakra", gfx: "d3d12",
          cross: true, bench: { scene: "scene200", avg_ms: 53.42 } },
    ];
}

// --- run one cell ---------------------------------------------------------
function parseBenchLine(line) {
    if (!line.startsWith("BENCH ")) return null;
    const out = {};
    for (const tok of line.slice(6).trim().split(/\s+/)) {
        const eq = tok.indexOf("=");
        if (eq < 0) continue;
        const k = tok.slice(0, eq), v = tok.slice(eq + 1);
        out[k] = /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v;
    }
    return out;
}

function runCell(cell) {
    return new Promise((res) => {
        const t0 = Date.now();
        const proc = spawn(cell.exe, cell.args, { cwd: cell.cwd, windowsHide: true });
        let stdout = "", stderr = "", bench = null, pending = "";
        proc.stdout.on("data", (c) => {
            const s = c.toString("utf8"); stdout += s; pending += s;
            const parts = pending.split(/\r?\n/); pending = parts.pop();
            for (const ln of parts) { const p = parseBenchLine(ln); if (p) bench = p; }
        });
        proc.stderr.on("data", (c) => { stderr += c.toString("utf8"); });
        const timer = setTimeout(() => proc.kill("SIGKILL"), opts.timeoutMs);
        proc.on("exit", () => {
            clearTimeout(timer);
            if (pending) { const p = parseBenchLine(pending); if (p) bench = p; }
            res({ ...cell, bench, ok: bench != null, elapsedMs: Date.now() - t0,
                  stderrTail: stderr.split(/\r?\n/).slice(-12).join("\n") });
        });
        proc.on("error", (err) => { clearTimeout(timer); res({ ...cell, ok: false, error: String(err) }); });
    });
}

// --- report ---------------------------------------------------------------
const fmt = (v, d = 2) => (v == null || Number.isNaN(v) ? "—" : Number(v).toFixed(d));
const fpsOf = (b) => (b && b.avg_ms ? 1000 / b.avg_ms : null);

function consoleTable(rows) {
    const line = "-".repeat(96);
    console.log("\n" + line);
    console.log(["cell".padEnd(34), "avg ms".padStart(9), "min".padStart(8), "p95".padStart(8),
                 "max".padStart(8), "FPS".padStart(7), "note"].join(" "));
    console.log(line);
    for (const r of rows) {
        const b = r.bench;
        const note = r.cross ? "Cedric's HW (reported)" : (r.ok === false ? "FAILED" : "");
        console.log([
            r.id.padEnd(34),
            fmt(b?.avg_ms, 2).padStart(9),
            fmt(b?.min_ms, 2).padStart(8),
            fmt(b?.p95_ms, 2).padStart(8),
            fmt(b?.max_ms, 2).padStart(8),
            fmt(fpsOf(b), 1).padStart(7),
            note,
        ].join(" "));
    }
    console.log(line);
    console.log("Note: rows tagged 'Cedric's HW' are reported numbers from a different machine —");
    console.log("absolute ms is not comparable across hardware. Same-machine rows are directly comparable.\n");
}

function htmlReport(rows, meta) {
    const okRows = rows.filter((r) => r.bench && r.bench.avg_ms);
    const maxAvg = Math.max(1, ...okRows.map((r) => r.bench.avg_ms));
    const barRows = okRows.map((r) => {
        const w = Math.round((r.bench.avg_ms / maxAvg) * 420);
        const color = r.cross ? "#bbb" : (r.app === "NativeLite" ? "#3b82f6" : "#10b981");
        return `<div class="bar"><span class="lbl">${r.id}</span>` +
            `<span class="track"><span class="fill" style="width:${w}px;background:${color}"></span></span>` +
            `<span class="val">${fmt(r.bench.avg_ms, 2)} ms · ${fmt(1000 / r.bench.avg_ms, 1)} fps</span></div>`;
    }).join("\n");
    const tableRows = rows.map((r) => {
        const b = r.bench;
        return `<tr class="${r.cross ? "cross" : ""}"><td>${r.id}</td><td>${r.app}</td><td>${r.engine}</td>` +
            `<td>${r.gfx}</td><td class="n">${fmt(b?.avg_ms, 3)}</td><td class="n">${fmt(b?.min_ms, 3)}</td>` +
            `<td class="n">${fmt(b?.p95_ms, 3)}</td><td class="n">${fmt(b?.max_ms, 3)}</td>` +
            `<td class="n">${fmt(fpsOf(b), 1)}</td><td>${r.cross ? "Cedric's HW" : (r.ok === false ? "FAILED" : "this machine")}</td></tr>`;
    }).join("\n");
    return `<!doctype html><meta charset="utf-8"><title>NativeLite perf bench — scene200</title>
<style>body{font:14px system-ui,Segoe UI,Arial;margin:24px;color:#222}
h1{font-size:20px}table{border-collapse:collapse;margin:14px 0}
td,th{border:1px solid #ddd;padding:5px 9px}.n{text-align:right;font-variant-numeric:tabular-nums}
tr.cross{color:#888}.bar{display:flex;align-items:center;gap:8px;margin:3px 0}
.lbl{width:240px;font-size:12px}.track{width:420px;background:#f0f0f0;height:16px;border-radius:3px}
.fill{display:block;height:16px;border-radius:3px}.val{font-size:12px}.muted{color:#888}</style>
<h1>Babylon-Lite Native Layer — scene200 perf bench</h1>
<p class="muted">${meta.host} · ${meta.timestamp} · ${meta.frames} frames · ${meta.width}×${meta.height} · vsync off · first frame = warmup</p>
<h3>avg ms/frame (lower is better)</h3>${barRows}
<table><tr><th>cell</th><th>app</th><th>engine</th><th>gfx</th><th class="n">avg ms</th>
<th class="n">min</th><th class="n">p95</th><th class="n">max</th><th class="n">FPS</th><th>measured on</th></tr>
${tableRows}</table>
<p class="muted">Grey rows are reported on Cedric's hardware (Perf/Cedric.md); absolute ms is not comparable across machines.</p>`;
}

// --- main -----------------------------------------------------------------
(async () => {
    let cells = [...discoverNativeLite(), ...discoverDawnTest(), ...discoverBN()];
    if (opts.only) cells = cells.filter((c) => opts.only.includes(c.id));

    if (opts.list) {
        console.log("Discovered cells:");
        for (const c of cells) console.log(`  ${c.id}  ->  ${c.exe}`);
        return;
    }
    if (cells.length === 0) {
        console.error("No runnable cells found. Build the app first (cmake --build build --target app).");
    }

    console.log(`Running ${cells.length} cell(s): ${opts.frames} frames @ ${opts.width}x${opts.height}, vsync off\n`);
    const results = [];
    for (const c of cells) {
        process.stdout.write(`  ${c.id} ... `);
        const r = await runCell(c);
        results.push(r);
        if (r.ok) console.log(`avg ${fmt(r.bench.avg_ms, 2)} ms (${fmt(fpsOf(r.bench), 1)} fps)`);
        else { console.log("FAILED"); if (r.stderrTail) console.log(r.stderrTail.split("\n").map((l) => "      " + l).join("\n")); }
    }

    const rows = [...results, ...referenceCells()];
    consoleTable(rows);

    mkdirSync(opts.outDir, { recursive: true });
    const meta = { host: `${platform()}`, timestamp: new Date().toISOString(),
                   frames: opts.frames, width: opts.width, height: opts.height };
    writeFileSync(join(opts.outDir, "bench-results.json"),
        JSON.stringify({ meta, rows: rows.map((r) => ({ id: r.id, app: r.app, engine: r.engine, gfx: r.gfx, cross: !!r.cross, bench: r.bench || null })) }, null, 1));
    const htmlPath = join(opts.outDir, "bench-report.html");
    writeFileSync(htmlPath, htmlReport(rows, meta));
    console.log(`report: ${htmlPath}`);
    console.log(`json:   ${join(opts.outDir, "bench-results.json")}`);

    if (opts.open && isWin) spawn("cmd", ["/c", "start", "", htmlPath], { detached: true });
})();
