// Mesh factories (mirrors src/mesh). Primitive geometry is generated natively.

import { makeVec3 } from "./internal.js";

export function wrapMesh(id: number): any {
    const mesh: any = { _id: id, _kind: "mesh" };
    let _material: any = null;
    function sync() {
        __bl_setMeshTransform(id, mesh.position.x, mesh.position.y, mesh.position.z,
            mesh.rotation.x, mesh.rotation.y, mesh.rotation.z,
            mesh.scaling.x, mesh.scaling.y, mesh.scaling.z);
    }
    mesh.position = makeVec3(0, 0, 0, sync);
    mesh.rotation = makeVec3(0, 0, 0, sync);
    mesh.scaling = makeVec3(1, 1, 1, sync);
    Object.defineProperty(mesh, "material", {
        get() { return _material; },
        set(m) { _material = m; if (m) { __bl_setMeshMaterial(id, m._id); } },
    });
    Object.defineProperty(mesh, "parent", {
        get() { return mesh._parent || null; },
        set(p) { mesh._parent = p; __bl_setParent(id, p ? p._id : -1); },
    });
    return mesh;
}

export function createBox(_engine: any, size?: number): any { return wrapMesh(__bl_createBox(size == null ? 1 : size)); }

export function createSphere(_engine: any, options?: any): any {
    const o = options || {};
    return wrapMesh(__bl_createSphere(o.diameter == null ? 1 : o.diameter, o.segments == null ? 16 : o.segments));
}

export function createGround(_engine: any, options?: any): any {
    const o = options || {};
    return wrapMesh(__bl_createGround(o.width == null ? 1 : o.width, o.height == null ? 1 : o.height));
}

export function createTorus(_engine: any, options?: any): any {
    const o = options || {};
    return wrapMesh(__bl_createTorus(
        o.diameter == null ? 1 : o.diameter,
        o.thickness == null ? 0.5 : o.thickness,
        o.tessellation == null ? 16 : o.tessellation));
}

export function setThinInstances(mesh: any, matrices: Float32Array, count: number): void { __bl_setThinInstances(mesh._id, matrices, count); }

// Per-instance colors for thin instances: accepted + stored (native per-instance color is
// not wired yet, so this is render-inert for now).
export function setThinInstanceColors(mesh: any, colors: any): void { if (mesh) { mesh._thinColors = colors; } }

// A bare transform node (no geometry) for grouping/parenting. Backed by an empty native
// mesh entry so setParent + transforms compose; it never draws.
export function createTransformNode(_name?: string): any {
    const node = wrapMesh(__bl_createBox(0));
    node._kind = "transform";
    return node;
}
