import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

/** Real Blender studio geometry and baked articulated dance animation, scrubbed by scroll. */
export async function createDanceStudio(host: HTMLElement, onFailure: () => void, signal: AbortSignal, portrait = false) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute("aria-hidden", "true");
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 80);
  let progress = 0;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, .04);
  room.dispose(); pmrem.dispose();
  scene.environment = environment.texture;
  scene.environmentIntensity = .45;
  scene.add(new THREE.HemisphereLight(0x8bcfff, 0x263448, 1.5));
  const key = new THREE.DirectionalLight(0xd1edff, 3.5);
  key.position.set(-2, 5, 4); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: .1, far: 25 });
  key.shadow.normalBias = .025;
  scene.add(key);
  const rim = new THREE.PointLight(0x00b0e0, 65, 12, 2); rim.position.set(3.5, 3, -2); scene.add(rim);
  const fill = new THREE.PointLight(0x51cfff, 25, 10, 2); fill.position.set(-3, 2.5, 0); scene.add(fill);
  const updateCamera = () => {
    camera.position.set(portrait ? 1.6 - progress * .4 : 1.6 - progress, portrait ? 2.8 : 2.7, (portrait ? 7.6 : 6.5) - .4 * Math.sin(progress * Math.PI));
    camera.lookAt(portrait ? 1.35 : 0, portrait ? 1.4 : 1.35, 0);
  };
  updateCamera();
  let mixer: THREE.AnimationMixer | undefined;
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
    updateCamera();
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
    if (model) { mixer?.stopAllAction(); mixer?.uncacheRoot(model); disposeObject(model); }
    key.shadow.map?.dispose(); environment.dispose();
    renderer.dispose(); renderer.domElement.remove();
  };
  signal.addEventListener("abort", dispose, { once: true });
  try {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    const response = await fetch("/models/tde-animated-studio.glb", { signal });
    if (!response.ok) throw new Error("The studio scene could not load");
    const gltf = await new GLTFLoader().parseAsync(await response.arrayBuffer(), "");
    if (destroyed) { disposeObject(gltf.scene); throw new DOMException("Aborted", "AbortError"); }
    model = gltf.scene;
    model.traverse(object => {
      if (object instanceof THREE.Mesh) { object.castShadow = true; object.receiveShadow = true; }
    });
    scene.add(model);
    if (!gltf.animations.length) throw new Error("The studio dance animation is missing");
    mixer = new THREE.AnimationMixer(model);
    const actions = gltf.animations.map(clip => {
      const action = mixer!.clipAction(clip); action.play(); action.paused = true; return action;
    });
    const duration = Math.max(...gltf.animations.map(clip => clip.duration));
    host.dataset.animationClips = String(actions.length);
    const setProgress = (value: number) => {
      progress = THREE.MathUtils.clamp(value, 0, 1);
      actions.forEach(action => { action.time = Math.min(progress * duration, action.getClip().duration); });
      mixer!.update(0);
      updateCamera();
      host.dataset.animationTime = (progress * duration).toFixed(3);
      host.dataset.progress = progress.toFixed(3);
      draw();
    };
    resize(); setProgress(0);
    return { setProgress, dispose };
  } catch (error) { dispose(); throw error; }
}
