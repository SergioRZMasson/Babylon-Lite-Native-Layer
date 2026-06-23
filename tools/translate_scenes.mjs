// Translate Babylon-Lite parity scene sources (lab/lite/src/lite/sceneN.ts) into
// plain-JS equivalents under js/tests/<slug>.js so each parity scene can run in our
// native host. Uses esbuild to (a) strip TypeScript types and (b) downlevel modern JS
// (optional chaining `?.`, nullish `??`, numeric separators, ...) to ES2017 — the
// ceiling of the in-box Chakra engine. The `import`/`export` lines are then removed
// because the prelude (js/lite/index.js) installs the API on globalThis.
//
//   node tools/translate_scenes.mjs          # translate all scenes in scene-config.json
//
import esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";

const NATIVE = path.resolve(import.meta.dirname, "..");
const LITE = path.resolve(NATIVE, "..", "Babylon-Lite");
const SRC_DIR = path.join(LITE, "lab", "lite", "src", "lite");
const OUT_DIR = path.join(NATIVE, "js", "tests");

const cfg = JSON.parse(fs.readFileSync(path.join(LITE, "scene-config.json"), "utf8"));
fs.mkdirSync(OUT_DIR, { recursive: true });

let ok = 0, missing = 0, failed = 0;
const failures = [];

for (const s of cfg) {
    const srcPath = path.join(SRC_DIR, `scene${s.id}.ts`);
    if (!fs.existsSync(srcPath)) { missing++; continue; }
    const src = fs.readFileSync(srcPath, "utf8");
    let js;
    try {
        const out = await esbuild.transform(src, {
            loader: "ts", format: "esm", target: "es2017",
            sourcemap: false, legalComments: "none",
        });
        js = out.code;
    } catch (e) {
        failed++; failures.push(`${s.slug}: ${String(e.message || e).split("\n")[0]}`); continue;
    }
    // Drop ALL import/export statements (the prelude installs the Babylon-Lite API as
    // globals; sub-path or third-party imports become undefined globals → a clean runtime
    // error for genuinely unsupported scenes). We eval as a classic script, not a module.
    js = js.replace(/^\s*import\s+[\s\S]*?from\s+["'][^"']*["'];?\s*$/gm, "");  // import { x } from "m"
    js = js.replace(/^\s*import\s+["'][^"']*["'];?\s*$/gm, "");                  // import "m"
    js = js.replace(/^\s*export\s+\{[^}]*\}\s*;?\s*$/gm, "");                    // export { x }
    js = js.replace(/^(\s*)export\s+default\s+/gm, "$1");
    js = js.replace(/^(\s*)export\s+/gm, "$1");
    js = js.replace(/\n{3,}/g, "\n\n").trimStart();
    const header =
        `// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene${s.id}.ts (esbuild, target es2017)\n` +
        `// ${s.name} — tags: ${(s.tags || []).join(", ")}\n` +
        `// Run:  app.exe --prelude js/lite/index.js --script js/tests/${s.slug}.js\n\n`;
    fs.writeFileSync(path.join(OUT_DIR, `${s.slug}.js`), header + js);
    ok++;
}

console.log(`translated: ${ok}  missing-source: ${missing}  failed: ${failed}`);
if (failures.length) { console.log("failures:\n  " + failures.join("\n  ")); }
