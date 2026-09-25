import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { heroById } from '../../heroes/index.js';

// ============================================================
// ПОДИУМ С ГЕРОЕМ — 3D для меню. Герой стоит на тёмно-красном подиуме
// под прожектором, медленно поворачивается; пальцем можно покрутить.
// Раз в несколько секунд показывает удар — чтобы подиум не был статуей.
// ============================================================

export default function HeroStage({ heroId, className = '' }) {
  const mountRef = useRef(null);
  const heroRef = useRef(heroId);
  const api = useRef(null);

  // сцена создаётся один раз, герой меняется без пересоздания
  useEffect(() => {
    const mount = mountRef.current;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0, 2.6, 9.5);
    camera.lookAt(0, 1.45, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true;
    const dom = renderer.domElement;
    dom.style.width = '100%';
    dom.style.height = '100%';
    dom.style.display = 'block';
    mount.appendChild(dom);

    const resize = () => {
      const w = mount.clientWidth || 300, h = mount.clientHeight || 300;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    // свет: тёплый прожектор сверху и красная подсветка сзади
    scene.add(new THREE.HemisphereLight(0xffe8e0, 0x3a0a10, 0.9));
    const spot = new THREE.SpotLight(0xfff0d8, 60, 20, 0.45, 0.5);
    spot.position.set(1.5, 8, 4);
    spot.castShadow = true;
    spot.shadow.mapSize.set(512, 512);
    scene.add(spot, spot.target);
    const rim = new THREE.DirectionalLight(0xff4a4a, 1.6);
    rim.position.set(-3, 3, -5);
    scene.add(rim);

    // подиум: ступенчатый блочный пьедестал
    const podMat = new THREE.MeshStandardMaterial({ color: 0x5a1219, roughness: 0.6 });
    const podTop = new THREE.MeshStandardMaterial({ color: 0x7a1620, roughness: 0.5 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xf2c14e, roughness: 0.35, metalness: 0.4 });
    const pod = new THREE.Group();
    const add = (w, h, d, m, y) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.y = y; b.receiveShadow = true; b.castShadow = true; pod.add(b); };
    add(3.4, 0.35, 3.4, podMat, -0.18);
    add(2.8, 0.25, 2.8, podTop, 0.12);
    add(2.84, 0.06, 2.84, gold, 0.02);
    scene.add(pod);

    const holder = new THREE.Group();
    holder.position.y = 0.25;
    scene.add(holder);

    let model = null, kit = null, currentId = null;
    const setHero = (id) => {
      if (id === currentId) return;
      currentId = id;
      if (model) {
        holder.remove(model.root);
        model.root.traverse((o) => { o.geometry?.dispose(); for (const m of [].concat(o.material ?? [])) m.dispose(); });
      }
      const hero = heroById(id);
      model = hero.createModel();
      model.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      holder.add(model.root);
      // приёмы нужны только ради позы (ульты не будет): заглушка бойца
      kit = hero.createKit({ pos: new THREE.Vector3(), facing: 0, radius: 0.5, alive: true, team: 'menu', canAct: () => false, hasEffect: () => false, addEffect() {}, effects: {} });
    };
    setHero(heroRef.current);

    // вращение пальцем
    let rot = 0.4, drag = null, spin = 0;
    const down = (e) => { drag = e.clientX; };
    const move = (e) => { if (drag != null) { rot += (e.clientX - drag) * 0.012; drag = e.clientX; spin = 0; } };
    const up = () => { drag = null; };
    dom.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);

    const clock = new THREE.Clock();
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
      setHero(heroRef.current);
      spin += dt;
      if (drag == null && spin > 1.5) rot += dt * 0.5;
      holder.rotation.y = rot;
      // раз в 4 секунды — показательный удар
      const k = (t % 4) / 0.4;
      const pose = { ...(kit?.pose?.() ?? {}) };
      if (k < 1) Object.assign(pose, { punch: k, throw: k, shot: k, whip: k, punchSide: 1, throwSide: 1, shotSide: 1, whipSide: 1 });
      model?.animate({ t, stride: 0, moving: false, ...pose });
      renderer.render(scene, camera);
    };
    loop();

    api.current = { setHero };
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      dom.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      scene.traverse((o) => { o.geometry?.dispose(); for (const m of [].concat(o.material ?? [])) m.dispose(); });
      renderer.dispose();
      dom.remove();
    };
  }, []);

  useEffect(() => { heroRef.current = heroId; }, [heroId]);

  return <div ref={mountRef} className={`hero-stage ${className}`} />;
}
