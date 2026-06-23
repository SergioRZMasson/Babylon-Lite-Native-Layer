#!/usr/bin/env python3
"""Run Babylon-Lite parity scenes in our native host and compare to the reference
goldens. For each selected scene it:
  1. runs app.exe --prelude js/lite/index.js --script js/tests/<slug>.js headless,
     capturing a 1280x720 screenshot (the golden resolution),
  2. detects JS errors from the host's stderr,
  3. computes MAD vs reference/lite/<slug>/babylon-ref-golden.png when it exists.

Usage (from the Babylon-Lite-Native-Layer dir):
  python tools/run_parity.py                 # supported scenes (per manifest)
  python tools/run_parity.py --filter golden # only scenes that have a local golden
  python tools/run_parity.py --filter all
  python tools/run_parity.py --ids 2,3,6,13,20,31,32
"""
import argparse, json, os, subprocess, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
NATIVE = os.path.dirname(HERE)
LITE = os.path.abspath(os.path.join(NATIVE, "..", "Babylon-Lite"))
APP = os.path.join(NATIVE, "build", "bin", "app.exe")
PRELUDE = os.path.join("js", "lite", "index.js")
OUT_DIR = os.path.join(NATIVE, "build", "parity-out")
W, H = 1280, 720


def golden_path(slug):
    return os.path.join(LITE, "reference", "lite", slug, "babylon-ref-golden.png")


def load_rgb(path):
    return Image.open(path).convert("RGB")


def coverage(img):
    """Fraction of pixels that differ from the background. Background is estimated as
    the median of the four corner pixels (robust to per-scene clear color)."""
    px = img.load()
    w, h = img.size
    corners = [px[0, 0], px[w - 1, 0], px[0, h - 1], px[w - 1, h - 1]]
    bg = tuple(sorted(c[i] for c in corners)[1] for i in range(3))
    n = 0
    total = 0
    step = max(1, (w * h) // 40000)  # sample for speed
    i = 0
    for y in range(h):
        for x in range(w):
            i += 1
            if i % step:
                continue
            total += 1
            r, g, b = px[x, y]
            if abs(r - bg[0]) > 12 or abs(g - bg[1]) > 12 or abs(b - bg[2]) > 12:
                n += 1
    return 100.0 * n / max(1, total)


def mad(actual, golden):
    if actual.size != golden.size:
        actual = actual.resize(golden.size)
    aw, ah = golden.size
    ap, gp = actual.load(), golden.load()
    step = max(1, (aw * ah) // 200000)
    s = 0.0
    cnt = 0
    i = 0
    for y in range(ah):
        for x in range(aw):
            i += 1
            if i % step:
                continue
            ar, ag, ab = ap[x, y]
            gr, gg, gb = gp[x, y]
            s += (abs(ar - gr) + abs(ag - gg) + abs(ab - gb)) / 3.0
            cnt += 1
    return s / max(1, cnt)


def run_scene(scene, frames, timeout):
    slug = scene["slug"]
    tga = os.path.join(OUT_DIR, f"{slug}.tga")
    if os.path.exists(tga):
        os.remove(tga)
    script = os.path.join("js", "tests", f"{slug}.js")
    cmd = [APP, "--prelude", PRELUDE, "--script", script, "--frames", str(frames),
           "--screenshot", tga, "--warp", "--width", str(W), "--height", str(H)]
    res = {"id": scene["id"], "slug": slug, "status": "?", "mad": None, "coverage": None, "note": ""}
    try:
        p = subprocess.run(cmd, cwd=NATIVE, capture_output=True, text=True, timeout=timeout)
        err = (p.stderr or "") + (p.stdout or "")
    except subprocess.TimeoutExpired:
        res["status"] = "timeout"
        return res
    # JS error from the host?
    for line in err.splitlines():
        if "[js] exception" in line or "ReferenceError" in line or "TypeError" in line or "fatal:" in line:
            res["status"] = "js-error"
            res["note"] = line.strip()[:140]
            break
    if res["status"] == "js-error":
        return res
    if not os.path.exists(tga):
        res["status"] = "no-output"
        return res
    actual = load_rgb(tga)
    res["coverage"] = round(coverage(actual), 1)
    gp = golden_path(slug)
    if os.path.exists(gp):
        res["mad"] = round(mad(actual, load_rgb(gp)), 2)
        res["status"] = "compared"
    else:
        res["status"] = "rendered" if res["coverage"] > 0.2 else "blank"
    return res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--filter", choices=["supported", "golden", "all"], default="supported")
    ap.add_argument("--ids", help="comma-separated scene ids (overrides --filter)")
    ap.add_argument("--frames", type=int, default=6)
    ap.add_argument("--timeout", type=int, default=40)
    args = ap.parse_args()

    manifest = json.load(open(os.path.join(NATIVE, "js", "tests", "manifest.json"), encoding="utf-8"))
    if args.ids:
        want = set(int(x) for x in args.ids.split(","))
        scenes = [s for s in manifest if s["id"] in want]
    elif args.filter == "golden":
        scenes = [s for s in manifest if s["golden"]]
    elif args.filter == "all":
        scenes = manifest
    else:
        scenes = [s for s in manifest if s["supported"]]

    os.makedirs(OUT_DIR, exist_ok=True)
    if not os.path.exists(APP):
        print(f"ERROR: {APP} not found — build the app first.")
        sys.exit(1)

    print(f"Running {len(scenes)} scene(s) at {W}x{H}...\n")
    print(f"{'id':>4}  {'slug':<40} {'status':<10} {'MAD':>7} {'cov%':>6}  note")
    print("-" * 100)
    results = []
    for s in scenes:
        r = run_scene(s, args.frames, args.timeout)
        results.append(r)
        mad_s = "" if r["mad"] is None else f"{r['mad']:.2f}"
        cov_s = "" if r["coverage"] is None else f"{r['coverage']:.1f}"
        print(f"{r['id']:>4}  {r['slug']:<40} {r['status']:<10} {mad_s:>7} {cov_s:>6}  {r['note']}")

    json.dump(results, open(os.path.join(OUT_DIR, "report.json"), "w"), indent=1)
    # Summary
    from collections import Counter
    c = Counter(r["status"] for r in results)
    print("\nsummary:", dict(c))
    compared = [r for r in results if r["status"] == "compared"]
    if compared:
        avg = sum(r["mad"] for r in compared) / len(compared)
        print(f"compared vs golden: {len(compared)}  avg MAD={avg:.2f}  "
              f"(best={min(r['mad'] for r in compared):.2f})")
    print(f"\nreport: {os.path.join(OUT_DIR, 'report.json')}")


if __name__ == "__main__":
    main()
