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
})(globalThis.__BL);
