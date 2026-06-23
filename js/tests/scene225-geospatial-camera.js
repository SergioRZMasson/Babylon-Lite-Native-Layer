// AUTO-GENERATED from Babylon-Lite lab/lite/src/lite/scene225.ts (esbuild, target es2017)
// Scene 225 — Geospatial Camera — tags: camera, geospatial, globe, standard
// Run:  app.exe --prelude js/lite/index.js --script js/tests/scene225-geospatial-camera.js

const PLANET_RADIUS = 100;
const CAMERA_RADIUS = 170;
const CAMERA_YAW = 0.6;
const CAMERA_PITCH = 0.85;
const CENTER_LAT = 20;
const CENTER_LON = 30;
const MARKER_SIZE = 18;
const MARKERS = [
  { lat: 0, lon: 0, color: [0.9, 0.15, 0.15] },
  { lat: 20, lon: 30, color: [0.95, 0.85, 0.15] },
  { lat: 40, lon: 60, color: [0.15, 0.8, 0.25] },
  { lat: -15, lon: 15, color: [0.85, 0.2, 0.8] },
  { lat: 10, lon: -20, color: [0.2, 0.75, 0.85] },
  { lat: 60, lon: 45, color: [0.92, 0.92, 0.92] }
];
function ecef(latDeg, lonDeg, r) {
  const lat = latDeg * Math.PI / 180;
  const lon = lonDeg * Math.PI / 180;
  const cosLat = Math.cos(lat);
  return { x: r * cosLat * Math.cos(lon), y: r * cosLat * Math.sin(lon), z: r * Math.sin(lat) };
}
async function main() {
  const __initStart = performance.now();
  const canvas = document.getElementById("renderCanvas");
  const engine = await createEngine(canvas);
  const scene = createSceneContext(engine);
  scene.clearColor = { r: 0.02, g: 0.02, b: 0.05, a: 1 };
  const cam = createGeospatialCamera({ planetRadius: PLANET_RADIUS });
  cam.fov = 0.8;
  cam.nearPlane = 1;
  cam.farPlane = PLANET_RADIUS * 16;
  setGeospatialOrientation(cam, {
    center: ecef(CENTER_LAT, CENTER_LON, PLANET_RADIUS),
    radius: CAMERA_RADIUS,
    yaw: CAMERA_YAW,
    pitch: CAMERA_PITCH
  });
  scene.camera = cam;
  addToScene(scene, createHemisphericLight([0, 1, 0], 1));
  const globe = createSphere(engine, { diameter: PLANET_RADIUS * 2, segments: 64 });
  const globeMat = createStandardMaterial();
  globeMat.diffuseColor = [0.2, 0.45, 0.85];
  globe.material = globeMat;
  addToScene(scene, globe);
  for (const m of MARKERS) {
    const box = createBox(engine, MARKER_SIZE);
    const mat = createStandardMaterial();
    mat.diffuseColor = m.color;
    box.material = mat;
    const p = ecef(m.lat, m.lon, PLANET_RADIUS + MARKER_SIZE / 2);
    box.position.set(p.x, p.y, p.z);
    addToScene(scene, box);
  }
  await registerScene(scene);
  await startEngine(engine);
  canvas.dataset.drawCalls = String(engine.drawCallCount);
  canvas.dataset.initMs = String(performance.now() - __initStart);
  canvas.dataset.ready = "true";
}
main().catch(console.error);
