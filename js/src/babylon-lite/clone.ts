// Cloning helpers (mirrors Babylon's TransformNode.clone + AssetContainer mesh access).
//
// A clone is "no instancing": each cloned mesh is its own native mesh that SHARES the
// source's GPU geometry + material but bakes its own world matrix (group · sourceWorld), so
// every copy is a separate draw call. Used by the 400-BoomBox benchmark.

import { makeVec3 } from "./internal.js";
import { mat4Compose, mat4Multiply } from "./math.js";

const IDENT16 = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

// Babylon RotationYawPitchRoll(y, x, z) → quaternion (half-angle form). Clones in the
// benchmark don't rotate, but support it for parity.
function eulerToQuat(x: number, y: number, z: number): number[] {
    const hr = z * 0.5, hp = x * 0.5, hy = y * 0.5;
    const sr = Math.sin(hr), cr = Math.cos(hr);
    const sp = Math.sin(hp), cp = Math.cos(hp);
    const sy = Math.sin(hy), cy = Math.cos(hy);
    return [
        cy * sp * cr + sy * cp * sr,
        sy * cp * cr - cy * sp * sr,
        cy * cp * sr - sy * sp * cr,
        cy * cp * cr + sy * sp * sr,
    ];
}

// Clone a loaded glTF template root (container.entities[0]) into a positionable/scalable
// node. Position/scaling/rotation are applied when the clone is addToScene'd.
export function cloneTransformNode(node: any): any {
    const clone: any = {
        _kind: "clonedNode",
        _srcMeshes: node && node._srcMeshes ? node._srcMeshes : [],
        _clonedMeshIds: [],
    };
    clone.position = makeVec3(0, 0, 0, function () {});
    clone.scaling = makeVec3(1, 1, 1, function () {});
    clone.rotation = makeVec3(0, 0, 0, function () {});
    return clone;
}

// Bake a cloned node's meshes into a scene: world = group(pos,rot,scale) · sourceWorld per
// source mesh. Each baked mesh shares the source GPU buffers and is its own draw call.
export function bakeCloneInto(sceneId: number, clone: any): void {
    const q = eulerToQuat(clone.rotation.x, clone.rotation.y, clone.rotation.z);
    const g = mat4Compose(
        clone.position.x, clone.position.y, clone.position.z,
        q[0], q[1], q[2], q[3],
        clone.scaling.x, clone.scaling.y, clone.scaling.z,
    );
    const src = clone._srcMeshes;
    for (let i = 0; i < src.length; i++) {
        const world = mat4Multiply(g, src[i].world);
        const id = __bl_cloneMeshWithWorld(src[i].id, world);
        if (id >= 0) {
            __bl_addMeshToScene(sceneId, id);
            clone._clonedMeshIds.push(id);
        }
    }
}

// Babylon AssetContainer / clone-group mesh access. Two shapes are supported:
//  - the loaded glTF container (has _srcMeshes / entities): returns the template meshes
//    (with worldMatrix + container AABB) so callers can measure the model.
//  - { entities: clonedNodes }: returns the BAKED clone meshes (id only) — caster lists.
export function getContainerMeshes(container: any): any[] {
    const out: any[] = [];
    if (!container) { return out; }
    if (Array.isArray(container.entities)) {
        for (let i = 0; i < container.entities.length; i++) {
            const e = container.entities[i];
            if (e && e._clonedMeshIds && e._clonedMeshIds.length) {
                for (let k = 0; k < e._clonedMeshIds.length; k++) { out.push({ _id: e._clonedMeshIds[k] }); }
            } else if (e && e._srcMeshes) {
                for (let k = 0; k < e._srcMeshes.length; k++) {
                    out.push({ _id: e._srcMeshes[k].id, worldMatrix: IDENT16, boundMin: container.boundMin, boundMax: container.boundMax });
                }
            }
        }
        if (out.length) { return out; }
    }
    if (container._srcMeshes) {
        for (let i = 0; i < container._srcMeshes.length; i++) {
            out.push({ _id: container._srcMeshes[i].id, worldMatrix: IDENT16, boundMin: container.boundMin, boundMax: container.boundMax });
        }
    }
    return out;
}
