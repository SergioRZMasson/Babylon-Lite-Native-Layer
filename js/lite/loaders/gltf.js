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
    // `buffers` is an array of { dv, base } (one per glTF buffer); GLB has a single one.
    function readAccessor(json, buffers, accIdx) {
        const acc = json.accessors[accIdx];
        const comp = TYPE_COUNT[acc.type] || 1;
        const out = new Float32Array(acc.count * comp);
        if (acc.bufferView === undefined) { return out; }
        const bv = json.bufferViews[acc.bufferView];
        const buf = buffers[bv.buffer || 0];
        const dv = buf.dv;
        const cs = COMP_SIZE[acc.componentType];
        const base = buf.base + (bv.byteOffset || 0) + (acc.byteOffset || 0);
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

    // Read an integer accessor (indices or JOINTS_0) into a Uint32Array.
    function readIntAccessor(json, buffers, accIdx) {
        const acc = json.accessors[accIdx];
        const comp = TYPE_COUNT[acc.type] || 1;
        const out = new Uint32Array(acc.count * comp);
        const bv = json.bufferViews[acc.bufferView];
        const buf = buffers[bv.buffer || 0];
        const dv = buf.dv;
        const cs = COMP_SIZE[acc.componentType];
        const base = buf.base + (bv.byteOffset || 0) + (acc.byteOffset || 0);
        const stride = bv.byteStride || comp * cs;
        for (let i = 0; i < acc.count; i++) {
            const e = base + i * stride;
            for (let c = 0; c < comp; c++) {
                const o = e + c * cs;
                out[i * comp + c] = acc.componentType === 5125 ? dv.getUint32(o, true)
                    : (acc.componentType === 5123 ? dv.getUint16(o, true) : dv.getUint8(o));
            }
        }
        return out;
    }

    function readIndices(json, buffers, accIdx) {
        return readIntAccessor(json, buffers, accIdx);
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

    // Decompose a glTF node's TRS for the native node graph. If the node uses a `matrix`,
    // extract translation + quaternion + scale from it (glTF guarantees TRS-decomposable).
    function nodeTRS(node) {
        if (node.matrix) { return BL.decomposeMat4(node.matrix); }
        return {
            t: node.translation || [0, 0, 0],
            r: node.rotation || [0, 0, 0, 1],
            s: node.scale || [1, 1, 1],
        };
    }

    // Create the full node graph natively (in glTF node order so channels/meshes can
    // reference nodes by index). Returns the parent map (used for bounds).
    function buildNativeNodes(json, parentMap) {
        const nodes = json.nodes || [];
        for (let i = 0; i < nodes.length; i++) {
            const trs = nodeTRS(nodes[i]);
            const p = parentMap[i] == null ? -1 : parentMap[i];
            __bl_createNode(p, trs.t[0], trs.t[1], trs.t[2],
                trs.r[0], trs.r[1], trs.r[2], trs.r[3], trs.s[0], trs.s[1], trs.s[2]);
        }
    }

    // Parse glTF animations into native clips. Returns an array of AnimationGroup objects.
    function parseAnimations(json, buffers, nodeBase) {
        const out = [];
        const anims = json.animations || [];
        const INTERP = { LINEAR: 0, STEP: 1, CUBICSPLINE: 2 };
        const PATH = { translation: 0, rotation: 1, scale: 2, weights: 3 };
        for (let a = 0; a < anims.length; a++) {
            const anim = anims[a];
            const animId = __bl_createAnimation(anim.name || ("anim" + a), 60);
            for (let si = 0; si < anim.samplers.length; si++) {
                const samp = anim.samplers[si];
                const input = readAccessor(json, buffers, samp.input);   // keyframe times
                const output = readAccessor(json, buffers, samp.output); // values
                const outAcc = json.accessors[samp.output];
                const comp = TYPE_COUNT[outAcc.type] || 1;
                __bl_addAnimSampler(animId, input, output, comp, INTERP[samp.interpolation] == null ? 0 : INTERP[samp.interpolation]);
            }
            for (let ci = 0; ci < anim.channels.length; ci++) {
                const ch = anim.channels[ci];
                if (ch.target.node == null) { continue; }
                const path = PATH[ch.target.path];
                if (path == null) { continue; }
                __bl_addAnimChannel(animId, nodeBase + ch.target.node, path, ch.sampler);
            }
            out.push({ _kind: "animationGroup", _animId: animId, name: anim.name || ("anim" + a) });
        }
        return out;
    }

    // Build the buffers[] array: GLB embedded BIN, data-URI, or external .bin (relative
    // to the .gltf, resolved via __bl_readFile's basename/assets fallback).
    function loadBuffers(json, glb) {
        const list = json.buffers || [];
        const buffers = [];
        for (let i = 0; i < list.length; i++) {
            const b = list[i];
            if (!b.uri) {
                buffers.push({ dv: glb.dv, base: glb.binOff }); // GLB embedded BIN chunk
            } else if (b.uri.lastIndexOf("data:", 0) === 0) {
                const bytes = BL.base64ToBytes(b.uri.slice(b.uri.indexOf(",") + 1));
                buffers.push({ dv: new DataView(bytes.buffer), base: 0 });
            } else {
                const binAb = __bl_readFile(decodeURIComponent(b.uri));
                if (!binAb) { throw new Error("loadGltf: cannot read buffer " + b.uri); }
                buffers.push({ dv: new DataView(binAb), base: 0 });
            }
        }
        return buffers;
    }

    // Build a native skin (joints offset by nodeBase + inverse bind matrices). Cached per
    // glTF skin index. Returns the native skin id.
    function buildSkin(json, buffers, skinIdx, nodeBase, skinCache) {
        if (skinCache[skinIdx] != null) { return skinCache[skinIdx]; }
        const skin = json.skins[skinIdx];
        const joints = new Uint32Array(skin.joints.length);
        for (let i = 0; i < skin.joints.length; i++) { joints[i] = nodeBase + skin.joints[i]; }
        let ibm;
        if (skin.inverseBindMatrices != null) {
            ibm = readAccessor(json, buffers, skin.inverseBindMatrices); // 16 * jointCount
        } else {
            ibm = new Float32Array(skin.joints.length * 16);
            for (let i = 0; i < skin.joints.length; i++) { ibm[i * 16] = ibm[i * 16 + 5] = ibm[i * 16 + 10] = ibm[i * 16 + 15] = 1; }
        }
        const id = __bl_createSkin(joints, ibm);
        skinCache[skinIdx] = id;
        return id;
    }

    // Compute smooth vertex normals from positions + indices (glTF allows omitting
    // NORMAL; Babylon generates them). Uses the original winding (pre RH→LH reversal).
    function computeNormals(pos, idx) {
        const n = new Float32Array(pos.length);
        for (let i = 0; i + 2 < idx.length; i += 3) {
            const a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3;
            const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
            const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
            const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
            n[a] += nx; n[a + 1] += ny; n[a + 2] += nz;
            n[b] += nx; n[b + 1] += ny; n[b + 2] += nz;
            n[c] += nx; n[c + 1] += ny; n[c + 2] += nz;
        }
        for (let i = 0; i < n.length; i += 3) {
            const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1;
            n[i] /= l; n[i + 1] /= l; n[i + 2] /= l;
        }
        return n;
    }

    BL.loadGltf = function (engine, url) {
        const u = String(url);
        const raw = __bl_readFile(u);
        if (!raw) { throw new Error("loadGltf: cannot read " + url); }
        const isGltf = /\.gltf(\?|$)/i.test(u);
        let json, glb = null;
        if (isGltf) {
            json = JSON.parse(BL.utf8Decode(new Uint8Array(raw)));
        } else {
            const p = parseGlb(raw);
            json = p.json; glb = { dv: p.dv, binOff: p.binOff };
        }
        const buffers = loadBuffers(json, glb);
        const parentMap = buildParentMap(json);
        const worldCache = {};
        const texCache = {};
        const skinCache = {};

        // Native node graph (offset by the current node count so multiple loads don't clash).
        const nodeBase = __bl_nodeCount();
        const nodes = json.nodes || [];
        for (let i = 0; i < nodes.length; i++) {
            const trs = nodeTRS(nodes[i]);
            const p = parentMap[i] == null ? -1 : (nodeBase + parentMap[i]);
            __bl_createNode(p, trs.t[0], trs.t[1], trs.t[2],
                trs.r[0], trs.r[1], trs.r[2], trs.r[3], trs.s[0], trs.s[1], trs.s[2]);
        }

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
                const buf = buffers[bv.buffer || 0];
                const bytes = new Uint8Array(buf.dv.buffer, buf.dv.byteOffset + buf.base + (bv.byteOffset || 0), bv.byteLength);
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
        for (let ni = 0; ni < nodes.length; ni++) {
            const node = nodes[ni];
            if (node.mesh == null) { continue; }
            const world = nodeWorld(json, ni, parentMap, worldCache); // for bounds (rest pose)
            const mesh = json.meshes[node.mesh];
            for (let pi = 0; pi < mesh.primitives.length; pi++) {
                const prim = mesh.primitives[pi];
                if (prim.mode != null && prim.mode !== 4) { continue; } // triangles only
                const attr = prim.attributes;
                if (attr.POSITION == null) { continue; }
                const pos = readAccessor(json, buffers, attr.POSITION);
                const nVerts = pos.length / 3;
                const uv = attr.TEXCOORD_0 != null ? readAccessor(json, buffers, attr.TEXCOORD_0) : new Float32Array(nVerts * 2);
                const tan = attr.TANGENT != null ? readAccessor(json, buffers, attr.TANGENT) : new Float32Array(nVerts * 4);
                let idx;
                if (prim.indices != null) {
                    idx = readIndices(json, buffers, prim.indices);
                } else {
                    idx = new Uint32Array(nVerts);
                    for (let i = 0; i < nVerts; i++) { idx[i] = i; }
                }
                // Normals: read if present, else generate from geometry (uses original winding).
                const nrm = attr.NORMAL != null ? readAccessor(json, buffers, attr.NORMAL) : computeNormals(pos, idx);
                // Reverse winding to compensate the RH→LH mirror (keeps CULL_CCW correct).
                for (let i = 0; i + 2 < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }

                // Skinned primitive (skeleton): build a skinned mesh + bind the skin so the
                // native engine computes the bone palette each frame (GPU skinning).
                const skinned = node.skin != null && attr.JOINTS_0 != null && attr.WEIGHTS_0 != null;
                let meshId;
                if (skinned) {
                    const joints = readIntAccessor(json, buffers, attr.JOINTS_0);   // Uint32 vec4/vertex
                    const wts = readAccessor(json, buffers, attr.WEIGHTS_0);        // Float32 vec4/vertex
                    meshId = __bl_createMeshSkinnedPBR(pos, nrm, uv, tan, joints, wts, idx);
                    const skinId = buildSkin(json, buffers, node.skin, nodeBase, skinCache);
                    __bl_setMeshSkin(meshId, skinId);
                } else {
                    meshId = __bl_createMeshPBR(pos, nrm, uv, tan, idx);
                }
                __bl_setMeshNode(meshId, nodeBase + ni);   // mesh world follows its node
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

        // Animations (orchestrated natively) — channels reference glTF node indices, offset
        // by nodeBase to match the native node graph.
        const animationGroups = parseAnimations(json, buffers, nodeBase);
        return Promise.resolve({ _kind: "container", _meshIds: meshIds, animationGroups: animationGroups });
    };
})(globalThis.__BL);
