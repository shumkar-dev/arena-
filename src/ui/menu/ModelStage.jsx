import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

// Небольшая 3D-витрина для одной модели (утка в рейтинге): свет, медленное
// вращение, пальцем можно покрутить. create() → { root, animate(t) }.
export default function ModelStage({ create, className = '', distance = 7, lookY = 1.1 }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0, lookY + 1.2, distance);
    camera.lookAt(0, lookY, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    const dom = renderer.domElement;
    Object.assign(dom.style, { width: '100%', height: '100%', display: 'block' });
    mount.appendChild(dom);

    const resize = () => {
      const w = mount.clientWidth || 200, h = mount.clientHeight || 200;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    scene.add(new THREE.HemisphereLight(0xffe8e0, 0x3a0a10, 1.2));
    const key = new THREE.DirectionalLight(0xfff0d8, 2.2);
    key.position.set(2, 5, 4);
    const rim = new THREE.DirectionalLight(0xff4a4a, 1.4);
    rim.position.set(-3, 3, -4);
    scene.add(key, rim);

    const model = create();
    scene.add(model.root);

    let rot = 0.5, drag = null, idle = 2;
    const down = (e) => { drag = e.clientX; };
    const move = (e) => { if (drag != null) { rot += (e.clientX - drag) * 0.012; drag = e.clientX; idle = 0; } };
    const up = () => { drag = null; };
    dom.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);

    const clock = new THREE.Clock();
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(clock.getDelta(), 0.05);
      idle += dt;
      if (drag == null && idle > 1.5) rot += dt * 0.6;
      model.root.rotation.y = rot;
      model.animate?.(clock.elapsedTime);
      renderer.render(scene, camera);
    };
    loop();

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
  }, [create, distance, lookY]);

  return <div ref={mountRef} className={`model-stage ${className}`} />;
}
