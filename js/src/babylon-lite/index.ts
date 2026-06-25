// Babylon-Lite API mirror — public surface.
//
// A THIN TypeScript layer over the native C++/bgfx engine, structured like Babylon-Lite's
// `@babylonjs/lite` package: consumers `import { ... } from "babylon-lite"` and write the
// same code as a web scene; parsing/orchestration happens in JS, rendering in C++. There is
// no WebGPU. Every export forwards to a `__bl_*` native function.
//
// Tree-shakable: a scene that imports only a few functions bundles only those (+ their
// transitive deps), matching Babylon-Lite's smallest-bundle goal.

export { createEngine } from "./engine.js";
export {
    createSceneContext, addToScene, registerScene, startEngine, attachControl,
    onBeforeRender, setParent, setFog, loadSkybox, stopEngine, removeFromScene,
    setCameraLimits,
} from "./scene.js";
export { createArcRotateCamera, createDefaultCamera } from "./camera.js";
export {
    createHemisphericLight, createDirectionalLight, createPointLight, createSpotLight,
} from "./light.js";
export {
    createBox, createSphere, createGround, createTorus, createTransformNode,
    setThinInstances, setThinInstanceColors,
} from "./mesh.js";
export { createStandardMaterial, createPbrMaterial, rebuildMaterial } from "./material.js";
export { createSolidTexture2D } from "./texture.js";
export {
    playAnimation, pauseAnimation, stopAnimation, goToFrame, addAnimationGroups,
} from "./animation.js";
export { mat4Compose } from "./math.js";
export { loadGltf } from "./loaders/gltf.js";
export { loadEnvironment, loadHdrEnvironment } from "./loaders/environment.js";
