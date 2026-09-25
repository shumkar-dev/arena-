import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

// ============================================================
// ШАБА + ЧЁРНЫЙ БАРАН — блочный стиль
// ============================================================

export default function ShabaBlocky() {
  const mountRef = useRef(null);
  const api = useRef({ pose: 'run', spin: true });
  const [pose, setPose] = useState('run');
  const [spin, setSpin] = useState(true);

  useEffect(() => { api.current.pose = pose; }, [pose]);
  useEffect(() => { api.current.spin = spin; }, [spin]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x161a22);
    scene.fog = new THREE.Fog(0x161a22, 11, 26);

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 1.7, 7);

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
    scene.add(new THREE.AmbientLight(0x49536b, 0.75));
    const key = new THREE.DirectionalLight(0xfff0d8, 1.65);
    key.position.set(4.5, 8, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -5; key.shadow.camera.right = 5;
    key.shadow.camera.top = 5; key.shadow.camera.bottom = -5;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x6a8ed6, 0.55);
    fill.position.set(-5, 2, 4);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xdce8ff, 1.5);
    rim.position.set(-2, 4, -6);
    scene.add(rim);

    // ---------- МАТЕРИАЛЫ (плоские цвета, как в блочных играх) ----------
    const mat = (c, r = 0.95) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: 0 });
    const M = {
      skin:   mat(0x77492b),
      skinD:  mat(0x60381f),   // тень: шея, кисти
      skinL:  mat(0x8a5733),   // блик: лицо
      hair:   mat(0x120d0a),
      tank:   mat(0xf2f0e6),
      tankD:  mat(0xdedbcf),
      jeans:  mat(0x33528a),
      jeansD: mat(0x28416e),
      shoe:   mat(0xeceadf),
      sole:   mat(0x23262e),
      white:  mat(0xf4f2ea, 0.4),
      pupil:  mat(0x140d07, 0.4),
      wool:   mat(0x191920),
      woolD:  mat(0x0e0e13),
      horn:   mat(0x9c8b68, 0.8),
      hornD:  mat(0x81714f, 0.8),
      hoof:   mat(0x1c1c22, 0.7),
    };

    // ---------- ХЕЛПЕР: кубик ----------
    const box = (w, h, d, material, x = 0, y = 0, z = 0) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      return m;
    };
    // конечность: пивот сверху
    const part = (w, h, d, material) => {
      const g = new THREE.BoxGeometry(w, h, d);
      g.translate(0, -h / 2, 0);
      const m = new THREE.Mesh(g, material);
      m.castShadow = true;
      return m;
    };

    // ============================================================
    // ШАБА — пропорции классического блочного персонажа
    // голова 0.8 · корпус 0.8×1.2×0.42 · руки и ноги 0.36×1.15
    // ============================================================
    const shaba = new THREE.Group();
    scene.add(shaba);

    const sHips = new THREE.Group();
    sHips.position.y = 1.2;
    shaba.add(sHips);

    const sTorso = new THREE.Group();
    sHips.add(sTorso);

    // корпус в белой майке
    sTorso.add(box(0.8, 1.14, 0.42, M.tank, 0, 0.57, 0));
    // боковины чуть темнее — читается объём
    sTorso.add(box(0.02, 1.14, 0.44, M.tankD, 0.4, 0.57, 0));
    sTorso.add(box(0.02, 1.14, 0.44, M.tankD, -0.4, 0.57, 0));
    // вырез майки: открытая кожа сверху груди и спины
    sTorso.add(box(0.44, 0.16, 0.44, M.skin, 0, 1.11, 0));
    // шея
    sTorso.add(box(0.3, 0.14, 0.3, M.skinD, 0, 1.2, 0));

    // ---- ГОЛОВА ----
    const sNeck = new THREE.Group();
    sNeck.position.set(0, 1.26, 0);
    sTorso.add(sNeck);

    const HS = 0.8;              // сторона куба головы
    const HF = HS / 2 + 0.001;   // передняя грань
    sNeck.add(box(HS, HS, HS, M.skin, 0, HS / 2, 0));
    // лицевая грань чуть светлее — лицо не проваливается в тень
    sNeck.add(box(HS * 0.98, HS * 0.98, 0.01, M.skinL, 0, HS / 2, HF));

    // короткие волосы: тонкая шапка сверху, затылок и виски.
    // лоб и лицо открыты — маски нет
    sNeck.add(box(0.84, 0.1, 0.84, M.hair, 0, HS - 0.02, 0));          // темя
    sNeck.add(box(0.84, 0.44, 0.08, M.hair, 0, HS - 0.24, -0.4));      // затылок
    sNeck.add(box(0.08, 0.4, 0.8, M.hair, 0.4, HS - 0.24, 0));         // висок
    sNeck.add(box(0.08, 0.4, 0.8, M.hair, -0.4, HS - 0.24, 0));
    sNeck.add(box(0.8, 0.08, 0.06, M.hair, 0, HS - 0.11, HF - 0.02));  // линия роста волос

    // борода: только челюсть и подбородок, глаза и нос открыты
    sNeck.add(box(0.8, 0.24, 0.07, M.hair, 0, 0.16, HF));              // подбородок
    sNeck.add(box(0.09, 0.5, 0.08, M.hair, 0.36, 0.28, HF - 0.04));    // бакенбарда
    sNeck.add(box(0.09, 0.5, 0.08, M.hair, -0.36, 0.28, HF - 0.04));
    sNeck.add(box(0.1, 0.42, 0.82, M.hair, 0.405, 0.3, 0));            // вдоль челюсти
    sNeck.add(box(0.1, 0.42, 0.82, M.hair, -0.405, 0.3, 0));
    sNeck.add(box(0.26, 0.07, 0.07, M.hair, 0, 0.34, HF));             // усы

    // глаза — крупные, читаются с дистанции
    for (const sx of [-1, 1]) {
      sNeck.add(box(0.17, 0.13, 0.04, M.white, sx * 0.17, 0.52, HF));
      sNeck.add(box(0.08, 0.13, 0.05, M.pupil, sx * 0.185, 0.52, HF + 0.005));
      sNeck.add(box(0.21, 0.06, 0.05, M.hair, sx * 0.17, 0.63, HF));   // бровь
    }
    // нос
    sNeck.add(box(0.14, 0.13, 0.08, M.skinD, 0, 0.42, HF + 0.02));
    // уши
    sNeck.add(box(0.06, 0.16, 0.14, M.skinD, 0.42, 0.46, 0));
    sNeck.add(box(0.06, 0.16, 0.14, M.skinD, -0.42, 0.46, 0));

    // ---- РУКИ (голые, майка) ----
    const arm = (side) => {
      const sh = new THREE.Group();
      sh.position.set(side * 0.58, 1.06, 0);
      sTorso.add(sh);
      sh.add(part(0.36, 0.95, 0.36, M.skin));
      const el = new THREE.Group();
      el.position.y = -0.95;
      sh.add(el);
      el.add(part(0.34, 0.2, 0.34, M.skinD));  // кисть
      return { sh, el };
    };
    const sArmL = arm(-1), sArmR = arm(1);

    // ---- НОГИ (джинсы + кроссовки) ----
    const leg = (side) => {
      const hp = new THREE.Group();
      hp.position.set(side * 0.21, 0, 0);
      sHips.add(hp);
      hp.add(part(0.38, 0.62, 0.38, M.jeans));
      const kn = new THREE.Group();
      kn.position.y = -0.62;
      hp.add(kn);
      kn.add(part(0.36, 0.5, 0.36, M.jeansD));
      const an = new THREE.Group();
      an.position.y = -0.5;
      kn.add(an);
      an.add(box(0.38, 0.16, 0.52, M.shoe, 0, -0.08, 0.07));
      an.add(box(0.39, 0.07, 0.53, M.sole, 0, -0.18, 0.07));
      return { hp, kn, an };
    };
    const sLegL = leg(-1), sLegR = leg(1);

    // ============================================================
    // ЧЁРНЫЙ БАРАН — блочный
    // ============================================================
    const ram = new THREE.Group();
    scene.add(ram);

    const rBody = new THREE.Group();
    rBody.position.y = 0.82;
    ram.add(rBody);

    rBody.add(box(0.78, 0.7, 1.5, M.wool, 0, 0, 0));
    rBody.add(box(0.8, 0.16, 1.52, M.woolD, 0, -0.36, 0));   // брюхо
    rBody.add(box(0.3, 0.26, 0.16, M.woolD, 0, 0.2, -0.8));  // хвост

    const rNeck = new THREE.Group();
    rNeck.position.set(0, 0.2, 0.72);
    rBody.add(rNeck);
    rNeck.add(box(0.44, 0.44, 0.34, M.wool, 0, 0, 0.1));

    const rHead = new THREE.Group();
    rHead.position.set(0, 0.06, 0.36);
    rNeck.add(rHead);
    rHead.add(box(0.52, 0.5, 0.52, M.wool, 0, 0, 0));
    rHead.add(box(0.32, 0.28, 0.3, M.woolD, 0, -0.13, 0.38));  // морда
    rHead.add(box(0.08, 0.06, 0.06, M.hoof, 0.08, -0.08, 0.53));
    rHead.add(box(0.08, 0.06, 0.06, M.hoof, -0.08, -0.08, 0.53));

    for (const sx of [-1, 1]) {
      rHead.add(box(0.22, 0.1, 0.14, M.woolD, sx * 0.34, 0.06, -0.02));   // ухо
      rHead.add(box(0.12, 0.12, 0.05, M.white, sx * 0.17, 0.08, 0.27));   // глаз
      rHead.add(box(0.06, 0.09, 0.06, M.pupil, sx * 0.18, 0.08, 0.29));
    }

    // рога — спираль из кубиков, каждый мельче предыдущего
    const horn = (side) => {
      const g = new THREE.Group();
      const N = 13;
      for (let i = 0; i < N; i++) {
        const t = i / (N - 1);
        const a = i * 0.52;
        const r = 0.3 * (1 - t * 0.55);
        const s = 0.19 - t * 0.1;
        const c = box(
          s, s, s,
          i % 2 ? M.horn : M.hornD,
          side * (0.26 + t * 0.14),
          0.2 + Math.sin(a) * r,
          -0.02 + Math.cos(a) * r
        );
        c.rotation.set(a * 0.4, 0, side * a * 0.15);
        g.add(c);
      }
      return g;
    };
    rHead.add(horn(-1));
    rHead.add(horn(1));

    const ramLeg = (sx, sz) => {
      const hp = new THREE.Group();
      hp.position.set(sx * 0.26, -0.3, sz * 0.52);
      rBody.add(hp);
      hp.add(part(0.2, 0.42, 0.2, M.wool));
      const kn = new THREE.Group();
      kn.position.y = -0.42;
      hp.add(kn);
      kn.add(part(0.17, 0.24, 0.17, M.woolD));
      kn.add(box(0.19, 0.1, 0.19, M.hoof, 0, -0.29, 0));
      return { hp, kn };
    };
    const rFL = ramLeg(-1, 1), rFR = ramLeg(1, 1);
    const rBL = ramLeg(-1, -1), rBR = ramLeg(1, -1);

    // ---------- ЗЕМЛЯ ----------
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(7, 4),
      new THREE.MeshStandardMaterial({ color: 0x1e222c, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.rotation.z = Math.PI / 4;
    ground.receiveShadow = true;
    scene.add(ground);
    const grid = new THREE.GridHelper(14, 14, 0x2e3543, 0x232833);
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
    // ноги всегда вращаются только по X — крест-накрест не выйдет
    const clock = new THREE.Clock();
    let raf;

    const resetRig = () => {
      sLegL.hp.rotation.set(0, 0, 0);
      sLegR.hp.rotation.set(0, 0, 0);
      sLegL.hp.position.set(-0.21, 0, 0);
      sLegR.hp.position.set(0.21, 0, 0);
      sArmL.sh.rotation.set(0, 0, 0);
      sArmR.sh.rotation.set(0, 0, 0);
    };

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const t = clock.getElapsedTime();
      const p = api.current.pose;
      resetRig();

      if (p !== 'ride') { ram.visible = false; shaba.position.set(0, 0, 0); }

      if (p === 'idle') {
        const b = Math.sin(t * 1.6) * 0.018;
        sHips.position.y = 1.2 + b;
        sTorso.rotation.x = 0;
        sArmL.sh.rotation.x = Math.sin(t * 1.6) * 0.06;
        sArmR.sh.rotation.x = -Math.sin(t * 1.6) * 0.06;
        sArmL.el.rotation.x = 0; sArmR.el.rotation.x = 0;
        sLegL.hp.rotation.x = 0; sLegR.hp.rotation.x = 0;
        sLegL.kn.rotation.x = 0; sLegR.kn.rotation.x = 0;
        sNeck.rotation.y = Math.sin(t * 0.55) * 0.22;
        sNeck.rotation.x = 0;
      }
      else if (p === 'run') {
        const ph = t * 9;
        sHips.position.y = 1.2 + Math.abs(Math.sin(ph)) * 0.07;
        sTorso.rotation.x = 0.16;
        sTorso.rotation.z = Math.sin(ph) * 0.04;
        sArmL.sh.rotation.x = -Math.sin(ph) * 1.15 - 0.15;
        sArmR.sh.rotation.x = Math.sin(ph) * 1.15 - 0.15;
        sArmL.el.rotation.x = -0.6 - Math.max(0, -Math.sin(ph)) * 0.6;
        sArmR.el.rotation.x = -0.6 - Math.max(0, Math.sin(ph)) * 0.6;
        sLegL.hp.rotation.x = Math.sin(ph) * 0.95;
        sLegR.hp.rotation.x = -Math.sin(ph) * 0.95;
        sLegL.kn.rotation.x = 0.2 + Math.max(0, -Math.sin(ph)) * 1.15;
        sLegR.kn.rotation.x = 0.2 + Math.max(0, Math.sin(ph)) * 1.15;
        sNeck.rotation.set(-0.1, 0, 0);
      }
      else if (p === 'jump') {
        sHips.position.y = 1.34 + Math.sin(t * 2.2) * 0.03;
        sTorso.rotation.set(-0.1, 0, 0);
        sArmL.sh.rotation.x = -2.35;
        sArmR.sh.rotation.x = -2.35;
        sArmL.el.rotation.x = -0.45; sArmR.el.rotation.x = -0.45;
        sLegL.hp.rotation.x = -0.9;
        sLegR.hp.rotation.x = -0.35;
        sLegL.kn.rotation.x = 1.5;
        sLegR.kn.rotation.x = 0.6;
        sNeck.rotation.set(-0.15, 0, 0);
      }
      else if (p === 'slide') {
        sHips.position.y = 0.62;
        sTorso.rotation.set(0.9, 0, 0);
        sArmL.sh.rotation.x = -2.6;
        sArmR.sh.rotation.x = -2.6;
        sArmL.el.rotation.x = -0.3; sArmR.el.rotation.x = -0.3;
        sLegL.hp.rotation.x = -1.3;
        sLegR.hp.rotation.x = -1.05;
        sLegL.kn.rotation.x = 1.3;
        sLegR.kn.rotation.x = 1.0;
        sNeck.rotation.set(-0.6, 0, 0);
      }
      else if (p === 'ride') {
        const ph = t * 11;
        const bob = Math.abs(Math.sin(ph)) * 0.1;

        ram.visible = true;
        ram.position.y = bob;
        rBody.rotation.x = Math.sin(ph * 2) * 0.06;
        rNeck.rotation.x = -0.1 + Math.sin(ph * 2) * 0.1;
        const gal = (g, off) => {
          g.hp.rotation.x = Math.sin(ph + off) * 0.9 - 0.1;
          g.kn.rotation.x = 0.35 + Math.max(0, Math.sin(ph + off + 1.2)) * 0.8;
        };
        gal(rFL, 0); gal(rFR, 0.3);
        gal(rBL, Math.PI); gal(rBR, Math.PI + 0.3);

        // Шаба верхом: ноги раздвинуты сдвигом по X, а не разворотом.
        // угол только по X — колени смотрят вперёд, ничего не перекрещивается
        shaba.position.set(0, 0, -0.12);
        sHips.position.y = 1.62 + bob;
        sTorso.rotation.set(0.25 + Math.sin(ph * 2) * 0.05, 0, 0);
        sArmL.sh.rotation.x = -1.05;
        sArmR.sh.rotation.x = -1.05;
        sArmL.el.rotation.x = -0.5; sArmR.el.rotation.x = -0.5;
        sLegL.hp.position.set(-0.4, 0, 0);
        sLegR.hp.position.set(0.4, 0, 0);
        sLegL.hp.rotation.x = -0.75;
        sLegR.hp.rotation.x = -0.75;
        sLegL.kn.rotation.x = 1.1;
        sLegR.kn.rotation.x = 1.1;
        sNeck.rotation.set(-0.15, 0, 0);
      }

      if (api.current.spin && !dragging) rotY += 0.0035;
      shaba.rotation.y = rotY; ram.rotation.y = rotY;
      shaba.rotation.x = rotX * 0.2; ram.rotation.x = rotX * 0.2;
      camera.position.y = 1.7 + rotX * 2;
      camera.lookAt(0, 1.3, 0);
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
    background: a ? '#e0a33a' : 'transparent',
    color: a ? '#161a22' : '#c8ccd8',
    border: a ? 'none' : '1px solid #333b4c',
    padding: '9px 15px',
    fontSize: 14,
    fontFamily: "'Oswald','Arial Narrow',system-ui,sans-serif",
    cursor: 'pointer',
  });

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100vh', maxHeight: 860,
      background: '#161a22', overflow: 'hidden',
      fontFamily: "'Oswald','Arial Narrow',system-ui,sans-serif",
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;600&display=swap');`}</style>
      <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />

      <div style={{ position: 'absolute', top: 16, left: 18, color: '#c8ccd8', pointerEvents: 'none' }}>
        <div style={{ fontSize: 11, color: '#6f7789', letterSpacing: '.08em' }}>ПЕРСОНАЖ 1 · БЛОЧНЫЙ СТИЛЬ</div>
        <div style={{ fontSize: 27, fontWeight: 600, lineHeight: 1.1 }}>Шаба</div>
        <div style={{ fontSize: 12, color: '#6f7789', marginTop: 4 }}>тяни мышкой, чтобы повернуть</div>
      </div>

      <div style={{
        position: 'absolute', bottom: 18, left: 0, right: 0, display: 'flex',
        gap: 8, justifyContent: 'center', flexWrap: 'wrap', padding: '0 14px',
      }}>
        <button style={btn(pose === 'idle')} onClick={() => setPose('idle')}>Стоит</button>
        <button style={btn(pose === 'run')} onClick={() => setPose('run')}>Бежит</button>
        <button style={btn(pose === 'jump')} onClick={() => setPose('jump')}>Прыжок</button>
        <button style={btn(pose === 'slide')} onClick={() => setPose('slide')}>Подкат</button>
        <button style={btn(pose === 'ride')} onClick={() => setPose('ride')}>На баране</button>
        <button style={btn(spin)} onClick={() => setSpin(!spin)}>Вращение</button>
      </div>
    </div>
  );
}
