import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

// ============================================================
// ЧЁРНЫЙ ИЗЮМ — блочный стиль
// тело цвета изюма, накачанное; вместо головы — сам изюм с лицом
// ульта: парение на реактивных изюминках из рук и ног
// ============================================================

export default function CherniyIzyumBlocky() {
  const mountRef = useRef(null);
  const api = useRef({ pose: 'idle', spin: true });
  const [pose, setPose] = useState('idle');
  const [spin, setSpin] = useState(true);

  useEffect(() => { api.current.pose = pose; }, [pose]);
  useEffect(() => { api.current.spin = spin; }, [spin]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x14121a);
    scene.fog = new THREE.Fog(0x14121a, 11, 26);

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 1.8, 7.4);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);
    const dom = renderer.domElement;
    dom.style.width = '100%';
    dom.style.height = '100%';
    dom.style.display = 'block';
    dom.style.cursor = 'grab';

    const resize = () => {
      const w = mount.clientWidth || 400, h = mount.clientHeight || 600;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    // ---------- СВЕТ ----------
    scene.add(new THREE.AmbientLight(0x4a4356, 0.75));
    const key = new THREE.DirectionalLight(0xffe8d0, 1.65);
    key.position.set(4.5, 8, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -5; key.shadow.camera.right = 5;
    key.shadow.camera.top = 5; key.shadow.camera.bottom = -5;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x8a6ad6, 0.55);
    fill.position.set(-5, 2, 4);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xe8d4ff, 1.5);
    rim.position.set(-2, 4, -6);
    scene.add(rim);

    // ---------- МАТЕРИАЛЫ ----------
    const mat = (c, r = 0.92) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: 0 });
    const M = {
      raisin:   mat(0x3a2030),
      raisinD:  mat(0x241422),   // впадины морщин, тень
      raisinL:  mat(0x54314a),   // блик
      brow:     mat(0x120a12),
      white:    mat(0xf0ece8, 0.4),
      pupil:    mat(0x0e0a10, 0.4),
      shorts:   mat(0x1c1a22),
      shortsD:  mat(0x121016),
      jet:      new THREE.MeshStandardMaterial({ color: 0x241422, roughness: 0.5, emissive: 0x4a1f3a, emissiveIntensity: 0.9 }),
    };

    // ---------- ХЕЛПЕРЫ ----------
    const box = (w, h, d, material, x = 0, y = 0, z = 0) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      return m;
    };
    const part = (w, h, d, material) => {
      const g = new THREE.BoxGeometry(w, h, d);
      g.translate(0, -h / 2, 0);
      const m = new THREE.Mesh(g, material);
      m.castShadow = true;
      return m;
    };

    // ============================================================
    // ЧЁРНЫЙ ИЗЮМ
    // ============================================================
    const izm = new THREE.Group();
    scene.add(izm);

    const hips = new THREE.Group();
    hips.position.y = 1.14;
    izm.add(hips);

    const torso = new THREE.Group();
    hips.add(torso);

    // корпус — накачанный, «V»-силуэт
    torso.add(box(0.92, 0.28, 0.48, M.raisin, 0, 1.02, 0));   // плечи/грудь
    torso.add(box(0.66, 0.4, 0.44, M.raisin, 0, 0.7, 0));     // рёбра
    torso.add(box(0.52, 0.4, 0.4, M.raisin, 0, 0.34, 0));     // талия
    torso.add(box(0.34, 0.22, 0.1, M.raisinL, -0.18, 0.96, 0.25));
    torso.add(box(0.34, 0.22, 0.1, M.raisinL, 0.18, 0.96, 0.25));
    for (let i = 0; i < 3; i++) {
      const y = 0.76 - i * 0.14;
      torso.add(box(0.12, 0.09, 0.09, M.raisinD, -0.09, y, 0.23));
      torso.add(box(0.12, 0.09, 0.09, M.raisinD, 0.09, y, 0.23));
    }
    torso.add(box(0.3, 0.14, 0.28, M.raisinD, 0, 1.2, 0)); // шея
    torso.add(box(0.58, 0.24, 0.42, M.shorts, 0, 0.11, 0));
    torso.add(box(0.6, 0.06, 0.44, M.shortsD, 0, 0.0, 0));

    // ---- ГОЛОВА-ИЗЮМИНА ----
    // морщинистый блок: неправильная форма из смещённых кубиков разного размера
    const head = new THREE.Group();
    head.position.set(0, 1.28, 0);
    torso.add(head);

    const HR = 0.42; // базовый радиус изюмины
    head.add(box(HR * 1.5, HR * 1.3, HR * 1.4, M.raisin, 0, HR * 0.6, 0)); // основной ком
    head.add(box(HR * 1.1, HR * 0.7, HR * 1.1, M.raisin, HR * 0.35, HR * 1.1, -HR * 0.1)); // верхний нарост
    head.add(box(HR * 0.9, HR * 0.6, HR * 1.0, M.raisin, -HR * 0.4, HR * 0.95, HR * 0.15));
    head.add(box(HR * 0.8, HR * 0.7, HR * 0.9, M.raisin, HR * 0.15, HR * 0.35, -HR * 0.45)); // нижний бок
    // морщины — тонкие тёмные полоски под разными углами
    const wrinkle = (x, y, z, rz, w = 0.5) => {
      const b = box(HR * w, 0.035, 0.06, M.raisinD, x, y, z);
      b.rotation.z = rz; b.rotation.y = 0.15;
      head.add(b);
    };
    wrinkle(0.05, HR * 0.95, HR * 0.55, 0.5, 0.6);
    wrinkle(-0.15, HR * 0.7, HR * 0.62, -0.35, 0.55);
    wrinkle(0.2, HR * 0.55, HR * 0.6, 0.2, 0.45);
    wrinkle(-0.05, HR * 0.25, HR * 0.6, -0.15, 0.6);
    wrinkle(0.12, HR * 0.05, HR * 0.55, 0.4, 0.4);
    wrinkle(-0.22, HR * 0.4, HR * 0.5, 0.6, 0.35);
    // блик спереди, чтобы лицо не проваливалось в тень
    head.add(box(HR * 1.15, HR * 1.0, 0.02, M.raisinL, 0, HR * 0.55, HR * 0.68));

    // брови
    for (const sx of [-1, 1]) {
      head.add(box(0.16, 0.045, 0.05, M.brow, sx * 0.14, HR * 0.85, HR * 0.62));
    }
    // глаза
    for (const sx of [-1, 1]) {
      head.add(box(0.13, 0.09, 0.04, M.white, sx * 0.14, HR * 0.72, HR * 0.63));
      head.add(box(0.06, 0.09, 0.05, M.pupil, sx * 0.15, HR * 0.72, HR * 0.66));
    }
    // рот — уверенная прямая линия
    head.add(box(0.24, 0.04, 0.05, M.raisinD, 0, HR * 0.28, HR * 0.66));

    // ---- РУКИ — накачанные, с «соплом» на кисти ----
    const arm = (side) => {
      const sh = new THREE.Group();
      sh.position.set(side * 0.58, 1.1, 0);
      torso.add(sh);
      sh.add(box(0.24, 0.24, 0.24, M.raisinL, side * 0.02, -0.02, 0));
      sh.add(part(0.32, 0.4, 0.32, M.raisin));
      const el = new THREE.Group();
      el.position.y = -0.4;
      sh.add(el);
      el.add(part(0.26, 0.38, 0.26, M.raisinL));
      const wr = new THREE.Group();
      wr.position.y = -0.38;
      el.add(wr);
      wr.add(part(0.22, 0.15, 0.22, M.raisinD)); // кисть
      wr.add(box(0.24, 0.05, 0.24, M.jet, 0, -0.17, 0)); // сопло-изюм на ладони
      return { sh, el, wr };
    };
    const armL = arm(-1), armR = arm(1);

    // ---- НОГИ — накачанные, с «соплом» на стопе ----
    const leg = (side) => {
      const hp = new THREE.Group();
      hp.position.set(side * 0.2, 0, 0);
      hips.add(hp);
      hp.add(part(0.34, 0.56, 0.34, M.raisin));
      const kn = new THREE.Group();
      kn.position.y = -0.56;
      hp.add(kn);
      kn.add(part(0.26, 0.48, 0.26, M.raisinL));
      const an = new THREE.Group();
      an.position.y = -0.48;
      kn.add(an);
      an.add(box(0.28, 0.14, 0.4, M.raisinD, 0, -0.07, 0.06)); // стопа
      an.add(box(0.3, 0.05, 0.3, M.jet, 0, -0.15, 0.02));      // сопло-изюм на стопе
      return { hp, kn, an };
    };
    const legL = leg(-1), legR = leg(1);

    // ---- ЛЕТЯЩИЕ ИЗЮМИНКИ (реактивная тяга) ----
    const jetStream = (parentGetter) => {
      const g = new THREE.Group();
      scene.add(g);
      const bits = [];
      const N = 7;
      for (let i = 0; i < N; i++) {
        const geo = new THREE.BoxGeometry(0.06, 0.07, 0.06);
        const m = new THREE.MeshStandardMaterial({
          color: 0x2c1726, roughness: 0.7, emissive: 0x3a1530, emissiveIntensity: 0.7,
          transparent: true, opacity: 1,
        });
        const mesh = new THREE.Mesh(geo, m);
        g.add(mesh);
        bits.push(mesh);
      }
      return { g, bits, parentGetter };
    };
    const jets = [
      jetStream(() => armL.wr), jetStream(() => armR.wr),
      jetStream(() => legL.an), jetStream(() => legR.an),
    ];
    jets.forEach(j => { j.g.visible = false; });

    // ---------- ЗЕМЛЯ ----------
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(7, 4),
      new THREE.MeshStandardMaterial({ color: 0x1c1922, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.rotation.z = Math.PI / 4;
    ground.receiveShadow = true;
    scene.add(ground);
    const grid = new THREE.GridHelper(14, 14, 0x2c2836, 0x211e29);
    grid.position.y = 0.002;
    scene.add(grid);

    // ---------- ВРАЩЕНИЕ ----------
    let rotY = 0.5, rotX = 0, dragging = false, lx = 0, ly = 0;
    const down = (x, y) => { dragging = true; lx = x; ly = y; dom.style.cursor = 'grabbing'; };
    const movePt = (x, y) => {
      if (!dragging) return;
      rotY += (x - lx) * 0.008;
      rotX = Math.max(-0.45, Math.min(0.6, rotX + (y - ly) * 0.005));
      lx = x; ly = y;
    };
    const upPt = () => { dragging = false; dom.style.cursor = 'grab'; };
    const md = (e) => down(e.clientX, e.clientY);
    const mm = (e) => movePt(e.clientX, e.clientY);
    const ts = (e) => down(e.touches[0].clientX, e.touches[0].clientY);
    const tm = (e) => movePt(e.touches[0].clientX, e.touches[0].clientY);
    dom.addEventListener('mousedown', md);
    window.addEventListener('mousemove', mm);
    window.addEventListener('mouseup', upPt);
    dom.addEventListener('touchstart', ts, { passive: true });
    dom.addEventListener('touchmove', tm, { passive: true });
    dom.addEventListener('touchend', upPt);

    // ---------- ПОЗЫ ----------
    const clock = new THREE.Clock();
    let raf;
    const tmpV = new THREE.Vector3();

    const resetRig = () => {
      legL.hp.rotation.set(0, 0, 0);
      legR.hp.rotation.set(0, 0, 0);
      legL.kn.rotation.set(0, 0, 0);
      legR.kn.rotation.set(0, 0, 0);
      legL.hp.position.set(-0.2, 0, 0);
      legR.hp.position.set(0.2, 0, 0);
      armL.sh.rotation.set(0, 0, 0);
      armR.sh.rotation.set(0, 0, 0);
      armL.el.rotation.set(0, 0, 0);
      armR.el.rotation.set(0, 0, 0);
      torso.rotation.set(0, 0, 0);
      head.rotation.set(0, 0, 0);
    };

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const t = clock.getElapsedTime();
      const p = api.current.pose;
      resetRig();

      if (p !== 'fly') {
        izm.position.set(0, 0, 0);
        jets.forEach(j => { j.g.visible = false; });
      }

      if (p === 'idle') {
        const b = Math.sin(t * 1.6) * 0.018;
        hips.position.y = 1.14 + b;
        armL.sh.rotation.x = Math.sin(t * 1.6) * 0.06;
        armR.sh.rotation.x = -Math.sin(t * 1.6) * 0.06;
        head.rotation.y = Math.sin(t * 0.55) * 0.2;
      }
      else if (p === 'walk') {
        const ph = t * 6.5;
        hips.position.y = 1.14 + Math.abs(Math.sin(ph)) * 0.05;
        torso.rotation.x = 0.08;
        torso.rotation.z = Math.sin(ph) * 0.03;
        armL.sh.rotation.x = -Math.sin(ph) * 0.7;
        armR.sh.rotation.x = Math.sin(ph) * 0.7;
        armL.el.rotation.x = -0.3 - Math.max(0, -Math.sin(ph)) * 0.4;
        armR.el.rotation.x = -0.3 - Math.max(0, Math.sin(ph)) * 0.4;
        legL.hp.rotation.x = Math.sin(ph) * 0.75;
        legR.hp.rotation.x = -Math.sin(ph) * 0.75;
        legL.kn.rotation.x = 0.15 + Math.max(0, -Math.sin(ph)) * 0.9;
        legR.kn.rotation.x = 0.15 + Math.max(0, Math.sin(ph)) * 0.9;
        head.rotation.set(-0.05, 0, 0);
      }
      else if (p === 'jump') {
        hips.position.y = 1.28 + Math.sin(t * 2.2) * 0.03;
        torso.rotation.set(-0.1, 0, 0);
        armL.sh.rotation.x = -2.3;
        armR.sh.rotation.x = -2.3;
        armL.el.rotation.x = -0.4; armR.el.rotation.x = -0.4;
        legL.hp.rotation.x = -0.85; legR.hp.rotation.x = -0.3;
        legL.kn.rotation.x = 1.3; legR.kn.rotation.x = 0.5;
        head.rotation.set(-0.15, 0, 0);
      }
      else if (p === 'flex') {
        hips.position.y = 1.14 + Math.sin(t * 3) * 0.01;
        torso.rotation.x = -0.04;
        armL.sh.rotation.set(0, 0, 1.55 + Math.sin(t * 4) * 0.02);
        armR.sh.rotation.set(0, 0, -1.55 - Math.sin(t * 4) * 0.02);
        armL.el.rotation.z = -1.9;
        armR.el.rotation.z = 1.9;
        legL.hp.rotation.x = 0.05; legR.hp.rotation.x = 0.05;
        head.rotation.set(-0.06, 0.05, 0);
      }
      else if (p === 'fly') {
        // УЛЬТА: парение на реактивных изюминках из рук и ног
        const altitude = 2.1 + Math.sin(t * 1.8) * 0.12;
        izm.position.set(Math.sin(t * 0.6) * 0.25, altitude, 0);
        torso.rotation.x = 0.12 + Math.sin(t * 1.8) * 0.03;
        armL.sh.rotation.x = -2.55;
        armR.sh.rotation.x = -2.55;
        armL.el.rotation.x = -0.1; armR.el.rotation.x = -0.1;
        legL.hp.rotation.x = -0.25;
        legR.hp.rotation.x = -0.25;
        legL.kn.rotation.x = 0.35;
        legR.kn.rotation.x = 0.35;
        head.rotation.set(0.1, 0, 0);

        jets.forEach((j, ji) => {
          j.g.visible = true;
          const src = j.parentGetter();
          src.getWorldPosition(tmpV);
          j.g.position.copy(tmpV);
          j.bits.forEach((mesh, i) => {
            const phase = ((t * 3.4 + i * 0.16 + ji * 0.07) % 1);
            mesh.position.set(
              Math.sin(t * 7 + i * 2 + ji) * 0.05 * phase,
              -phase * 0.7,
              Math.cos(t * 7 + i * 2 + ji) * 0.05 * phase
            );
            const s = 1 - phase * 0.7;
            mesh.scale.setScalar(s);
            mesh.material.opacity = 1 - phase;
          });
        });
      }

      if (api.current.spin && !dragging) rotY += 0.0035;
      izm.rotation.y = rotY;
      izm.rotation.x = rotX * 0.2;
      const camY = p === 'fly' ? 2.3 : 1.7;
      camera.position.y = camY + rotX * 2;
      camera.lookAt(0, p === 'fly' ? 1.9 : 1.3, 0);
      renderer.render(scene, camera);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      dom.removeEventListener('mousedown', md);
      window.removeEventListener('mousemove', mm);
      window.removeEventListener('mouseup', upPt);
      dom.removeEventListener('touchstart', ts);
      dom.removeEventListener('touchmove', tm);
      dom.removeEventListener('touchend', upPt);
      renderer.dispose();
      if (dom.parentNode) dom.parentNode.removeChild(dom);
    };
  }, []);

  const btn = (a) => ({
    background: a ? '#c98a3a' : 'transparent',
    color: a ? '#14121a' : '#c8c4d2',
    border: a ? 'none' : '1px solid #34303e',
    padding: '9px 15px',
    fontSize: 14,
    fontFamily: "'Oswald','Arial Narrow',system-ui,sans-serif",
    cursor: 'pointer',
  });

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100vh', maxHeight: 860,
      background: '#14121a', overflow: 'hidden',
      fontFamily: "'Oswald','Arial Narrow',system-ui,sans-serif",
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;600&display=swap');`}</style>
      <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />

      <div style={{ position: 'absolute', top: 16, left: 18, color: '#c8c4d2', pointerEvents: 'none' }}>
        <div style={{ fontSize: 11, color: '#756f82', letterSpacing: '.08em' }}>ПЕРСОНАЖ · БЛОЧНЫЙ СТИЛЬ</div>
        <div style={{ fontSize: 27, fontWeight: 600, lineHeight: 1.1 }}>Чёрный Изюм</div>
        <div style={{ fontSize: 12, color: '#756f82', marginTop: 4 }}>тяни мышкой, чтобы повернуть</div>
      </div>

      <div style={{
        position: 'absolute', bottom: 18, left: 0, right: 0, display: 'flex',
        gap: 8, justifyContent: 'center', flexWrap: 'wrap', padding: '0 14px',
      }}>
        <button style={btn(pose === 'idle')} onClick={() => setPose('idle')}>Стоит</button>
        <button style={btn(pose === 'walk')} onClick={() => setPose('walk')}>Идёт</button>
        <button style={btn(pose === 'jump')} onClick={() => setPose('jump')}>Прыжок</button>
        <button style={btn(pose === 'flex')} onClick={() => setPose('flex')}>Мускулы</button>
        <button style={btn(pose === 'fly')} onClick={() => setPose('fly')}>Ульта: Парение</button>
        <button style={btn(spin)} onClick={() => setSpin(!spin)}>Вращение</button>
      </div>
    </div>
  );
}
