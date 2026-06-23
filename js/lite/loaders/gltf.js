// glTF / GLB loader — JavaScript, mirroring Babylon-Lite's loader-gltf logic
// (gltf-glb-parser.ts, gltf-parser.ts, gltf-material.ts). It PARSES in JS and hands
// plain geometry/material/texture data to C++ (__bl_* seam); C++ only uploads + renders.
//
// Supports the core needed for the scene1 BoomBox: GLB container, accessors (with
// byteStride de-stride + normalized integers), metallic-roughness materials, embedded
// PNG/JPEG textures, node hierarchy, and the Babylon RH→LH root (diag(-1,1,1)).
(function (BL) {
    "use strict";

    const COMP_SIZE = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
    const TYPE_COUNT = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };

    // Babylon.js RH→LH root: rotation 180° about Y + scale(1,1,-1) = diag(-1,1,1).
    const RH_TO_LH_ROOT = new Float32Array([-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

    function parseGlb(ab) {
        const dv = new DataView(ab);
        if (dv.getUint32(0, true) !== 0x46546c67) { throw new Error("Not a valid GLB file"); }
        let off = 12;
        const jsonLen = dv.getUint32(off, true);
        if (dv.getUint32(off + 4, true) !== 0x4e4f534a) { throw new Error("First GLB chunk is not JSON"); }
        const jsonStr = BL.utf8Decode(new Uint8Array(ab, off + 8, jsonLen));
        const json = JSON.parse(jsonStr);
        off += 8 + jsonLen;
        // BIN chunk
        if (dv.getUint32(off + 4, true) !== 0x004e4942) { throw new Error("Second GLB chunk is not BIN"); }
        const binOff = off + 8;
        return { json, dv, binOff };
    }

    // Read an accessor into a Float32Array (honors byteStride + normalized integers).
    function readAccessor(json, dv, binOff, accIdx) {
        const acc = json.accessors[accIdx];
        const comp = TYPE_COUNT[acc.type] || 1;
        const out = new Float32Array(acc.count * comp);
        if (acc.bufferView === undefined) { return out; }
        const bv = json.bufferViews[acc.bufferView];
        const cs = COMP_SIZE[acc.componentType];
        const base = binOff + (bv.byteOffset || 0) + (acc.byteOffset || 0);
        const stride = bv.byteStride || comp * cs;
        const norm = acc.normalized;
        for (let i = 0; i < acc.count; i++) {
            const e = base + i * stride;
            for (let c = 0; c < comp; c++) {
                const o = e + c * cs;
                let v;
                switch (acc.componentType) {
                    case 5126: v = dv.getFloat32(o, true); break;
                    case 5125: v = dv.getUint32(o, true); break;
                    case 5123: v = dv.getUint16(o, true); if (norm) { v /= 65535; } break;
                    case 5121: v = dv.getUint8(o); if (norm) { v /= 255; } break;
                    case 5122: v = dv.getInt16(o, true); if (norm) { v = Math.max(v / 32767, -1); } break;
                    case 5120: v = dv.getInt8(o); if (norm) { v = Math.max(v / 127, -1); } break;
                    default: v = 0;
                }
                out[i * comp + c] = v;
            }
        }
        return out;
    }

    function readIndices(json, dv, binOff, accIdx) {
        const acc = json.accessors[accIdx];
        const out = new Uint32Array(acc.count);
        const bv = json.bufferViews[acc.bufferView];
        const cs = COMP_SIZE[acc.componentType];
        const base = binOff + (bv.byteOffset || 0) + (acc.byteOffset || 0);
        for (let i = 0; i < acc.count; i++) {
            const o = base + i * cs;
            out[i] = acc.componentType === 5125 ? dv.getUint32(o, true) : (acc.componentType === 5123 ? dv.getUint16(o, true) : dv.getUint8(o));
        }
        return out;
    }

    function buildParentMap(json) {
        const map = {};
        const nodes = json.nodes || [];
        for (let i = 0; i < nodes.length; i++) {
            const ch = nodes[i].children;
            if (ch) { for (let k = 0; k < ch.length; k++) { map[ch[k]] = i; } }
        }
        return map;
    }

    function nodeLocal(node) {
        if (node.matrix) { return new Float32Array(node.matrix); }
        const t = node.translation || [0, 0, 0];
        const r = node.rotation || [0, 0, 0, 1];
        const s = node.scale || [1, 1, 1];
        return BL.mat4Compose(t[0], t[1], t[2], r[0], r[1], r[2], r[3], s[0], s[1], s[2]);
    }

    function nodeWorld(json, idx, parentMap, cache) {
        if (cache[idx]) { return cache[idx]; }
        const parentIdx = parentMap[idx] == null ? -1 : parentMap[idx];
        const parentWorld = parentIdx !== -1 ? nodeWorld(json, parentIdx, parentMap, cache) : RH_TO_LH_ROOT;
        const world = BL.mat4Multiply(parentWorld, nodeLocal(json.nodes[idx]));
        cache[idx] = world;
        return world;
    }

    BL.loadGltf = function (engine, url) {
        const ab = __bl_readFile(String(url));
        if (!ab) { throw new Error("loadGltf: cannot read " + url); }
        const { json, dv, binOff } = parseGlb(ab);
        const parentMap = buildParentMap(json);
        const worldCache = {};
        const texCache = {};

        function texFor(texIndex) {
            if (texIndex == null) { return -1; }
            const tex = json.textures[texIndex];
            const imgIdx = (tex.extensions && tex.extensions.EXT_texture_webp && tex.extensions.EXT_texture_webp.source != null)
                ? tex.extensions.EXT_texture_webp.source : tex.source;
            if (texCache[imgIdx] != null) { return texCache[imgIdx]; }
            const image = json.images[imgIdx];
            let id = -1;
            if (image && image.bufferView != null) {
                const bv = json.bufferViews[image.bufferView];
                const bytes = new Uint8Array(ab, binOff + (bv.byteOffset || 0), bv.byteLength);
                id = __bl_createTextureEncoded(bytes);
            }
            texCache[imgIdx] = id;
            return id;
        }

        function buildMaterial(matIdx) {
            const id = __bl_createPbrMaterial();
            const gm = (matIdx != null && json.materials) ? json.materials[matIdx] : null;
            let bc = [1, 1, 1, 1], met = 1, rough = 1, occStr = 1, aCut = 0, em = [0, 0, 0];
            let tB = -1, tMR = -1, tN = -1, tE = -1, tO = -1;
            if (gm) {
                const pr = gm.pbrMetallicRoughness || {};
                if (pr.baseColorFactor) { bc = pr.baseColorFactor; }
                if (pr.metallicFactor != null) { met = pr.metallicFactor; }
                if (pr.roughnessFactor != null) { rough = pr.roughnessFactor; }
                if (pr.baseColorTexture) { tB = texFor(pr.baseColorTexture.index); }
                if (pr.metallicRoughnessTexture) { tMR = texFor(pr.metallicRoughnessTexture.index); }
                if (gm.emissiveFactor) { em = gm.emissiveFactor; }
                const es = gm.extensions && gm.extensions.KHR_materials_emissive_strength;
                if (es && es.emissiveStrength != null) { em = [em[0] * es.emissiveStrength, em[1] * es.emissiveStrength, em[2] * es.emissiveStrength]; }
                if (gm.emissiveTexture) { tE = texFor(gm.emissiveTexture.index); }
                if (gm.normalTexture) { tN = texFor(gm.normalTexture.index); }
                if (gm.occlusionTexture) { tO = texFor(gm.occlusionTexture.index); if (gm.occlusionTexture.strength != null) { occStr = gm.occlusionTexture.strength; } }
                if (gm.alphaCutoff != null) { aCut = gm.alphaCutoff; }
            }
            __bl_setPbrMaterial(id, bc[0], bc[1], bc[2], bc[3], met, rough, occStr, aCut, em[0], em[1], em[2], tB, tMR, tN, tE, tO);
            return id;
        }

        const meshIds = [];
        const nodes = json.nodes || [];
        for (let ni = 0; ni < nodes.length; ni++) {
            const node = nodes[ni];
            if (node.mesh == null) { continue; }
            const world = nodeWorld(json, ni, parentMap, worldCache);
            const mesh = json.meshes[node.mesh];
            for (let pi = 0; pi < mesh.primitives.length; pi++) {
                const prim = mesh.primitives[pi];
                if (prim.mode != null && prim.mode !== 4) { continue; } // triangles only
                const attr = prim.attributes;
                if (attr.POSITION == null) { continue; }
                const pos = readAccessor(json, dv, binOff, attr.POSITION);
                const nVerts = pos.length / 3;
                const nrm = attr.NORMAL != null ? readAccessor(json, dv, binOff, attr.NORMAL) : new Float32Array(nVerts * 3);
                const uv = attr.TEXCOORD_0 != null ? readAccessor(json, dv, binOff, attr.TEXCOORD_0) : new Float32Array(nVerts * 2);
                const tan = attr.TANGENT != null ? readAccessor(json, dv, binOff, attr.TANGENT) : new Float32Array(nVerts * 4);
                let idx;
                if (prim.indices != null) {
                    idx = readIndices(json, dv, binOff, prim.indices);
                } else {
                    idx = new Uint32Array(nVerts);
                    for (let i = 0; i < nVerts; i++) { idx[i] = i; }
                }
                // Reverse winding to compensate the RH→LH mirror (keeps CULL_CCW correct).
                for (let i = 0; i + 2 < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }

                const meshId = __bl_createMeshPBR(pos, nrm, uv, tan, idx);
                __bl_setMeshMatrix(meshId, world);
                __bl_setMeshMaterial(meshId, buildMaterial(prim.material));
                meshIds.push(meshId);

                // Bounds: transform the accessor AABB corners by the node world matrix.
                const acc = json.accessors[attr.POSITION];
                if (acc.min && acc.max) {
                    for (let cx = 0; cx < 2; cx++) {
                        for (let cy = 0; cy < 2; cy++) {
                            for (let cz = 0; cz < 2; cz++) {
                                const p = BL.mat4TransformPoint(world,
                                    cx ? acc.max[0] : acc.min[0],
                                    cy ? acc.max[1] : acc.min[1],
                                    cz ? acc.max[2] : acc.min[2]);
                                BL._growBounds(p[0], p[1], p[2]);
                            }
                        }
                    }
                }
            }
        }
        return Promise.resolve({ _kind: "container", _meshIds: meshIds });
    };
})(globalThis.__BL);
