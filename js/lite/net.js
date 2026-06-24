// Network / asset-fetch helpers. When the XMLHttpRequest + URL polyfills are present
// (the native layer built with -DBL_POLYFILL_XMLHTTPREQUEST=ON), remote assets a scene
// references are downloaded over HTTP and cached locally, so test assets don't need to be
// present on disk up front. Without the polyfills these degrade gracefully (local-only):
// a remote asset that isn't on disk simply fails to load, exactly as before.
(function (BL) {
    "use strict";

    BL._isRemoteUrl = function (u) { return /^https?:\/\//i.test(String(u)); };

    // Resolve a (possibly relative) URL against a base. Uses the URL polyfill when present
    // (e.g. "Alien.bin" + ".../Alien/Alien.gltf" → ".../Alien/Alien.bin"); falls back to a
    // simple directory join otherwise.
    BL.resolveUrl = function (rel, base) {
        rel = String(rel);
        if (!base || rel.lastIndexOf("data:", 0) === 0 || /^[a-z][a-z0-9+.-]*:/i.test(rel)) { return rel; }
        if (typeof URL === "function") {
            try { return new URL(rel, String(base)).href; } catch (e) { /* fall through */ }
        }
        const b = String(base);
        const i = b.lastIndexOf("/");
        return i >= 0 ? b.slice(0, i + 1) + rel : rel;
    };

    // GET a URL as an ArrayBuffer through the XMLHttpRequest polyfill.
    BL.httpGetArrayBuffer = function (url) {
        return new Promise(function (resolve, reject) {
            if (typeof XMLHttpRequest !== "function") {
                reject(new Error("XMLHttpRequest unavailable (build with -DBL_POLYFILL_XMLHTTPREQUEST=ON)"));
                return;
            }
            const xhr = new XMLHttpRequest();
            xhr.open("GET", String(url));
            xhr.responseType = "arraybuffer";
            xhr.addEventListener("readystatechange", function () {
                if (xhr.readyState !== 4) { return; }
                if (xhr.status >= 200 && xhr.status < 300 && xhr.response) { resolve(xhr.response); }
                else { reject(new Error("HTTP " + xhr.status + " for " + url)); }
            });
            xhr.send();
        });
    };

    // Ensure `url` is available to the synchronous readers: if it's a remote URL not already
    // on disk / cached, download it over HTTP and write it into the asset cache (by basename),
    // so a later __bl_readFile(url) finds it. No-op for local files and data: URIs.
    BL.ensureCached = function (url) {
        url = String(url);
        if (url.lastIndexOf("data:", 0) === 0 || !BL._isRemoteUrl(url)) { return Promise.resolve(); }
        if (__bl_fileExists(url)) { return Promise.resolve(); }
        return BL.httpGetArrayBuffer(url).then(function (ab) {
            __bl_cacheFile(url, new Uint8Array(ab));
        });
    };
})(globalThis.__BL);
