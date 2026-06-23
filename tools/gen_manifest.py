#!/usr/bin/env python3
"""Generate js/tests/manifest.json: every Babylon-Lite parity scene categorized by
the public-API symbols it imports, whether a golden reference exists locally, and
whether our native engine currently supports it (imports subset of SUPPORTED).

Source of truth:
  <lite>/scene-config.json                 -> id, slug, name, tags, maxMad, skipParity
  <lite>/lab/lite/src/lite/sceneN.ts       -> imports from "babylon-lite" (required API)
  <lite>/reference/lite/<slug>/babylon-ref-golden.png -> golden present?

Run:  python tools/gen_manifest.py
"""
import json, os, re, glob

HERE = os.path.dirname(os.path.abspath(__file__))
NATIVE = os.path.dirname(HERE)
LITE = os.path.abspath(os.path.join(NATIVE, "..", "Babylon-Lite"))

# Public-API symbols our native thin-JS layer implements today. Keep in sync with
# js/lite/index.js `pub` + the modules. Types (Vec3/Color/ArcRotateCamera) are
# erased in JS so they never gate support.
SUPPORTED = {
    "createEngine", "createSceneContext", "createArcRotateCamera", "createDefaultCamera",
    "createFreeCamera", "createHemisphericLight", "createDirectionalLight", "createPointLight",
    "createSpotLight", "createBox", "createSphere", "createGround", "createPlane",
    "createStandardMaterial", "createPbrMaterial", "createSolidTexture2D",
    "loadGltf", "loadEnvironment", "loadSkybox", "setFog", "setThinInstances", "setThinInstanceColors",
    "addToScene", "removeFromScene", "registerScene", "startEngine", "stopEngine", "attachControl",
    "onBeforeRender", "createTransformNode", "setParent", "mat4Compose",
}
# Type-only / harness symbols that are erased in JS (don't gate support).
TYPE_ONLY = {
    "ArcRotateCamera", "FreeCamera", "Vec3", "Vec3Tuple", "Mat4", "SceneContext",
    "SceneNode", "Mesh", "Material", "TransformNode", "EngineContext", "LightBase",
    "Texture2D", "PbrMaterialProps", "StandardMaterialProps", "type PbrMaterialProps",
    "type RenderTask",
}

IMPORT_RE = re.compile(r'import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+"babylon-lite"', re.S)


def scene_imports(scene_id):
    path = os.path.join(LITE, "lab", "lite", "src", "lite", f"scene{scene_id}.ts")
    if not os.path.exists(path):
        return None
    text = open(path, encoding="utf-8").read()
    names = set()
    for m in IMPORT_RE.finditer(text):
        for n in m.group(1).split(","):
            n = n.strip()
            if n.startswith("type "):
                n = n[5:].strip()
            if n:
                names.add(n)
    return sorted(names)


def main():
    cfg = json.load(open(os.path.join(LITE, "scene-config.json"), encoding="utf-8"))
    out = []
    for s in cfg:
        sid, slug = s["id"], s["slug"]
        imports = scene_imports(sid) or []
        gated = [n for n in imports if n not in TYPE_ONLY]
        missing = sorted(n for n in gated if n not in SUPPORTED)
        golden = os.path.exists(
            os.path.join(LITE, "reference", "lite", slug, "babylon-ref-golden.png"))
        out.append({
            "id": sid,
            "slug": slug,
            "name": s.get("name", slug),
            "tags": s.get("tags", []),
            "maxMad": s.get("maxMad"),
            "skipParity": bool(s.get("skipParity")),
            "golden": golden,
            "supported": len(missing) == 0 and not s.get("skipParity"),
            "missingApi": missing,
            "imports": imports,
        })
    dst = os.path.join(NATIVE, "js", "tests", "manifest.json")
    json.dump(out, open(dst, "w", encoding="utf-8"), indent=1)

    supported = [s for s in out if s["supported"]]
    sup_golden = [s for s in supported if s["golden"]]
    print(f"scenes: {len(out)}  supported-now: {len(supported)}  "
          f"supported+golden: {len(sup_golden)}  goldens: {sum(1 for s in out if s['golden'])}")
    print("supported now:", ", ".join(str(s["id"]) for s in supported))
    # What single missing symbol blocks the most otherwise-simple scenes?
    from collections import Counter
    blockers = Counter()
    for s in out:
        for m in s["missingApi"]:
            blockers[m] += 1
    print("top blockers:", blockers.most_common(20))


if __name__ == "__main__":
    main()
