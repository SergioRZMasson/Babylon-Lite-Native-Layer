// Scene factory + scene assembly/lifecycle (mirrors src/scene + engine lifecycle).
(function (BL) {
    "use strict";

    BL.createSceneContext = function (/* engine */) {
        const id = __bl_createScene();
        BL._state.lastSceneId = id;
        const scene = { _id: id, _kind: "scene" };
        let _camera = null, _clear = { r: 0.05, g: 0.06, b: 0.09, a: 1 };
        Object.defineProperty(scene, "clearColor", {
            get() { return _clear; },
            set(c) { _clear = c; __bl_setClearColor(id, c.r, c.g, c.b, c.a == null ? 1 : c.a); },
        });
        Object.defineProperty(scene, "camera", {
            get() { return _camera; },
            set(cam) { _camera = cam; if (cam) { __bl_setSceneCamera(id, cam._id); } },
        });
        return scene;
    };

    BL.addToScene = function (scene, entity) {
        if (!entity) { return; }
        switch (entity._kind) {
            case "mesh": __bl_addMeshToScene(scene._id, entity._id); break;
            case "container":
                for (let i = 0; i < entity._meshIds.length; i++) { __bl_addMeshToScene(scene._id, entity._meshIds[i]); }
                break;
            case "light": __bl_setSceneLight(scene._id, entity._id); break;
            case "camera": __bl_setSceneCamera(scene._id, entity._id); break;
            default: break;
        }
    };

    BL.registerScene = function (scene) {
        const s = scene && scene._id != null ? scene._id : BL._state.lastSceneId;
        __bl_registerScene(s);
        BL._state.lastSceneId = s;
        return Promise.resolve();
    };

    BL.startEngine = function (/* engine */) {
        __bl_startEngine(BL._state.lastSceneId);
        return Promise.resolve();
    };

    BL.attachControl = function (/* camera, canvas, scene */) { /* orbit input not wired yet */ };

    // Fog: accepted + stored (native fog shading not yet implemented, so this is a
    // no-op on the render side; the scene still renders without error).
    BL.setFog = function (scene, opts) { if (scene) { scene._fog = opts || null; } };

    // Skybox / environment background: not rendered natively yet. Accept the call so
    // scenes load; meshes still render against the clear color.
    BL.loadSkybox = function (/* scene, url, ext */) { return Promise.resolve(); };

    // Per-frame hook. Babylon-Lite calls the callbacks with a frame delta (ms) before
    // each render. We route them through the host's single frame callback; the native
    // lite render loop invokes it each frame (see main.cpp lite branch).
    BL.onBeforeRender = function (scene, cb) {
        const st = BL._state;
        st.frameCbs = st.frameCbs || [];
        st.frameCbs.push(cb);
        if (!st.frameCbInstalled && typeof setFrameCallback === "function") {
            st.frameCbInstalled = true;
            setFrameCallback(function (timeMs /*, frameNo */) {
                const dt = st.lastFrameMs == null ? 16 : (timeMs - st.lastFrameMs);
                st.lastFrameMs = timeMs;
                for (let i = 0; i < st.frameCbs.length; i++) { st.frameCbs[i](dt); }
            });
        }
    };

    BL.stopEngine = function (/* engine */) { return Promise.resolve(); };

    BL.removeFromScene = function (/* scene, entity */) { /* dynamic removal not wired yet */ };

    // setParent(child, parent): mirrors Babylon's reparenting (world-preserving on the
    // native side via the mesh hierarchy).
    BL.setParent = function (child, parent) { if (child) { child.parent = parent || null; } };
})(globalThis.__BL);
