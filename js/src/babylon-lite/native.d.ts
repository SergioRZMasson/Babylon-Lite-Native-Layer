// Ambient declarations for the native seam and host-provided browser globals.
//
// The Babylon-Lite mirror is a THIN TypeScript layer: every factory/setter forwards to a
// `__bl_*` function implemented in C++ (src/lite.cpp) and exposed on the global object by
// the JS host. The host also installs a few browser-like globals (document/window/
// performance, console, and — via the URL polyfill — URL/URLSearchParams) so web-style
// scene code runs unchanged. These declarations give the TypeScript compiler the shape of
// that runtime; esbuild simply strips them.

export {};

declare global {
    // ---- Native seam (C++ / bgfx). Args are numbers or typed arrays; ids are integers. ----
    // engine / scene / lifecycle
    function __bl_createScene(): number;
    function __bl_registerScene(sceneId: number): void;
    function __bl_startEngine(sceneId: number): void;
    function __bl_setClearColor(sceneId: number, r: number, g: number, b: number, a: number): void;
    function __bl_setSceneCamera(sceneId: number, cameraId: number): void;
    function __bl_setSceneLight(sceneId: number, lightId: number): void;
    function __bl_addMeshToScene(sceneId: number, meshId: number): void;

    // camera
    function __bl_createCamera(alpha: number, beta: number, radius: number, tx: number, ty: number, tz: number): number;
    function __bl_setCameraField(cameraId: number, field: number, value: number): void;
    function __bl_setCameraTarget(cameraId: number, x: number, y: number, z: number): void;

    // light
    function __bl_createLight(dx: number, dy: number, dz: number, intensity: number): number;
    function __bl_setLight(id: number, dx: number, dy: number, dz: number, intensity: number, dr: number, dg: number, db: number, gr: number, gg: number, gb: number): void;

    // primitives + mesh
    function __bl_createBox(size: number): number;
    function __bl_createSphere(diameter: number, segments: number): number;
    function __bl_createGround(width: number, height: number): number;
    function __bl_createTorus(diameter: number, thickness: number, tessellation: number): number;
    function __bl_setMeshTransform(id: number, px: number, py: number, pz: number, rx: number, ry: number, rz: number, sx: number, sy: number, sz: number): void;
    function __bl_setMeshMaterial(meshId: number, materialId: number): void;
    function __bl_setMeshNode(meshId: number, nodeId: number): void;
    function __bl_setMeshSkin(meshId: number, skinId: number): void;
    function __bl_setParent(meshId: number, parentMeshId: number): void;
    function __bl_setThinInstances(meshId: number, matrices: Float32Array, count: number): void;

    // glTF mesh creation (typed-array vertex/index streams)
    function __bl_createMeshPBR(pos: Float32Array, nrm: Float32Array, uv: Float32Array, tan: Float32Array, idx: Uint32Array): number;
    function __bl_createMeshSkinnedPBR(pos: Float32Array, nrm: Float32Array, uv: Float32Array, tan: Float32Array, joints: Uint32Array, weights: Float32Array, idx: Uint32Array): number;
    function __bl_createMeshMorphPBR(pos: Float32Array, nrm: Float32Array, uv: Float32Array, tan: Float32Array, idx: Uint32Array, targetCount: number, dPos: Float32Array, dNrm: Float32Array): number;
    function __bl_createMeshMorphSkinnedPBR(pos: Float32Array, nrm: Float32Array, uv: Float32Array, tan: Float32Array, joints: Uint32Array, weights: Float32Array, idx: Uint32Array, targetCount: number, dPos: Float32Array, dNrm: Float32Array): number;

    // material + texture
    function __bl_createStandardMaterial(): number;
    function __bl_setMaterial(id: number, dr: number, dg: number, db: number, alpha: number, sr: number, sg: number, sb: number, specularPower: number): void;
    function __bl_createPbrMaterial(): number;
    function __bl_setPbrMaterial(id: number, br: number, bg: number, bb: number, alpha: number, metallic: number, roughness: number, occlusionStrength: number, alphaCutoff: number, er: number, eg: number, eb: number, texBase: number, texMR: number, texNormal: number, texEmissive: number, texOcclusion: number): void;
    function __bl_createSolidTexture(r: number, g: number, b: number): number;
    function __bl_createTextureEncoded(bytes: Uint8Array): number;

    // animation node graph + clips
    function __bl_nodeCount(): number;
    function __bl_createNode(parent: number, tx: number, ty: number, tz: number, rx: number, ry: number, rz: number, rw: number, sx: number, sy: number, sz: number): number;
    function __bl_setNodeWeights(nodeId: number, weights: Float32Array): void;
    function __bl_createSkin(joints: Uint32Array, inverseBindMatrices: Float32Array): number;
    function __bl_createAnimation(name: string, fps: number): number;
    function __bl_addAnimSampler(animId: number, input: Float32Array, output: Float32Array, comp: number, interp: number): number;
    function __bl_addAnimChannel(animId: number, targetNode: number, path: number, sampler: number): void;
    function __bl_animControl(animId: number, op: number, arg: number): void;
    function __bl_setAnimLoop(animId: number, loop: number): void;

    // environment / IBL
    function __bl_createEnvironment(faceSize: number, mips: number): void;
    function __bl_setEnvFace(mip: number, face: number, png: Uint8Array): void;
    function __bl_setEnvSH(sh: Float32Array): void;
    function __bl_setEnvParams(intensity: number, exposure: number, lodScale: number, contrast: number): void;

    // file IO / HTTP-cache seam
    function __bl_readFile(path: string): ArrayBuffer | null;
    function __bl_fileExists(path: string): boolean;
    function __bl_cacheFile(name: string, bytes: Uint8Array): boolean;

    // host frame callback (per-frame onBeforeRender driver)
    function setFrameCallback(cb: (timeMs: number, frameNo: number) => void): void;

    // ---- Host-provided browser-like globals (installed by the JS host) ----
    const document: {
        getElementById(id: string): any;
        [k: string]: any;
    };
    const window: any;
    const performance: { now(): number };
    const console: { log(...a: any[]): void; info(...a: any[]): void; warn(...a: any[]): void; error(...a: any[]): void; debug(...a: any[]): void };
    class TextDecoder { decode(bytes?: any): string; }
    class URL { constructor(url: string, base?: string); href: string; hostname: string; port: string; pathname: string; search: string; }    class URLSearchParams { constructor(q?: string); get(k: string): string | null; has(k: string): boolean; }
    class XMLHttpRequest {
        open(method: string, url: string): void;
        send(): void;
        responseType: string;
        readyState: number;
        status: number;
        response: any;
        addEventListener(type: string, cb: () => void): void;
    }
}
