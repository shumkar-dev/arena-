import * as THREE from 'three';
import { mat, box, part, resetRig, poseIdle, poseRun } from './blocks.js';

// ============================================================
// ГАРГАШМЕЛЬ — игровая модель, ноги-щупальца
// Геометрия из превью gargashmel-blocky.jsx. Смотрит в +Z.
// createBee() — шмель для ульты (прилетает и взрывается).
// ============================================================

export function createGargashmel() {
  const M = {
    skin:    mat(0x2e9e93),
    skinD:   mat(0x1f7a71),
    skinL:   mat(0x45b7ab),
    brow:    mat(0x13332f),
    white:   mat(0xf4f2ea, 0.4),
    pupil:   mat(0x140d07, 0.4),
    shorts:  mat(0x22242c),
    shortsD: mat(0x17181e),
    band:    mat(0xe8e5da, 0.6),
    sucker:  mat(0x155650, 0.85),
  };

  const root = new THREE.Group();
  const garg = new THREE.Group();
  root.add(garg);

  const hips = new THREE.Group();
  hips.position.y = 1.16;
  garg.add(hips);

  const torso = new THREE.Group();
  hips.add(torso);

  torso.add(box(0.98, 0.3, 0.5, M.skin, 0, 1.06, 0));
  torso.add(box(0.7, 0.42, 0.46, M.skin, 0, 0.72, 0));
  torso.add(box(0.56, 0.42, 0.42, M.skin, 0, 0.34, 0));
  torso.add(box(0.36, 0.24, 0.1, M.skinL, -0.19, 1.0, 0.26));
  torso.add(box(0.36, 0.24, 0.1, M.skinL, 0.19, 1.0, 0.26));
  for (let i = 0; i < 3; i++) {
    const y = 0.78 - i * 0.15;
    torso.add(box(0.13, 0.1, 0.09, M.skinD, -0.1, y, 0.24));
    torso.add(box(0.13, 0.1, 0.09, M.skinD, 0.1, y, 0.24));
  }
  torso.add(box(0.34, 0.16, 0.32, M.skinD, 0, 1.24, 0));
  torso.add(box(0.6, 0.24, 0.44, M.shorts, 0, 0.11, 0));
  torso.add(box(0.62, 0.06, 0.46, M.shortsD, 0, 0.0, 0));

  // ---- голова ----
  const head = new THREE.Group();
  head.position.set(0, 1.32, 0);
  torso.add(head);

  const HS = 0.72;
  const HF = HS / 2 + 0.001;
  head.add(box(HS, HS, HS * 0.92, M.skin, 0, HS / 2, 0));
  head.add(box(HS * 0.96, HS * 0.96, 0.01, M.skinL, 0, HS / 2, HF - 0.02));
  head.add(box(HS * 0.9, 0.14, HS * 0.86, M.skinL, 0, 0.1, 0));
  for (const sx of [-1, 1]) {
    head.add(box(0.22, 0.06, 0.06, M.brow, sx * 0.16, 0.5, HF));
    head.add(box(0.15, 0.1, 0.04, M.white, sx * 0.16, 0.41, HF));
    head.add(box(0.07, 0.1, 0.05, M.pupil, sx * 0.175, 0.41, HF + 0.005));
  }
  head.add(box(0.16, 0.14, 0.3, M.skinL, 0, 0.28, HF + 0.14));
  head.add(box(0.1, 0.09, 0.08, M.skinD, 0, 0.24, HF + 0.28));
  head.add(box(0.3, 0.12, 0.06, M.skinL, 0, 0.05, HF));
  head.add(box(0.04, 0.05, 0.05, M.skinD, 0, 0.06, HF + 0.02));
  head.add(box(0.06, 0.16, 0.13, M.skinD, 0.37, 0.32, 0));
  head.add(box(0.06, 0.16, 0.13, M.skinD, -0.37, 0.32, 0));

  const arm = (side) => {
    const sh = new THREE.Group();
    sh.position.set(side * 0.62, 1.14, 0);
    torso.add(sh);
    sh.add(box(0.26, 0.26, 0.26, M.skinL, side * 0.02, -0.02, 0));
    sh.add(part(0.34, 0.42, 0.34, M.skin));
    const el = new THREE.Group();
    el.position.y = -0.42;
    sh.add(el);
    el.add(part(0.28, 0.4, 0.28, M.skinL));
    const wr = new THREE.Group();
    wr.position.y = -0.4;
    el.add(wr);
    wr.add(box(0.29, 0.06, 0.29, M.band, 0, -0.03, 0));
    wr.add(part(0.24, 0.16, 0.24, M.skinD));
    return { sh, el, wr };
  };
  const armL = arm(-1), armR = arm(1);

  const tentacle = (side) => {
    const hp = new THREE.Group();
    hp.position.set(side * 0.22, -0.1, 0);
    hips.add(hp);
    hp.add(part(0.32, 0.5, 0.32, M.skin));
    const kn = new THREE.Group();
    kn.position.y = -0.5;
    hp.add(kn);
    kn.add(part(0.24, 0.44, 0.24, M.skinL));
    const an = new THREE.Group();
    an.position.y = -0.44;
    kn.add(an);
    an.add(part(0.15, 0.28, 0.15, M.skinD));
    an.add(box(0.19, 0.06, 0.19, M.sucker, 0, -0.3, 0));
    for (let i = 0; i < 2; i++) an.add(box(0.16, 0.03, 0.03, M.sucker, 0, -0.08 - i * 0.09, 0.075));
    return { hp, kn, an };
  };
  const legL = tentacle(-1), legR = tentacle(1);

  const rig = { hips, hipsY: 1.16, torso, head, armL, armR, legL, legR, legX: 0.22, legY: -0.1 };

  // удар щупальцем: хлёст ногой вперёд и вверх; k: 0..1, side — какое щупальце
  const overlayWhip = (k, side) => {
    const l = side > 0 ? legR : legL, o = side > 0 ? legL : legR;
    const s = Math.sin(k * Math.PI);
    l.hp.rotation.x = -1.7 * s + l.hp.rotation.x * (1 - s);
    l.kn.rotation.x = -0.4 * s * Math.sin(k * Math.PI * 2);   // кончик щёлкает
    l.an.rotation.x = -0.6 * s;
    o.hp.rotation.x = 0.25 * s;
    o.kn.rotation.x = 0.4 * s;
    torso.rotation.x = -0.25 * s;
    hips.position.y = rig.hipsY - 0.08 * s;
    armL.sh.rotation.z = 0.5 * s; armR.sh.rotation.z = -0.5 * s;
  };

  // ускорение атаки: щупальца извиваются, руки в стойке
  const overlayFrenzy = (t) => {
    armL.sh.rotation.x = -0.6; armR.sh.rotation.x = -0.6;
    armL.el.rotation.x = -1.3; armR.el.rotation.x = -1.3;
    legL.an.rotation.z = Math.sin(t * 14) * 0.4;
    legR.an.rotation.z = -Math.sin(t * 14) * 0.4;
  };

  /**
   * state: { t, stride, moving, whip, whipSide, frenzy, cast }
   *  whip   — null или 0..1 удар щупальцем
   *  frenzy — активно ускорение базовой атаки
   *  cast   — null или 0..1 жест вызова шмеля (ульта)
   */
  const animate = ({ t, stride, moving, whip = null, whipSide = 1, frenzy = false, cast = null }) => {
    resetRig(rig);
    legL.an.rotation.set(0, 0, 0);
    legR.an.rotation.set(0, 0, 0);
    if (moving) poseRun(rig, stride);
    else poseIdle(rig, t);
    if (frenzy) overlayFrenzy(t);
    if (whip != null) overlayWhip(whip, whipSide);
    if (cast != null) {
      const s = Math.sin(cast * Math.PI);
      armR.sh.rotation.set(-2.6 * s, 0, 0);
      armR.el.rotation.x = 0;
      head.rotation.x = -0.3 * s;
    }
  };

  return { root, animate };
}

// ============================================================
// ШМЕЛЬ — большой, для ульты. Смотрит в +Z.
// ============================================================
export function createBee() {
  const M = {
    bee:   mat(0xf3c23a, 0.6),
    beeD:  mat(0x1a1712, 0.6),
    white: mat(0xf4f2ea, 0.4),
    pupil: mat(0x140d07, 0.4),
    wing:  new THREE.MeshStandardMaterial({ color: 0xeaf3ff, roughness: 0.3, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
  };

  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  body.add(box(0.5, 0.44, 0.5, M.bee, 0, 0, 0.1));
  body.add(box(0.44, 0.4, 0.6, M.bee, 0, -0.02, -0.42));
  for (let i = 0; i < 3; i++) body.add(box(0.46, 0.42, 0.09, M.beeD, 0, -0.02, -0.2 - i * 0.16));
  body.add(box(0.1, 0.1, 0.2, M.beeD, 0, -0.02, -0.8));   // жало
  const bHead = new THREE.Group();
  bHead.position.set(0, 0.02, 0.42);
  body.add(bHead);
  bHead.add(box(0.3, 0.3, 0.26, M.beeD));
  for (const sx of [-1, 1]) {
    bHead.add(box(0.1, 0.1, 0.04, M.white, sx * 0.09, 0.03, 0.14));
    bHead.add(box(0.05, 0.05, 0.05, M.pupil, sx * 0.09, 0.03, 0.16));
    bHead.add(box(0.03, 0.16, 0.03, M.beeD, sx * 0.08, 0.2, 0.02));
  }
  const wing = (side) => {
    const g = new THREE.Group();
    g.position.set(side * 0.2, 0.24, 0.05);
    const wg = new THREE.PlaneGeometry(0.55, 0.32);
    wg.translate(side * 0.28, 0, 0);
    g.add(new THREE.Mesh(wg, M.wing));
    body.add(g);
    return g;
  };
  const wL = wing(-1), wR = wing(1);

  const animate = (t) => {
    const flap = Math.sin(t * 60) * 0.9;
    wL.rotation.z = flap;
    wR.rotation.z = -flap;
  };

  return { root, animate };
}
