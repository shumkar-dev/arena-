import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

// ============================================================
// ГАРГАШМЕЛЬ — блочный стиль (мускулистый, красивое лицо)
// + ШМЕЛЬ — для ульты «Полёт»
// ============================================================

export default function GargashmelBlocky() {
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
    scene.background = new THREE.Color(0x161a22);
    scene.fog = new THREE.Fog(0x161a22, 11, 26);

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

    // ---------- МАТЕРИАЛЫ ----------
    const mat = (c, r = 0.9) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: 0 });
    const M = {
      skin:   mat(0x2e9e93),
      skinD:  mat(0x1f7a71),   // тень: тентакли, кисти, шея
      skinL:  mat(0x45b7ab),   // блик: лицо, грудь
      brow:   mat(0x13332f),
      white:  mat(0xf4f2ea, 0.4),
      pupil:  mat(0x140d07, 0.4),
      shorts: mat(0x22242c),
      shortsD:mat(0x17181e),
      band:   mat(0xe8e5da, 0.6),
      sucker: mat(0x155650, 0.85),
      // шмель
      bee:    mat(0xf3c23a, 0.6),
      beeD:   mat(0x1a1712, 0.6),
      wing:   new THREE.MeshStandardMaterial({ color: 0xeaf3ff, roughness: 0.3, transparent: true, opacity: 0.45, side: THREE.DoubleSide }),
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
    // ГАРГАШМЕЛЬ — широкие плечи, рельефный торс, лицо без гротеска
    // ============================================================
    const garg = new THREE.Group();
    scene.add(garg);

    const gHips = new THREE.Group();
    gHips.position.y = 1.16;
    garg.add(gHips);

    const gTorso = new THREE.Group();
    gHips.add(gTorso);

    // корпус: широкие плечи, узкая талия — силуэт «V»
    gTorso.add(box(0.98, 0.3, 0.5, M.skin, 0, 1.06, 0));   // грудь/плечи
    gTorso.add(box(0.7, 0.42, 0.46, M.skin, 0, 0.72, 0));  // рёбра
    gTorso.add(box(0.56, 0.42, 0.42, M.skin, 0, 0.34, 0)); // талия — уже
    // пекторали — два выступа
    gTorso.add(box(0.36, 0.24, 0.1, M.skinL, -0.19, 1.0, 0.26));
    gTorso.add(box(0.36, 0.24, 0.1, M.skinL, 0.19, 1.0, 0.26));
    // пресс — сегменты
    for (let i = 0; i < 3; i++) {
      const y = 0.78 - i * 0.15;
      gTorso.add(box(0.13, 0.1, 0.09, M.skinD, -0.1, y, 0.24));
      gTorso.add(box(0.13, 0.1, 0.09, M.skinD, 0.1, y, 0.24));
    }
    // трапеции/шея
    gTorso.add(box(0.34, 0.16, 0.32, M.skinD, 0, 1.24, 0));
    // шорты
    gTorso.add(box(0.6, 0.24, 0.44, M.shorts, 0, 0.11, 0));
    gTorso.add(box(0.62, 0.06, 0.46, M.shortsD, 0, 0.0, 0));

    // ---- ГОЛОВА ----
    const gNeck = new THREE.Group();
    gNeck.position.set(0, 1.32, 0);
    gTorso.add(gNeck);

    const HS = 0.72;
    const HF = HS / 2 + 0.001;
    gNeck.add(box(HS, HS, HS * 0.92, M.skin, 0, HS / 2, 0));
    gNeck.add(box(HS * 0.96, HS * 0.96, 0.01, M.skinL, 0, HS / 2, HF - 0.02)); // лицо светлее
    // выраженная челюсть/скулы — чуть шире у низа
    gNeck.add(box(HS * 0.9, 0.14, HS * 0.86, M.skinL, 0, 0.1, 0));

    // густые прямые брови — мужественный взгляд
    for (const sx of [-1, 1]) {
      gNeck.add(box(0.22, 0.06, 0.06, M.brow, sx * 0.16, 0.5, HF));
    }
    // глаза — чуть прищур, уверенные
    for (const sx of [-1, 1]) {
      gNeck.add(box(0.15, 0.1, 0.04, M.white, sx * 0.16, 0.41, HF));
      gNeck.add(box(0.07, 0.1, 0.05, M.pupil, sx * 0.175, 0.41, HF + 0.005));
    }
    // фирменный длинный нос — но гранёный, «скульптурный», не карикатурный
    gNeck.add(box(0.16, 0.14, 0.3, M.skinL, 0, 0.28, HF + 0.14));
    gNeck.add(box(0.1, 0.09, 0.08, M.skinD, 0, 0.24, HF + 0.28)); // кончик носа, тень
    // подбородок с ямочкой (лёгкий разрез)
    gNeck.add(box(0.3, 0.12, 0.06, M.skinL, 0, 0.05, HF));
    gNeck.add(box(0.04, 0.05, 0.05, M.skinD, 0, 0.06, HF + 0.02));
    // уши
    gNeck.add(box(0.06, 0.16, 0.13, M.skinD, 0.37, 0.32, 0));
    gNeck.add(box(0.06, 0.16, 0.13, M.skinD, -0.37, 0.32, 0));

    // ---- РУКИ — крупные бицепсы/предплечья ----
    const arm = (side) => {
      const sh = new THREE.Group();
      sh.position.set(side * 0.62, 1.14, 0);
      gTorso.add(sh);
      sh.add(box(0.26, 0.26, 0.26, M.skinL, side * 0.02, -0.02, 0)); // дельта
      const bicep = part(0.34, 0.42, 0.34, M.skin);
      sh.add(bicep);
      const el = new THREE.Group();
      el.position.y = -0.42;
      sh.add(el);
      const forearm = part(0.28, 0.4, 0.28, M.skinL);
      el.add(forearm);
      const wr = new THREE.Group();
      wr.position.y = -0.4;
      el.add(wr);
      wr.add(box(0.29, 0.06, 0.29, M.band, 0, -0.03, 0)); // напульсник
      wr.add(part(0.24, 0.16, 0.24, M.skinD)); // кисть
      return { sh, el, wr };
    };
    const gArmL = arm(-1), gArmR = arm(1);

    // ---- НОГИ — тентакли, сужающиеся, с присосками ----
    const tentacle = (side) => {
      const hp = new THREE.Group();
      hp.position.set(side * 0.22, -0.1, 0);
      gHips.add(hp);
      hp.add(part(0.32, 0.5, 0.32, M.skin));
      const kn = new THREE.Group();
      kn.position.y = -0.5;
      hp.add(kn);
      kn.add(part(0.24, 0.44, 0.24, M.skinL));
      const an = new THREE.Group();
      an.position.y = -0.44;
      kn.add(an);
      an.add(part(0.15, 0.28, 0.15, M.skinD)); // тонкий кончик
      an.add(box(0.19, 0.06, 0.19, M.sucker, 0, -0.3, 0)); // присоска-«стопа»
      // мелкие присоски по кончику
      for (let i = 0; i < 2; i++) {
        an.add(box(0.16, 0.03, 0.03, M.sucker, 0, -0.08 - i * 0.09, 0.075));
      }
      return { hp, kn, an };
    };
    const gLegL = tentacle(-1), gLegR = tentacle(1);

    // ============================================================
    // ШМЕЛЬ — для ульты «Полёт»
    // ============================================================
    const bee = new THREE.Group();
    scene.add(bee);
    bee.visible = false;

    const bBody = new THREE.Group();
    bee.add(bBody);
    bBody.add(box(0.5, 0.44, 0.5, M.bee, 0, 0, 0.1));           // грудь
    bBody.add(box(0.44, 0.4, 0.6, M.bee, 0, -0.02, -0.42));      // брюшко
    for (let i = 0; i < 3; i++) {
      bBody.add(box(0.46, 0.42, 0.09, M.beeD, 0, -0.02, -0.2 - i * 0.16)); // полоски
    }
    const bHead = new THREE.Group();
    bHead.position.set(0, 0.02, 0.42);
    bBody.add(bHead);
    bHead.add(box(0.3, 0.3, 0.26, M.beeD, 0, 0, 0));
    for (const sx of [-1, 1]) {
      bHead.add(box(0.1, 0.1, 0.04, M.white, sx * 0.09, 0.03, 0.14));
      bHead.add(box(0.05, 0.05, 0.05, M.pupil, sx * 0.09, 0.03, 0.16));
      bHead.add(box(0.03, 0.16, 0.03, M.beeD, sx * 0.08, 0.2, 0.02)); // усик
    }

    // крылья — машут
    const makeWing = (side) => {
      const g = new THREE.Group();
      g.position.set(side * 0.2, 0.24, 0.05);
      const wg = new THREE.PlaneGeometry(0.55, 0.32);
      wg.translate(side * 0.28, 0, 0);
      const w = new THREE.Mesh(wg, M.wing);
      g.add(w);
      bBody.add(g);
      return g;
    };
    const bWingL = makeWing(-1), bWingR = makeWing(1);

    // лапки шмеля — за них держится Гаргашмель в полёте
    const beeLeg = (side) => {
      const g = new THREE.Group();
      g.position.set(side * 0.2, -0.2, 0.1);
      bBody.add(g);
      g.add(part(0.06, 0.4, 0.06, M.beeD));
      return g;
    };
    const bLegL = beeLeg(-1), bLegR = beeLeg(1);

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
    const clock = new THREE.Clock();
    let raf;

    const resetRig = () => {
      gLegL.hp.rotation.set(0, 0, 0);
      gLegR.hp.rotation.set(0, 0, 0);
      gLegL.kn.rotation.set(0, 0, 0);
      gLegR.kn.rotation.set(0, 0, 0);
      gLegL.hp.position.set(-0.22, -0.1, 0);
      gLegR.hp.position.set(0.22, -0.1, 0);
      gArmL.sh.rotation.set(0, 0, 0);
      gArmR.sh.rotation.set(0, 0, 0);
      gArmL.el.rotation.set(0, 0, 0);
      gArmR.el.rotation.set(0, 0, 0);
      gTorso.rotation.set(0, 0, 0);
      gTorso.position.set(0, 0, 0);
      gNeck.rotation.set(0, 0, 0);
    };

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const t = clock.getElapsedTime();
      const p = api.current.pose;
      resetRig();

      if (p !== 'fly') {
        bee.visible = false;
        garg.position.set(0, 0, 0);
        garg.rotation.x = 0;
      }

      if (p === 'idle') {
        const b = Math.sin(t * 1.6) * 0.018;
        gHips.position.y = 1.16 + b;
        gArmL.sh.rotation.x = Math.sin(t * 1.6) * 0.06;
        gArmR.sh.rotation.x = -Math.sin(t * 1.6) * 0.06;
        gNeck.rotation.y = Math.sin(t * 0.55) * 0.2;
      }
      else if (p === 'walk') {
        const ph = t * 6.5;
        gHips.position.y = 1.16 + Math.abs(Math.sin(ph)) * 0.05;
        gTorso.rotation.x = 0.08;
        gTorso.rotation.z = Math.sin(ph) * 0.03;
        gArmL.sh.rotation.x = -Math.sin(ph) * 0.7;
        gArmR.sh.rotation.x = Math.sin(ph) * 0.7;
        gArmL.el.rotation.x = -0.3 - Math.max(0, -Math.sin(ph)) * 0.4;
        gArmR.el.rotation.x = -0.3 - Math.max(0, Math.sin(ph)) * 0.4;
        gLegL.hp.rotation.x = Math.sin(ph) * 0.75;
        gLegR.hp.rotation.x = -Math.sin(ph) * 0.75;
        gLegL.kn.rotation.x = 0.15 + Math.max(0, -Math.sin(ph)) * 0.9;
        gLegR.kn.rotation.x = 0.15 + Math.max(0, Math.sin(ph)) * 0.9;
        gNeck.rotation.set(-0.05, 0, 0);
      }
      else if (p === 'jump') {
        gHips.position.y = 1.3 + Math.sin(t * 2.2) * 0.03;
        gTorso.rotation.set(-0.1, 0, 0);
        gArmL.sh.rotation.x = -2.3;
        gArmR.sh.rotation.x = -2.3;
        gArmL.el.rotation.x = -0.4; gArmR.el.rotation.x = -0.4;
        gLegL.hp.rotation.x = -0.85; gLegR.hp.rotation.x = -0.3;
        gLegL.kn.rotation.x = 1.3; gLegR.kn.rotation.x = 0.5;
        gNeck.rotation.set(-0.15, 0, 0);
      }
      else if (p === 'flex') {
        // мускулы — двойной бицепс
        gHips.position.y = 1.16 + Math.sin(t * 3) * 0.01;
        gTorso.rotation.x = -0.04;
        gArmL.sh.rotation.set(0, 0, 1.55 + Math.sin(t * 4) * 0.02);
        gArmR.sh.rotation.set(0, 0, -1.55 - Math.sin(t * 4) * 0.02);
        gArmL.el.rotation.z = -1.9;
        gArmR.el.rotation.z = 1.9;
        gLegL.hp.rotation.x = 0.05; gLegR.hp.rotation.x = 0.05;
        gNeck.rotation.set(-0.06, 0.05, 0);
      }
      else if (p === 'fly') {
        // УЛЬТА: держится за лапы шмеля и летит
        bee.visible = true;
        const ph = t * 12;
        const flap = Math.sin(ph) * 0.9;
        bWingL.rotation.z = flap;
        bWingR.rotation.z = -flap;
        const altitude = 2.2 + Math.sin(t * 1.4) * 0.15;
        const drift = Math.sin(t * 0.7) * 0.4;
        bee.position.set(drift * 0.3, altitude, 0);
        bee.rotation.x = 0.12 + Math.sin(t * 1.4) * 0.05;
        bee.rotation.z = Math.sin(t * 0.9) * 0.08;

        garg.position.set(drift * 0.3, altitude - 0.78, 0);
        garg.rotation.x = 1.15; // тело почти горизонтально, летит следом
        gTorso.rotation.x = -0.1;
        gTorso.position.z = -0.05;
        gArmL.sh.rotation.x = -2.5;
        gArmR.sh.rotation.x = -2.5;
        gArmL.el.rotation.x = -0.15; gArmR.el.rotation.x = -0.15;
        // кисти тянутся к лапкам шмеля
        gLegL.hp.rotation.x = -0.2 + Math.sin(t * 5) * 0.08;
        gLegR.hp.rotation.x = -0.2 - Math.sin(t * 5) * 0.08;
        gLegL.kn.rotation.x = 0.3;
        gLegR.kn.rotation.x = 0.3;
        gNeck.rotation.set(0.25, 0, 0);
      }

      if (api.current.spin && !dragging) rotY += 0.0035;
      garg.rotation.y = rotY; bee.rotation.y = p === 'fly' ? rotY : rotY;
      garg.rotation.x += p === 'fly' ? 0 : rotX * 0.2;
      bee.rotation.x += p === 'fly' ? 0 : rotX * 0.2;
      const camY = p === 'fly' ? 2.4 : 1.7;
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
        <div style={{ fontSize: 11, color: '#6f7789', letterSpacing: '.08em' }}>ПЕРСОНАЖ · БЛОЧНЫЙ СТИЛЬ</div>
        <div style={{ fontSize: 27, fontWeight: 600, lineHeight: 1.1 }}>Гаргашмель</div>
        <div style={{ fontSize: 12, color: '#6f7789', marginTop: 4 }}>тяни мышкой, чтобы повернуть</div>
      </div>

      <div style={{
        position: 'absolute', bottom: 18, left: 0, right: 0, display: 'flex',
        gap: 8, justifyContent: 'center', flexWrap: 'wrap', padding: '0 14px',
      }}>
        <button style={btn(pose === 'idle')} onClick={() => setPose('idle')}>Стоит</button>
        <button style={btn(pose === 'walk')} onClick={() => setPose('walk')}>Идёт</button>
        <button style={btn(pose === 'jump')} onClick={() => setPose('jump')}>Прыжок</button>
        <button style={btn(pose === 'flex')} onClick={() => setPose('flex')}>Мускулы</button>
        <button style={btn(pose === 'fly')} onClick={() => setPose('fly')}>Ульта: Полёт</button>
        <button style={btn(spin)} onClick={() => setSpin(!spin)}>Вращение</button>
      </div>
    </div>
  );
}
