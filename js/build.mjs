// Bundle each scene entry into a SELF-CONTAINED JavaScript file the native host can load
// standalone (no separate prelude). Mirrors how Babylon-Lite ships: ESM source + esbuild,
// tree-shaking + minify for the smallest possible bundle. The "babylon-lite" import resolves
// to our native-forwarding mirror (src/babylon-lite), so each scene bundle contains only the
// API it actually uses (tree-shaken) plus the scene code.
//
//   node build.mjs                 # bundle our demo scenes + the parity-test scenes
//   node build.mjs --scenes-only   # only src/scenes/*.ts (skip the Babylon-Lite parity set)
//
// Output: dist/<name>.js (demos) and dist/tests/<slug>.js (parity). The CMake build copies
// dist/ to <build>/bin/js so the bundles are found at runtime.

import esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";

const ROOT = import.meta.dirname;                       // .../Babylon-Lite-Native-Layer/js
const NATIVE = path.resolve(ROOT, "..");                // .../Babylon-Lite-Native-Layer
const LITE = path.resolve(NATIVE, "..", "Babylon-Lite");
const MIRROR = path.join(ROOT, "src", "babylon-lite", "index.ts");
const SCENES_DIR = path.join(ROOT, "src", "scenes");
const DIST = path.join(ROOT, "dist");
const DIST_TESTS = path.join(DIST, "tests");

const scenesOnly = process.argv.includes("--scenes-only");

// Shared esbuild options: classic self-contained script, downlevelled to the in-box
// Chakra ES2017 ceiling, minified, with "babylon-lite" aliased to our mirror.
const COMMON = {
    bundle: true,
    format: "iife",
    target: "es2017",
    platform: "neutral",
    minify: true,
    legalComments: "none",
    logLevel: "silent",
    alias: { "babylon-lite": MIRROR },
};

fs.mkdirSync(DIST, { recursive: true });

function fmtKB(bytes) { return (bytes / 1024).toFixed(1) + " KB"; }

// Bundle one entry → outFile. Returns { ok, bytes, error }.
async function bundleOne(entry, outFile) {
    try {
        await esbuild.build({ ...COMMON, entryPoints: [entry], outfile: outFile });
        return { ok: true, bytes: fs.statSync(outFile).size };
    } catch (e) {
        const msg = (e && e.message ? e.message : String(e)).split("\n").filter(Boolean)[0] || "bundle failed";
        return { ok: false, error: msg };
    }
}

async function main() {
    let ok = 0, failed = 0;
    const failures = [];

    // 1) Our demo scenes (src/scenes/*.ts).
    const sceneEntries = fs.existsSync(SCENES_DIR)
        ? fs.readdirSync(SCENES_DIR).filter((f) => f.endsWith(".ts")).sort()
        : [];
    console.log(`Bundling ${sceneEntries.length} demo scene(s) → dist/`);
    for (const f of sceneEntries) {
        const name = f.replace(/\.ts$/, "");
        const r = await bundleOne(path.join(SCENES_DIR, f), path.join(DIST, `${name}.js`));
        if (r.ok) { ok++; console.log(`  ✓ ${name}.js  (${fmtKB(r.bytes)})`); }
        else { failed++; failures.push(`${name}: ${r.error}`); console.log(`  ✗ ${name}  (${r.error})`); }
    }

    // 2) Parity-test scenes: Babylon-Lite's own lab/lite/src/lite/sceneN.ts, aliased to our
    //    mirror and bundled independently (one failure doesn't stop the others). Scenes that
    //    use APIs the mirror doesn't implement fail to resolve → logged as unsupported.
    if (!scenesOnly) {
        const cfgPath = path.join(LITE, "scene-config.json");
        const liteSrc = path.join(LITE, "lab", "lite", "src", "lite");
        if (fs.existsSync(cfgPath) && fs.existsSync(liteSrc)) {
            const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
            fs.mkdirSync(DIST_TESTS, { recursive: true });
            let tOk = 0, tFail = 0;
            const tFailures = [];
            console.log(`Bundling ${cfg.length} parity-test scene(s) → dist/tests/`);
            for (const s of cfg) {
                const entry = path.join(liteSrc, `scene${s.id}.ts`);
                if (!fs.existsSync(entry)) { continue; }
                const r = await bundleOne(entry, path.join(DIST_TESTS, `${s.slug}.js`));
                if (r.ok) { tOk++; } else { tFail++; tFailures.push(`${s.slug}: ${r.error}`); }
            }
            console.log(`  parity: ${tOk} bundled, ${tFail} unsupported`);
            if (tFailures.length && process.env.BL_VERBOSE) {
                console.log("  unsupported:\n    " + tFailures.join("\n    "));
            }
        } else {
            console.log("Skipping parity tests (Babylon-Lite scene sources not found).");
        }
    }

    console.log(`\nDemos: ${ok} bundled, ${failed} failed.`);
    if (failures.length) { console.log("Demo failures:\n  " + failures.join("\n  ")); }
    if (failed > 0) { process.exitCode = 1; }
}

main();
