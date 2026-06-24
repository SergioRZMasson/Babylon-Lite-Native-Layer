// Mesh factories (mirrors src/mesh). Primitive geometry is generated natively.
(function (BL) {
    "use strict";

    function wrapMesh(id) {
        const mesh = { _id: id, _kind: "mesh" };
        let _material = null;
        function sync() {
            __bl_setMeshTransform(id, mesh.position.x, mesh.position.y, mesh.position.z,
                mesh.rotation.x, mesh.rotation.y, mesh.rotation.z,
                mesh.scaling.x, mesh.scaling.y, mesh.scaling.z);
        }
        mesh.position = BL.makeVec3(0, 0, 0, sync);
        mesh.rotation = BL.makeVec3(0, 0, 0, sync);
        mesh.scaling = BL.makeVec3(1, 1, 1, sync);
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
    BL._wrapMesh = wrapMesh;

    BL.createBox = function (engine, size) { return wrapMesh(__bl_createBox(size == null ? 1 : size)); };
    BL.createSphere = function (engine, options) {
        const o = options || {};
        return wrapMesh(__bl_createSphere(o.diameter == null ? 1 : o.diameter, o.segments == null ? 16 : o.segments));
    };
    BL.createGround = function (engine, options) {
        const o = options || {};
        return wrapMesh(__bl_createGround(o.width == null ? 1 : o.width, o.height == null ? 1 : o.height));
    };
    BL.createTorus = function (engine, options) {
        const o = options || {};
        return wrapMesh(__bl_createTorus(
            o.diameter == null ? 1 : o.diameter,
            o.thickness == null ? 0.5 : o.thickness,
            o.tessellation == null ? 16 : o.tessellation));
    };
    BL.setThinInstances = function (mesh, matrices, count) { __bl_setThinInstances(mesh._id, matrices, count); };

    // Per-instance colors for thin instances: accepted + stored (native per-instance
    // color is not wired yet, so this is render-inert for now).
    BL.setThinInstanceColors = function (mesh, colors) { if (mesh) { mesh._thinColors = colors; } };

    // A bare transform node (no geometry) for grouping/parenting. Backed by an empty
    // native mesh entry so setParent + transforms compose; it never draws.
    BL.createTransformNode = function (/* name */) {
        const node = BL._wrapMesh(__bl_createBox(0));
        node._kind = "transform";
        return node;
    };
})(globalThis.__BL);
