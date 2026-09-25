import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

// ============================================================
// СМИТАНА — блочный стиль
// белый накачанный, чёрная маска с белыми прорезями для глаз
// ульта: красный спортивный мотоцикл
// ============================================================

export default function SmitanaBlocky() {
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
    scene.background = new THREE.Color(0x15171e);
    scene.fog = new THREE.Fog(0x15171e, 11, 27);

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 1.8, 7.6);

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
    scene.add(new THREE.AmbientLight(0x525a6b, 0.8));
    const key = new THREE.DirectionalLight(0xfff2de, 1.7);
    key.position.set(4.5, 8, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -6; key.shadow.camera.right = 6;
    key.shadow.camera.top = 6; key.shadow.camera.bottom = -6;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x6a8ed6, 0.5);
    fill.position.set(-5, 2, 4);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xdce8ff, 1.4);
    rim.position.set(-2, 4, -6);
    scene.add(rim);

    // ---------- МАТЕРИАЛЫ ----------
    const mat = (c, r = 0.85) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: 0 });
    const M = {
      skin:   mat(0xefece4),
      skinD:  mat(0xc9c5ba),  // тень: шея, кисти, стопы
      skinL:  mat(0xffffff, 0.7), // блик: грудь
      mask:   mat(0x101114, 0.55),
      maskL:  mat(0x1c1e24, 0.55),
      eye:    new THREE.MeshStandardMaterial({ color: 0xf4f4f2, roughness: 0.3, emissive: 0x9aa0aa, emissiveIntensity: 0.25 }),
      shorts: mat(0x101114, 0.6),
      stripe: mat(0xc4232c, 0.5),
      // мотоцикл
      moto:   mat(0xc4232c, 0.35),
      motoD:  mat(0x8c1620, 0.35),
      chrome: mat(0xd8dadf, 0.15),
      tire:   mat(0x111214, 0.9),
      rim:    mat(0xa8acb4, 0.25),
      glass:  new THREE.MeshStandardMaterial({ color: 0x1a1d22, roughness: 0.2, transparent: true, opacity: 0.75 }),
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
    const cyl = (rt, rb, h, material, x = 0, y = 0, z = 0, rotZ = 0) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 14), material);
      m.position.set(x, y, z);
      m.rotation.z = rotZ;
      m.castShadow = true;
      m.receiveShadow = true;
      return m;
    };

    // ============================================================
    // СМИТАНА
    // ============================================================
    const smi = new THREE.Group();
    scene.add(smi);

    const hips = new THREE.Group();
    hips.position.y = 1.15;
    smi.add(hips);

    const torso = new THREE.Group();
    hips.add(torso);

    torso.add(box(0.94, 0.28, 0.48, M.skin, 0, 1.03, 0));   // плечи/грудь
    torso.add(box(0.68, 0.4, 0.44, M.skin, 0, 0.7, 0));     // рёбра
    torso.add(box(0.54, 0.4, 0.4, M.skin, 0, 0.34, 0));     // талия
    torso.add(box(0.34, 0.22, 0.1, M.skinL, -0.18, 0.98, 0.25));
    torso.add(box(0.34, 0.22, 0.1, M.skinL, 0.18, 0.98, 0.25));
    for (let i = 0; i < 3; i++) {
      const y = 0.76 - i * 0.14;
      torso.add(box(0.12, 0.09, 0.09, M.skinD, -0.09, y, 0.23));
      torso.add(box(0.12, 0.09, 0.09, M.skinD, 0.09, y, 0.23));
    }
    torso.add(box(0.3, 0.14, 0.28, M.skinD, 0, 1.21, 0)); // шея
    torso.add(box(0.58, 0.24, 0.42, M.shorts, 0, 0.11, 0));
    torso.add(box(0.6, 0.05, 0.44, M.stripe, 0, 0.0, 0)); // красная полоса на шортах

    // ---- ГОЛОВА — своя кожа, маска только на лице (не шлем) ----
    const head = new THREE.Group();
    head.position.set(0, 1.3, 0);
    torso.add(head);

    const HS = 0.72;
    const HF = HS / 2 + 0.001;
    // база головы — белая кожа, как и тело
    head.add(box(HS, HS, HS * 0.92, M.skin, 0, HS / 2, 0));
    head.add(box(HS * 0.98, HS * 0.98, 0.01, M.skinL, 0, HS / 2, HF - 0.01)); // блик лица
    // уши — видны, значит маска точно не шлем
    head.add(box(0.06, 0.16, 0.13, M.skinD, HS * 0.52, HS * 0.48, 0));
    head.add(box(0.06, 0.16, 0.13, M.skinD, -HS * 0.52, HS * 0.48, 0));

    // маска — узкая чёрная полоса только через глаза и переносицу,
    // лоб, виски, скулы, челюсть и подбородок остаются открытой кожей
    const maskY = HS * 0.62;      // высота полосы над низом головы
    const maskH = 0.22;
    head.add(box(HS * 0.86, maskH, 0.04, M.mask, 0, maskY, HF));         // сама полоса
    head.add(box(HS * 0.9, 0.03, 0.045, M.maskL, 0, maskY + maskH / 2, HF)); // верхний кант
    head.add(box(HS * 0.9, 0.03, 0.045, M.maskL, 0, maskY - maskH / 2, HF)); // нижний кант
    // полоска маски огибает виски (коротко, не уходит на затылок)
    head.add(box(0.05, maskH, 0.14, M.mask, HS * 0.47, maskY, 0));
    head.add(box(0.05, maskH, 0.14, M.mask, -HS * 0.47, maskY, 0));

    // прорези для глаз в маске — белые полосы
    for (const sx of [-1, 1]) {
      head.add(box(0.17, 0.07, 0.05, M.eye, sx * 0.16, maskY, HF + 0.005));
    }
    // переносица маски — маленький выступ между глаз
    head.add(box(0.08, maskH * 0.7, 0.05, M.mask, 0, maskY - 0.02, HF + 0.01));

    // ---- РУКИ ----
    const arm = (side) => {
      const sh = new THREE.Group();
      sh.position.set(side * 0.6, 1.12, 0);
      torso.add(sh);
      sh.add(box(0.25, 0.25, 0.25, M.skinL, side * 0.02, -0.02, 0));
      sh.add(part(0.33, 0.41, 0.33, M.skin));
      const el = new THREE.Group();
      el.position.y = -0.41;
      sh.add(el);
      el.add(part(0.27, 0.39, 0.27, M.skinL));
      const wr = new THREE.Group();
      wr.position.y = -0.39;
      el.add(wr);
      wr.add(part(0.23, 0.16, 0.23, M.skinD));
      return { sh, el, wr };
    };
    const armL = arm(-1), armR = arm(1);

    // ---- НОГИ ----
    const leg = (side) => {
      const hp = new THREE.Group();
      hp.position.set(side * 0.2, 0, 0);
      hips.add(hp);
      hp.add(part(0.35, 0.57, 0.35, M.skin));
      const kn = new THREE.Group();
      kn.position.y = -0.57;
      hp.add(kn);
      kn.add(part(0.27, 0.49, 0.27, M.skinL));
      const an = new THREE.Group();
      an.position.y = -0.49;
      kn.add(an);
      an.add(box(0.29, 0.15, 0.42, M.skinD, 0, -0.07, 0.07));   // стопа
      an.add(box(0.3, 0.05, 0.44, M.mask, 0, -0.15, 0.06));     // чёрная подошва
      return { hp, kn, an };
    };
    const legL = leg(-1), legR = leg(1);

    // ============================================================
    // МОТОЦИКЛ — для ульты (с вилкой и маятником, не «тележка»)
    // ============================================================
    const bike = new THREE.Group();
    scene.add(bike);
    bike.visible = false;

    // тонкая деталь-«стойка» между двумя точками — вилка, маятник, рама
    const strut = (x1, y1, z1, x2, y2, z2, material, th = 0.06) => {
      const p1 = new THREE.Vector3(x1, y1, z1);
      const p2 = new THREE.Vector3(x2, y2, z2);
      const mid = p1.clone().add(p2).multiplyScalar(0.5);
      const len = p1.distanceTo(p2);
      const m = new THREE.Mesh(new THREE.BoxGeometry(th, len, th), material);
      m.position.copy(mid);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p2.clone().sub(p1).normalize());
      m.castShadow = true;
      bike.add(m);
      return m;
    };

    const R = 0.42; // радиус колеса
    const FRONT_X = 0.86, REAR_X = -0.8;
    const HEAD = { x: 0.72, y: 1.0, z: 0.52 };  // точка рулевой колонки (верх вилки)
    const PIVOT = { x: 0.02, y: 0.62, z: -0.05 }; // точка крепления маятника (под мотором)

    const wheel = (x) => {
      const g = new THREE.Group();
      g.position.set(x, R, 0);
      g.rotation.z = Math.PI / 2;
      g.add(cyl(R, R, 0.2, M.tire, 0, 0, 0));
      g.add(cyl(R * 0.55, R * 0.55, 0.21, M.rim, 0, 0, 0));
      g.add(cyl(0.06, 0.06, 0.23, M.chrome, 0, 0, 0)); // ступица
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const spoke = box(R * 0.9, 0.03, 0.03, M.chrome, 0, 0, 0);
        spoke.rotation.x = a;
        g.add(spoke);
      }
      bike.add(g);
      return g;
    };
    const wFront = wheel(FRONT_X), wRear = wheel(REAR_X);

    const frame = new THREE.Group();
    bike.add(frame);

    // передняя вилка — две наклонные трубы от оси переднего колеса к рулевой колонке
    strut(FRONT_X, R, 0.09, HEAD.x, HEAD.y, HEAD.z, M.chrome, 0.05);
    strut(FRONT_X, R, -0.09, HEAD.x, HEAD.y, HEAD.z, M.chrome, 0.05);
    // верхняя труба рамы — от рулевой колонки к подседельной зоне
    strut(HEAD.x, HEAD.y, HEAD.z, 0.0, 0.92, -0.4, M.motoD, 0.08);
    // нижняя труба — от рулевой колонки к мотору
    strut(HEAD.x, HEAD.y - 0.08, HEAD.z, PIVOT.x, PIVOT.y, PIVOT.z, M.motoD, 0.07);
    // маятник — от мотора к оси заднего колеса
    strut(PIVOT.x, PIVOT.y, PIVOT.z, REAR_X, R, 0.1, M.motoD, 0.08);
    strut(PIVOT.x, PIVOT.y, PIVOT.z, REAR_X, R, -0.1, M.motoD, 0.08);
    // амортизатор
    strut(-0.15, 0.85, -0.25, REAR_X + 0.1, R + 0.1, 0, M.chrome, 0.04);

    // мотор
    frame.add(box(0.3, 0.3, 0.4, M.motoD, 0.06, 0.6, 0));
    frame.add(box(0.32, 0.06, 0.42, M.chrome, 0.06, 0.44, 0)); // картер снизу

    // бак и сиденье
    frame.add(box(0.4, 0.24, 0.5, M.moto, 0.28, 0.9, 0.2));    // бак
    frame.add(box(0.32, 0.1, 0.5, M.moto, -0.08, 0.9, -0.35)); // сиденье
    frame.add(box(0.3, 0.08, 0.14, M.motoD, -0.28, 0.88, -0.62)); // хвост

    // передний обтекатель / фара / стекло — на рулевой колонке
    frame.add(box(0.3, 0.22, 0.16, M.moto, HEAD.x + 0.1, HEAD.y - 0.05, HEAD.z + 0.08));
    frame.add(box(0.28, 0.15, 0.04, M.glass, HEAD.x + 0.1, HEAD.y + 0.08, HEAD.z + 0.16));
    frame.add(box(0.16, 0.1, 0.08, M.chrome, HEAD.x + 0.16, HEAD.y - 0.1, HEAD.z + 0.16));

    // руль на рулевой колонке
    frame.add(box(0.55, 0.05, 0.08, M.mask, HEAD.x, HEAD.y + 0.16, HEAD.z));
    frame.add(box(0.05, 0.12, 0.05, M.chrome, HEAD.x + 0.26, HEAD.y + 0.1, HEAD.z));
    frame.add(box(0.05, 0.12, 0.05, M.chrome, HEAD.x - 0.26, HEAD.y + 0.1, HEAD.z));

    // выхлоп вдоль правого борта
    strut(0.15, 0.52, 0.15, REAR_X + 0.15, 0.4, 0.16, M.chrome, 0.08);
    frame.add(box(0.1, 0.1, 0.1, M.chrome, REAR_X + 0.05, 0.4, 0.16));

    // подножки
    frame.add(box(0.05, 0.05, 0.16, M.motoD, 0.1, 0.52, 0.28));
    frame.add(box(0.05, 0.05, 0.16, M.motoD, 0.1, 0.52, -0.28));

    // ---------- ЗЕМЛЯ ----------
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(7, 4),
      new THREE.MeshStandardMaterial({ color: 0x1d2029, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.rotation.z = Math.PI / 4;
    ground.receiveShadow = true;
    scene.add(ground);
    const grid = new THREE.GridHelper(14, 14, 0x2c313d, 0x212530);
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

      if (p !== 'moto') {
        bike.visible = false;
        smi.position.set(0, 0, 0);
        smi.rotation.x = 0;
        frame.rotation.x = 0;
        bike.rotation.set(0, 0, 0);
      }

      if (p === 'idle') {
        const b = Math.sin(t * 1.6) * 0.018;
        hips.position.y = 1.15 + b;
        armL.sh.rotation.x = Math.sin(t * 1.6) * 0.06;
        armR.sh.rotation.x = -Math.sin(t * 1.6) * 0.06;
        head.rotation.y = Math.sin(t * 0.55) * 0.2;
      }
      else if (p === 'walk') {
        const ph = t * 6.5;
        hips.position.y = 1.15 + Math.abs(Math.sin(ph)) * 0.05;
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
        hips.position.y = 1.29 + Math.sin(t * 2.2) * 0.03;
        torso.rotation.set(-0.1, 0, 0);
        armL.sh.rotation.x = -2.3;
        armR.sh.rotation.x = -2.3;
        armL.el.rotation.x = -0.4; armR.el.rotation.x = -0.4;
        legL.hp.rotation.x = -0.85; legR.hp.rotation.x = -0.3;
        legL.kn.rotation.x = 1.3; legR.kn.rotation.x = 0.5;
        head.rotation.set(-0.15, 0, 0);
      }
      else if (p === 'flex') {
        hips.position.y = 1.15 + Math.sin(t * 3) * 0.01;
        torso.rotation.x = -0.04;
        armL.sh.rotation.set(0, 0, 1.55 + Math.sin(t * 4) * 0.02);
        armR.sh.rotation.set(0, 0, -1.55 - Math.sin(t * 4) * 0.02);
        armL.el.rotation.z = -1.9;
        armR.el.rotation.z = 1.9;
        legL.hp.rotation.x = 0.05; legR.hp.rotation.x = 0.05;
        head.rotation.set(-0.06, 0.05, 0);
      }
      else if (p === 'moto') {
        // УЛЬТА: красный мотоцикл, заезд с приподнятым передним колесом
        bike.visible = true;
        const ph = t * 1.2;
        const wheelie = Math.max(0, Math.sin(ph * 0.8)) * 0.28;
        bike.position.set(0, 0, 0);
        bike.rotation.x = -wheelie;
        wFront.rotation.x += t * 14;
        wRear.rotation.x += t * 16;

        smi.position.set(0.1, -0.15 + wheelie * 0.9, -0.25);
        smi.rotation.x = -wheelie * 0.9;
        torso.rotation.x = 0.55; // наклон вперёд, гоночная посадка
        armL.sh.rotation.x = -1.5; armL.sh.rotation.z = 0.25;
        armR.sh.rotation.x = -1.5; armR.sh.rotation.z = -0.25;
        armL.el.rotation.x = -0.5; armR.el.rotation.x = -0.5;
        legL.hp.position.set(-0.24, 0, -0.1);
        legR.hp.position.set(0.24, 0, -0.1);
        legL.hp.rotation.x = -1.15; legR.hp.rotation.x = -1.15;
        legL.kn.rotation.x = 1.45; legR.kn.rotation.x = 1.45;
        head.rotation.set(0.15, 0, 0);
      }

      if (api.current.spin && !dragging) rotY += 0.0035;
      smi.rotation.y = p === 'moto' ? rotY : rotY;
      bike.rotation.y = rotY;
      smi.rotation.x += p === 'moto' ? 0 : rotX * 0.2;
      bike.rotation.x += p === 'moto' ? 0 : rotX * 0.2;
      const camY = p === 'moto' ? 2.0 : 1.7;
      camera.position.y = camY + rotX * 2;
      camera.lookAt(0, p === 'moto' ? 1.1 : 1.3, 0);
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
    background: a ? '#c4232c' : 'transparent',
    color: a ? '#15171e' : '#c8ccd8',
    border: a ? 'none' : '1px solid #333b4c',
    padding: '9px 15px',
    fontSize: 14,
    fontFamily: "'Oswald','Arial Narrow',system-ui,sans-serif",
    cursor: 'pointer',
  });

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100vh', maxHeight: 860,
      background: '#15171e', overflow: 'hidden',
      fontFamily: "'Oswald','Arial Narrow',system-ui,sans-serif",
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;600&display=swap');`}</style>
      <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />

      <div style={{ position: 'absolute', top: 16, left: 18, color: '#c8ccd8', pointerEvents: 'none' }}>
        <div style={{ fontSize: 11, color: '#6f7789', letterSpacing: '.08em' }}>ПЕРСОНАЖ · БЛОЧНЫЙ СТИЛЬ</div>
        <div style={{ fontSize: 27, fontWeight: 600, lineHeight: 1.1 }}>Смитана</div>
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
        <button style={btn(pose === 'moto')} onClick={() => setPose('moto')}>Ульта: Мотоцикл</button>
        <button style={btn(spin)} onClick={() => setSpin(!spin)}>Вращение</button>
      </div>
    </div>
  );
}
