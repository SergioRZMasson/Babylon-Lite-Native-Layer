// Scene factory + scene assembly/lifecycle (mirrors src/scene + engine lifecycle).

import { state } from "./internal.js";
import { bakeCloneInto } from "./clone.js";

export function createSceneContext(_engine?: any): any {
    const id = __bl_createScene();
    state.lastSceneId = id;
    const scene: any = { _id: id, _kind: "scene", animationGroups: [] };
    let _camera: any = null, _clear: any = { r: 0.05, g: 0.06, b: 0.09, a: 1 };
    Object.defineProperty(scene, "clearColor", {
        get() { return _clear; },
        set(c) { _clear = c; __bl_setClearColor(id, c.r, c.g, c.b, c.a == null ? 1 : c.a); },
    });
    Object.defineProperty(scene, "camera", {
        get() { return _camera; },
        set(cam) { _camera = cam; if (cam) { __bl_setSceneCamera(id, cam._id); } },
    });
    return scene;
}

export function addToScene(scene: any, entity: any): void {
    if (!entity) { return; }
    switch (entity._kind) {
        case "mesh": __bl_addMeshToScene(scene._id, entity._id); break;
        case "clonedNode": bakeCloneInto(scene._id, entity); break;
        case "container":
            for (let i = 0; i < entity._meshIds.length; i++) { __bl_addMeshToScene(scene._id, entity._meshIds[i]); }
            // glTF animation groups: expose on the scene and auto-play (Babylon ticks
            // loaded groups each frame; the native engine advances them in renderFrame).
            if (entity.animationGroups && entity.animationGroups.length) {
                for (let i = 0; i < entity.animationGroups.length; i++) {
                    const g = entity.animationGroups[i];
                    scene.animationGroups.push(g);
                    __bl_animControl(g._animId, 0 /* play */, 0);
                }
            }
            break;
        case "light":
            // Directional lights are the CSM "sun" (a distinct slot from the hemispheric
            // fill); everything else is the scene's primary light.
            if (entity._lightType === "directional") { __bl_setSceneSun(scene._id, entity._id); }
            else { __bl_setSceneLight(scene._id, entity._id); }
            break;
        case "camera": __bl_setSceneCamera(scene._id, entity._id); break;
        default: break;
    }
}

export function registerScene(scene: any): Promise<void> {
    const s = scene && scene._id != null ? scene._id : state.lastSceneId;
    __bl_registerScene(s);
    state.lastSceneId = s;
    return Promise.resolve();
}

// Like registerScene, but also enables CSM rendering (the last-created shadow generator
// drives the scene's sun). Mirrors Babylon-Lite's shadow-aware scene registration.
export function registerSceneWithShadowSupport(scene: any): Promise<void> {
    const s = scene && scene._id != null ? scene._id : state.lastSceneId;
    if (state.lastShadowGenId != null) { __bl_enableShadows(s, state.lastShadowGenId); }
    __bl_registerScene(s);
    state.lastSceneId = s;
    return Promise.resolve();
}

export function startEngine(_engine?: any): Promise<void> {
    __bl_startEngine(state.lastSceneId);
    return Promise.resolve();
}

export function attachControl(_camera?: any, _canvas?: any, _scene?: any): void { /* orbit input not wired yet */ }

// Fog: accepted + stored (native fog shading not yet implemented, so this is a no-op on
// the render side; the scene still renders without error).
export function setFog(scene: any, opts?: any): void { if (scene) { scene._fog = opts || null; } }

// Skybox / environment background: not rendered natively yet. Accept the call so scenes
// load; meshes still render against the clear color.
export function loadSkybox(_scene?: any, _url?: string, _ext?: any): Promise<void> { return Promise.resolve(); }

// Per-frame hook. Babylon-Lite calls the callbacks with a frame delta (ms) before each
// render. We route them through the host's single frame callback; the native lite render
// loop invokes it each frame (see main.cpp lite branch).
export function onBeforeRender(scene: any, cb: (dt: number) => void): void {
    const st = state;
    st.frameCbs = st.frameCbs || [];
    st.frameCbs.push(cb);
    if (!st.frameCbInstalled && typeof setFrameCallback === "function") {
        st.frameCbInstalled = true;
        setFrameCallback(function (timeMs: number /*, frameNo */) {
            const dt = st.lastFrameMs == null ? 16 : (timeMs - st.lastFrameMs);
            st.lastFrameMs = timeMs;
            for (let i = 0; i < st.frameCbs.length; i++) { st.frameCbs[i](dt); }
        });
    }
}

export function stopEngine(_engine?: any): Promise<void> { return Promise.resolve(); }

export function removeFromScene(_scene?: any, _entity?: any): void { /* dynamic removal not wired yet */ }

// setParent(child, parent): mirrors Babylon's reparenting (world-preserving on the native
// side via the mesh hierarchy).
export function setParent(child: any, parent: any): void { if (child) { child.parent = parent || null; } }

// Camera orbit/zoom limits: accepted + stored (the native arc-rotate camera doesn't enforce
// limits yet, and orbit input isn't wired, so this is a no-op). Lets scenes that call
// setCameraLimits load + render.
export function setCameraLimits(camera: any, limits: any, _scene?: any): void { if (camera) { camera._limits = limits || null; } }
