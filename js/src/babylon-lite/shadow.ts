// Shadow-generator factories (mirrors src/shadow + babylon-lite-compat shadows).
//
// The native renderer has ONE shadow path: a directional cascaded-shadow-map (CSM) atlas.
// The CSM factory maps directly; the ESM/PCF directional + spotlight factories collapse onto
// it with a single cascade so scenes that ask for those still render shadows.

import { state } from "./internal.js";

function makeGen(light: any, mapSize: number, numCascades: number, lambda: number, bias: number): any {
    const id = __bl_createShadowGen(light ? light._id : -1, mapSize, numCascades, lambda, bias);
    const gen: any = { _id: id, _kind: "shadowgen", _light: light, mapSize: mapSize };
    state.lastShadowGenId = id;
    if (light) { light.shadowGenerator = gen; }
    return gen;
}

export function createCsmDirectionalShadowGenerator(_engine: any, light: any, options?: any): any {
    const o = options || {};
    return makeGen(light, o.mapSize == null ? 2048 : o.mapSize, o.numCascades == null ? 4 : o.numCascades,
        o.lambda == null ? 0.7 : o.lambda, o.bias == null ? 0.0008 : o.bias);
}

export function createEsmDirectionalShadowGenerator(_engine: any, light: any, options?: any): any {
    const o = options || {};
    return makeGen(light, o.mapSize == null ? 1024 : o.mapSize, 1, 0.5, o.bias == null ? 0.00005 : o.bias);
}

export function createPcfDirectionalShadowGenerator(_engine: any, light: any, options?: any): any {
    const o = options || {};
    return makeGen(light, o.mapSize == null ? 1024 : o.mapSize, 1, 0.5, o.bias == null ? 0.0008 : o.bias);
}

export function createPcfSpotlightShadowGenerator(_engine: any, light: any, options?: any): any {
    const o = options || {};
    return makeGen(light, o.mapSize == null ? 512 : o.mapSize, 1, 0.5, o.bias == null ? 0.0008 : o.bias);
}

// Tell a generator which meshes cast shadows (entities or mesh wrappers carrying `_id`).
export function setShadowTaskCasterMeshes(gen: any, meshes: any[]): void {
    if (!gen || !meshes) { return; }
    const ids = new Int32Array(meshes.length);
    for (let i = 0; i < meshes.length; i++) {
        ids[i] = meshes[i] && meshes[i]._id != null ? meshes[i]._id : -1;
    }
    __bl_setShadowCasters(gen._id, ids);
}
