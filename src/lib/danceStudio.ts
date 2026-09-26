import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/** Blender photographic projection with a bounded scroll dolly; no character rig. */
export async function createDanceStudio(host: HTMLElement, onFailure: () => void, signal: AbortSignal, portrait = false) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.setAttribute("aria-hidden", "true");
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 80);
  camera.position.set(0, 0, 3);
  const imageAspect = portrait ? 941 / 1672 : 1672 / 941;
  let baseDistance = 3;
  let progress = 0;
  let destroyed = false;
  let frame = 0;
  let model: THREE.Group | undefined;
  const lost = (event: Event) => { event.preventDefault(); onFailure(); };
  renderer.domElement.addEventListener("webglcontextlost", lost);
  const disposeObject = (root: THREE.Object3D) => root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach(material => {
      Object.values(material).forEach(value => { if (value instanceof THREE.Texture) { value.dispose(); if (value.image instanceof ImageBitmap) value.image.close(); } });
      material.dispose();
    });
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
    baseDistance = Math.min(1, imageAspect / camera.aspect) / Math.tan(THREE.MathUtils.degToRad(19)) * .97;
    camera.position.z = baseDistance * (1 - progress * .075);
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
    renderer.dispose(); renderer.domElement.remove();
  };
  signal.addEventListener("abort", dispose, { once: true });
  try {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    const response = await fetch(`/models/tde-dance-studio${portrait ? "-mobile" : ""}.glb`, { signal });
    if (!response.ok) throw new Error("The studio scene could not load");
    const gltf = await new GLTFLoader().parseAsync(await response.arrayBuffer(), "");
    if (destroyed) { disposeObject(gltf.scene); throw new DOMException("Aborted", "AbortError"); }
    model = gltf.scene;
    scene.add(model);
    const setProgress = (value: number) => {
      progress = THREE.MathUtils.clamp(value, 0, 1);
      camera.position.z = baseDistance * (1 - progress * .075);
      camera.position.x = progress * .025;
      camera.position.y = Math.sin(progress * Math.PI) * .012;
      host.dataset.progress = progress.toFixed(3);
      draw();
    };
    resize(); setProgress(0);
    return { setProgress, dispose };
  } catch (error) { dispose(); throw error; }
}
