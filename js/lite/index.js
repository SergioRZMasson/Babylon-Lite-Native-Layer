// Babylon-Lite API mirror — bootstrap.
//
// A THIN JavaScript layer over the native C++ engine, split into modules that mirror
// Babylon-Lite's package structure (core/math/engine/scene/camera/light/mesh/material +
// loaders/{gltf,environment}). Consumers write the same code as a @babylonjs/lite web
// scene; parsing/orchestration happens in JS, rendering in C++ (bgfx). No WebGPU.
//
// Loaded as a prelude; pulls in sibling modules via __bl_require and installs the public
// API on globalThis so a separately-evaluated consumer script can see it.

(function (g) {
    "use strict";

    // Minimal browser shims so web scene code runs unchanged.
    if (typeof g.document === "undefined") {
        g.document = {
            getElementById: function () {
                return {
                    _kind: "canvas", width: 0, height: 0, dataset: {},
                    getContext: function () { return null; },
                    addEventListener: function () {}, removeEventListener: function () {},
                    getBoundingClientRect: function () { return { width: 0, height: 0, left: 0, top: 0 }; },
                    setAttribute: function () {}, style: {},
                };
            },
        };
    }
    if (typeof g.window === "undefined") { g.window = g; }
    if (typeof g.window.location === "undefined") { g.window.location = { search: "", href: "", pathname: "/" }; }
    // performance.now (Chakra has no `performance`).
    if (typeof g.performance === "undefined") {
        var _t0 = Date.now();
        g.performance = { now: function () { return Date.now() - _t0; } };
    }
    // Minimal URLSearchParams (in-box Chakra lacks it). Parses "?a=1&b=2".
    if (typeof g.URLSearchParams === "undefined") {
        g.URLSearchParams = function (q) {
            var map = {};
            if (q) {
                if (q.charAt(0) === "?") { q = q.slice(1); }
                var parts = q.split("&");
                for (var i = 0; i < parts.length; i++) {
                    if (!parts[i]) { continue; }
                    var kv = parts[i].split("=");
                    map[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || "");
                }
            }
            this.get = function (k) { return Object.prototype.hasOwnProperty.call(map, k) ? map[k] : null; };
        };
    }

    g.__BL = g.__BL || {};

    // Module load order: core + math first (others reference them at runtime).
    __bl_require("core.js");
    __bl_require("math.js");
    __bl_require("engine.js");
    __bl_require("scene.js");
    __bl_require("camera.js");
    __bl_require("light.js");
    __bl_require("mesh.js");
    __bl_require("material.js");
    __bl_require("texture.js");
    __bl_require("loaders/gltf.js");
    __bl_require("loaders/environment.js");

    // Install the public Babylon-Lite API surface on globalThis.
    const BL = g.__BL;
    const pub = [
        "createEngine", "createSceneContext", "createArcRotateCamera", "createDefaultCamera",
        "createHemisphericLight", "createDirectionalLight", "createPointLight", "createSpotLight",
        "createBox", "createSphere", "createGround",
        "createStandardMaterial", "createPbrMaterial", "createSolidTexture2D",
        "loadGltf", "loadEnvironment", "loadSkybox", "setFog",
        "setThinInstances", "setThinInstanceColors", "addToScene", "removeFromScene",
        "registerScene", "startEngine", "stopEngine",
        "attachControl", "onBeforeRender", "setParent", "createTransformNode", "mat4Compose",
    ];
    for (let i = 0; i < pub.length; i++) { if (BL[pub[i]]) { g[pub[i]] = BL[pub[i]]; } }

    if (typeof console !== "undefined" && console.log) {
        console.log("[lite] Babylon-Lite native API installed (modular)");
    }
})(globalThis);
