// Camera factories (mirrors src/camera). Arc-rotate + createDefaultCamera (frames from the
// loaded model bounds, like Babylon's createDefaultCamera).

import { makeVec3, state } from "./internal.js";

export function wrapCamera(id: number): any {
    const cam: any = { _id: id, _kind: "camera" };
    cam.target = makeVec3(0, 0, 0, function () { __bl_setCameraTarget(id, cam.target.x, cam.target.y, cam.target.z); });
    const def = (name: string, field: number, init: number) => {
        let v = init;
        Object.defineProperty(cam, name, { get() { return v; }, set(n) { v = n; __bl_setCameraField(id, field, n); } });
    };
    def("alpha", 0, 0); def("beta", 1, 1); def("radius", 2, 10);
    def("fov", 3, 0.8); def("nearPlane", 4, 0.1); def("farPlane", 5, 1000);
    return cam;
}

export function createArcRotateCamera(alpha: number, beta: number, radius: number, target?: { x: number; y: number; z: number }): any {
    const t = target || { x: 0, y: 0, z: 0 };
    return wrapCamera(__bl_createCamera(alpha, beta, radius, t.x, t.y, t.z));
}

export function createDefaultCamera(scene: any): any {
    const b = state.bounds;
    let cx = 0, cy = 0, cz = 0, radius = 10;
    if (b) {
        cx = (b.min[0] + b.max[0]) * 0.5; cy = (b.min[1] + b.max[1]) * 0.5; cz = (b.min[2] + b.max[2]) * 0.5;
        const ex = b.max[0] - b.min[0], ey = b.max[1] - b.min[1], ez = b.max[2] - b.min[2];
        const bsr = 0.5 * Math.sqrt(ex * ex + ey * ey + ez * ez);
        radius = bsr / Math.sin(0.8 * 0.5) * 1.1;
    }
    const id = __bl_createCamera(-Math.PI / 2, Math.PI * 0.4, radius, cx, cy, cz);
    const cam = wrapCamera(id);
    cam.nearPlane = radius * 0.01;
    cam.farPlane = radius * 10;
    __bl_setSceneCamera(scene._id, id);
    return cam;
}
