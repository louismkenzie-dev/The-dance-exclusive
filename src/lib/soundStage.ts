import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

/** Blender mesh, rendered only when scroll/size changes. No perpetual render loop. */
export async function createSoundStage(host: HTMLElement, onFailure: () => void, signal: AbortSignal) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.domElement.setAttribute("aria-hidden", "true");
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 80);
  camera.position.set(0, 1.6, 14.8);
  camera.lookAt(0, 0, 0);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, .04);
  scene.environment = environment.texture;
  room.dispose(); pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xb9eaff, 0x072030, 2));
  const key = new THREE.DirectionalLight(0xffffff, 3.5); key.position.set(-3, 6, 8); scene.add(key);
  const rim = new THREE.DirectionalLight(0x00b0e0, 5); rim.position.set(5, 2, -3); scene.add(rim);
  let destroyed = false;
  let frame = 0;
  let model: THREE.Group | undefined;
  const lost = (event: Event) => { event.preventDefault(); onFailure(); };
  renderer.domElement.addEventListener("webglcontextlost", lost);
  const disposeObject = (root: THREE.Object3D) => root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach(material => material.dispose());
  });
  const draw = () => {
    if (destroyed || frame || document.hidden) return;
    frame = requestAnimationFrame(() => { frame = 0; if (!destroyed) renderer.render(scene, camera); });
  };
  const resize = () => {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height || destroyed) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // Keep the complete sculpture within the portrait viewport, too.
    camera.position.z = camera.aspect < 1 ? 17.5 : 14.8;
    camera.updateProjectionMatrix(); draw();
  };
  const observer = new ResizeObserver(resize); observer.observe(host);
  const restore = () => { if (!document.hidden) draw(); };
  document.addEventListener("visibilitychange", restore);
  const dispose = () => {
    if (destroyed) return;
    destroyed = true; cancelAnimationFrame(frame); observer.disconnect();
    signal.removeEventListener("abort", dispose);
    document.removeEventListener("visibilitychange", restore);
    renderer.domElement.removeEventListener("webglcontextlost", lost);
    if (model) disposeObject(model);
    environment.dispose(); renderer.dispose(); renderer.domElement.remove();
  };
  signal.addEventListener("abort", dispose, { once: true });
  try {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    const response = await fetch("/models/tde-sound-stage.glb", { signal });
    if (!response.ok) throw new Error("The sound sculpture could not load");
    const gltf = await new GLTFLoader().parseAsync(await response.arrayBuffer(), "");
    if (destroyed) { disposeObject(gltf.scene); throw new DOMException("Aborted", "AbortError"); }
    model = gltf.scene;
    scene.add(model);
    const sculpture = model.getObjectByName("SoundSystem")!;
    const left = model.getObjectByName("SpeakerLeft")!;
    const right = model.getObjectByName("SpeakerRight")!;
    const halo = model.getObjectByName("Halo")!;
    const leftStart = left.position.clone(); const rightStart = right.position.clone();
    // The Blender export converts the sculpture into glTF Y-up coordinates.
    const setProgress = (value: number) => {
      const progress = THREE.MathUtils.clamp(value, 0, 1);
      const spread = Math.sin(progress * Math.PI) * .85;
      sculpture.rotation.y = -.4 + progress * .8;
      sculpture.rotation.z = -.06 + progress * .12;
      sculpture.rotation.x = .12;
      left.position.x = leftStart.x - spread;
      right.position.x = rightStart.x + spread;
      left.position.y = leftStart.y + spread * .3;
      right.position.y = rightStart.y - spread * .3;
      left.rotation.z = -spread * .22; right.rotation.z = spread * .22;
      halo.rotation.y = progress * .6;
      halo.rotation.z = progress * .9;
      host.dataset.progress = progress.toFixed(3);
      draw();
    };
    resize(); setProgress(0);
    return { setProgress, dispose };
  } catch (error) { dispose(); throw error; }
}
