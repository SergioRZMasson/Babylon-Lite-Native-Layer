// Babylon-Lite consumer demo — primitives, materials, and thin instances. Written exactly
// like a Babylon-Lite web scene; renders through native C++/bgfx, zero WebGPU.

import { createEngine, createSceneContext, createArcRotateCamera, attachControl, addToScene, createHemisphericLight, createGround, createStandardMaterial, createBox, createSphere, mat4Compose, setThinInstances, registerScene, startEngine } from "babylon-lite";

async function main() {
    const canvas = document.getElementById("renderCanvas");

    const engine = await createEngine(canvas);
    const scene = createSceneContext(engine);
    scene.clearColor = { r: 0.05, g: 0.06, b: 0.09, a: 1 };

    const camera = createArcRotateCamera(Math.PI * 0.35, Math.PI * 0.4, 22, { x: 0, y: 1.5, z: 0 });
    camera.farPlane = 300;
    scene.camera = camera;
    attachControl(camera, canvas, scene);

    addToScene(scene, createHemisphericLight([0.4, 1, 0.25], 0.95));

    // Ground
    const ground = createGround(engine, { width: 48, height: 48 });
    const groundMat = createStandardMaterial();
    groundMat.diffuseColor.set(0.24, 0.27, 0.31);
    groundMat.specularColor.set(0.05, 0.05, 0.05);
    ground.material = groundMat;
    addToScene(scene, ground);

    // A red box
    const box = createBox(engine, 2.5);
    box.position.set(-3.5, 1.4, 0);
    box.rotation.set(0, Math.PI * 0.18, 0);
    const boxMat = createStandardMaterial();
    boxMat.diffuseColor.set(0.85, 0.2, 0.2);
    box.material = boxMat;
    addToScene(scene, box);

    // A blue sphere
    const sphere = createSphere(engine, { diameter: 2.8, segments: 32 });
    sphere.position.set(3.5, 1.5, 0);
    const sphMat = createStandardMaterial();
    sphMat.diffuseColor.set(0.2, 0.5, 0.85);
    sphMat.specularColor.set(0.6, 0.6, 0.6);
    sphMat.specularPower = 96;
    sphere.material = sphMat;
    addToScene(scene, sphere);

    // A ring of thin-instanced gold pillars
    const pillar = createBox(engine, 1.0);
    const pillarMat = createStandardMaterial();
    pillarMat.diffuseColor.set(0.9, 0.72, 0.2);
    pillar.material = pillarMat;
    const COUNT = 28;
    const instances = new Float32Array(COUNT * 16);
    for (let i = 0; i < COUNT; i++) {
        const a = (i / COUNT) * Math.PI * 2;
        const m = mat4Compose(Math.cos(a) * 10, 1.5, Math.sin(a) * 10, /*quat*/ 0, 0, 0, 1, /*scale*/ 0.6, 1.5 + (i % 4) * 0.7, 0.6);
        instances.set(m, i * 16);
    }
    setThinInstances(pillar, instances, COUNT);
    addToScene(scene, pillar);

    await registerScene(scene);
    await startEngine(engine);
    console.log("[demo] Babylon-Lite scene started (rendering natively via bgfx)");
}

main().catch(function (err) {
    console.error("[demo] fatal:", err && err.stack ? err.stack : err);
});
