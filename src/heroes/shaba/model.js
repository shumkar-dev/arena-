import * as THREE from 'three';

// ============================================================
// ШАБА + ЧЁРНЫЙ БАРАН — игровая модель
// Геометрия та же, что в превью shaba-blocky.jsx, но без сцены,
// камеры и UI: возвращает группу и функцию позы для игрового цикла.
// Модель смотрит в +Z, рост ≈ 2.45.
// ============================================================

const mat = (c, r = 0.95) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: 0 });

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

export function createShaba() {
  const M = {
    skin:   mat(0x77492b),
    skinD:  mat(0x60381f),
    skinL:  mat(0x8a5733),
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

  const root = new THREE.Group();

  // ---------------- ШАБА ----------------
  const shaba = new THREE.Group();
  root.add(shaba);

  const sHips = new THREE.Group();
  sHips.position.y = 1.2;
  shaba.add(sHips);

  const sTorso = new THREE.Group();
  sHips.add(sTorso);

  sTorso.add(box(0.8, 1.14, 0.42, M.tank, 0, 0.57, 0));
  sTorso.add(box(0.02, 1.14, 0.44, M.tankD, 0.4, 0.57, 0));
  sTorso.add(box(0.02, 1.14, 0.44, M.tankD, -0.4, 0.57, 0));
  sTorso.add(box(0.44, 0.16, 0.44, M.skin, 0, 1.11, 0));
  sTorso.add(box(0.3, 0.14, 0.3, M.skinD, 0, 1.2, 0));

  const sNeck = new THREE.Group();
  sNeck.position.set(0, 1.26, 0);
  sTorso.add(sNeck);

  const HS = 0.8;
  const HF = HS / 2 + 0.001;
  sNeck.add(box(HS, HS, HS, M.skin, 0, HS / 2, 0));
  sNeck.add(box(HS * 0.98, HS * 0.98, 0.01, M.skinL, 0, HS / 2, HF));

  sNeck.add(box(0.84, 0.1, 0.84, M.hair, 0, HS - 0.02, 0));
  sNeck.add(box(0.84, 0.44, 0.08, M.hair, 0, HS - 0.24, -0.4));
  sNeck.add(box(0.08, 0.4, 0.8, M.hair, 0.4, HS - 0.24, 0));
  sNeck.add(box(0.08, 0.4, 0.8, M.hair, -0.4, HS - 0.24, 0));
  sNeck.add(box(0.8, 0.08, 0.06, M.hair, 0, HS - 0.11, HF - 0.02));

  sNeck.add(box(0.8, 0.24, 0.07, M.hair, 0, 0.16, HF));
  sNeck.add(box(0.09, 0.5, 0.08, M.hair, 0.36, 0.28, HF - 0.04));
  sNeck.add(box(0.09, 0.5, 0.08, M.hair, -0.36, 0.28, HF - 0.04));
  sNeck.add(box(0.1, 0.42, 0.82, M.hair, 0.405, 0.3, 0));
  sNeck.add(box(0.1, 0.42, 0.82, M.hair, -0.405, 0.3, 0));
  sNeck.add(box(0.26, 0.07, 0.07, M.hair, 0, 0.34, HF));

  for (const sx of [-1, 1]) {
    sNeck.add(box(0.17, 0.13, 0.04, M.white, sx * 0.17, 0.52, HF));
    sNeck.add(box(0.08, 0.13, 0.05, M.pupil, sx * 0.185, 0.52, HF + 0.005));
    sNeck.add(box(0.21, 0.06, 0.05, M.hair, sx * 0.17, 0.63, HF));
  }
  sNeck.add(box(0.14, 0.13, 0.08, M.skinD, 0, 0.42, HF + 0.02));
  sNeck.add(box(0.06, 0.16, 0.14, M.skinD, 0.42, 0.46, 0));
  sNeck.add(box(0.06, 0.16, 0.14, M.skinD, -0.42, 0.46, 0));

  const arm = (side) => {
    const sh = new THREE.Group();
    sh.position.set(side * 0.58, 1.06, 0);
    sTorso.add(sh);
    sh.add(part(0.36, 0.95, 0.36, M.skin));
    const el = new THREE.Group();
    el.position.y = -0.95;
    sh.add(el);
    el.add(part(0.34, 0.2, 0.34, M.skinD));
    return { sh, el };
  };
  const sArmL = arm(-1), sArmR = arm(1);

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

  // ---------------- ЧЁРНЫЙ БАРАН ----------------
  const ram = new THREE.Group();
  ram.visible = false;
  root.add(ram);

  const rBody = new THREE.Group();
  rBody.position.y = 0.82;
  ram.add(rBody);

  rBody.add(box(0.78, 0.7, 1.5, M.wool, 0, 0, 0));
  rBody.add(box(0.8, 0.16, 1.52, M.woolD, 0, -0.36, 0));
  rBody.add(box(0.3, 0.26, 0.16, M.woolD, 0, 0.2, -0.8));

  const rNeck = new THREE.Group();
  rNeck.position.set(0, 0.2, 0.72);
  rBody.add(rNeck);
  rNeck.add(box(0.44, 0.44, 0.34, M.wool, 0, 0, 0.1));

  const rHead = new THREE.Group();
  rHead.position.set(0, 0.06, 0.36);
  rNeck.add(rHead);
  rHead.add(box(0.52, 0.5, 0.52, M.wool, 0, 0, 0));
  rHead.add(box(0.32, 0.28, 0.3, M.woolD, 0, -0.13, 0.38));
  rHead.add(box(0.08, 0.06, 0.06, M.hoof, 0.08, -0.08, 0.53));
  rHead.add(box(0.08, 0.06, 0.06, M.hoof, -0.08, -0.08, 0.53));

  for (const sx of [-1, 1]) {
    rHead.add(box(0.22, 0.1, 0.14, M.woolD, sx * 0.34, 0.06, -0.02));
    rHead.add(box(0.12, 0.12, 0.05, M.white, sx * 0.17, 0.08, 0.27));
    rHead.add(box(0.06, 0.09, 0.06, M.pupil, sx * 0.18, 0.08, 0.29));
  }

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

  // ---------------- ПОЗЫ ----------------
  const resetRig = () => {
    sLegL.hp.rotation.set(0, 0, 0);
    sLegR.hp.rotation.set(0, 0, 0);
    sLegL.hp.position.set(-0.21, 0, 0);
    sLegR.hp.position.set(0.21, 0, 0);
    sLegL.kn.rotation.set(0, 0, 0);
    sLegR.kn.rotation.set(0, 0, 0);
    sArmL.sh.rotation.set(0, 0, 0);
    sArmR.sh.rotation.set(0, 0, 0);
    sArmL.el.rotation.set(0, 0, 0);
    sArmR.el.rotation.set(0, 0, 0);
    sTorso.rotation.set(0, 0, 0);
    sNeck.rotation.set(0, 0, 0);
    shaba.position.set(0, 0, 0);
    sHips.position.y = 1.2;
    ram.visible = false;
  };

  const poseIdle = (t) => {
    sHips.position.y = 1.2 + Math.sin(t * 1.6) * 0.018;
    sArmL.sh.rotation.x = Math.sin(t * 1.6) * 0.06;
    sArmR.sh.rotation.x = -Math.sin(t * 1.6) * 0.06;
    sNeck.rotation.y = Math.sin(t * 0.55) * 0.22;
  };

  // ph — фаза шага, её ведёт игровой цикл пропорционально пройденному пути
  const poseRun = (ph) => {
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
  };

  const poseRide = (ph, moving) => {
    const bob = moving ? Math.abs(Math.sin(ph)) * 0.1 : 0;
    ram.visible = true;
    ram.position.y = bob;
    rBody.rotation.x = moving ? Math.sin(ph * 2) * 0.06 : 0;
    rNeck.rotation.x = -0.1 + (moving ? Math.sin(ph * 2) * 0.1 : 0);
    const gal = (g, off) => {
      g.hp.rotation.x = moving ? Math.sin(ph + off) * 0.9 - 0.1 : 0;
      g.kn.rotation.x = moving ? 0.35 + Math.max(0, Math.sin(ph + off + 1.2)) * 0.8 : 0;
    };
    gal(rFL, 0); gal(rFR, 0.3);
    gal(rBL, Math.PI); gal(rBR, Math.PI + 0.3);

    shaba.position.set(0, 0, -0.12);
    sHips.position.y = 1.62 + bob;
    sTorso.rotation.set(0.25 + (moving ? Math.sin(ph * 2) * 0.05 : 0), 0, 0);
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
  };

  // удар поверх любой позы; k: 0..1 — прогресс, side: 1 — правая рука, −1 — левая
  const overlayPunch = (k, side) => {
    const a = side > 0 ? sArmR : sArmL;
    const s = Math.sin(k * Math.PI);
    a.sh.rotation.x = -1.55 * s + a.sh.rotation.x * (1 - s);
    a.el.rotation.x = -0.2 * s;
    sTorso.rotation.y = -0.35 * s * side;
  };

  // захват: обе руки вперёд, держит соперника перед собой; k: 0..1 — рывок, дальше удержание
  const overlayGrab = (k, t) => {
    const s = Math.min(1, k * 3);
    const shake = k >= 1 ? Math.sin(t * 22) * 0.06 : 0;
    for (const a of [sArmL, sArmR]) {
      a.sh.rotation.x = -1.35 * s + a.sh.rotation.x * (1 - s) + shake;
      a.sh.rotation.z = 0;
      a.el.rotation.x = -0.35 * s;
    }
    sArmL.sh.rotation.z = -0.25 * s;
    sArmR.sh.rotation.z = 0.25 * s;
    sTorso.rotation.x = -0.12 * s;
    sTorso.rotation.y = shake;
  };

  /**
   * state: { t, stride, moving, riding, punch, punchSide, grab }
   *  t         — время, с
   *  stride    — фаза шага (растёт с пройденной дистанцией)
   *  moving    — бежит ли персонаж
   *  riding    — ульта: верхом на баране
   *  punch     — null или 0..1 прогресс удара
   *  punchSide — 1 правая, −1 левая рука
   *  grab      — null или прогресс захвата (0..1 рывок, 1 — удержание)
   */
  const animate = ({ t, stride, moving, riding, punch, punchSide = 1, grab = null }) => {
    resetRig();
    if (riding) poseRide(stride, moving);
    else if (moving) poseRun(stride);
    else poseIdle(t);
    if (grab != null) overlayGrab(grab, t);
    else if (punch != null) overlayPunch(punch, punchSide);
  };

  return { root, animate };
}
