import * as THREE from 'three';
import { mat, box, part, cyl, resetRig, poseIdle, poseRun, overlayThrust } from './blocks.js';

// ============================================================
// СМИТАНА + КРАСНЫЙ МОТОЦИКЛ — игровая модель
// Геометрия из превью smitana-blocky.jsx. Смотрит в +Z, рост ≈ 2.45.
// ============================================================

export function createSmitana() {
  const M = {
    skin:   mat(0xefece4, 0.85),
    skinD:  mat(0xc9c5ba, 0.85),
    skinL:  mat(0xffffff, 0.7),
    mask:   mat(0x101114, 0.55),
    maskL:  mat(0x1c1e24, 0.55),
    eye:    new THREE.MeshStandardMaterial({ color: 0xf4f4f2, roughness: 0.3, emissive: 0x9aa0aa, emissiveIntensity: 0.25 }),
    shorts: mat(0x101114, 0.6),
    stripe: mat(0xc4232c, 0.5),
    moto:   mat(0xc4232c, 0.35),
    motoD:  mat(0x8c1620, 0.35),
    chrome: mat(0xd8dadf, 0.15),
    tire:   mat(0x111214, 0.9),
    rim:    mat(0xa8acb4, 0.25),
    glass:  new THREE.MeshStandardMaterial({ color: 0x1a1d22, roughness: 0.2, transparent: true, opacity: 0.75 }),
  };

  const root = new THREE.Group();
  // во время ульты крутится всё вместе — и Смитана, и мотоцикл
  const spinner = new THREE.Group();
  root.add(spinner);

  const smi = new THREE.Group();
  spinner.add(smi);

  const hips = new THREE.Group();
  hips.position.y = 1.15;
  smi.add(hips);

  const torso = new THREE.Group();
  hips.add(torso);

  torso.add(box(0.94, 0.28, 0.48, M.skin, 0, 1.03, 0));
  torso.add(box(0.68, 0.4, 0.44, M.skin, 0, 0.7, 0));
  torso.add(box(0.54, 0.4, 0.4, M.skin, 0, 0.34, 0));
  torso.add(box(0.34, 0.22, 0.1, M.skinL, -0.18, 0.98, 0.25));
  torso.add(box(0.34, 0.22, 0.1, M.skinL, 0.18, 0.98, 0.25));
  for (let i = 0; i < 3; i++) {
    const y = 0.76 - i * 0.14;
    torso.add(box(0.12, 0.09, 0.09, M.skinD, -0.09, y, 0.23));
    torso.add(box(0.12, 0.09, 0.09, M.skinD, 0.09, y, 0.23));
  }
  torso.add(box(0.3, 0.14, 0.28, M.skinD, 0, 1.21, 0));
  torso.add(box(0.58, 0.24, 0.42, M.shorts, 0, 0.11, 0));
  torso.add(box(0.6, 0.05, 0.44, M.stripe, 0, 0.0, 0));

  // ---- голова: маска только полосой через глаза ----
  const head = new THREE.Group();
  head.position.set(0, 1.3, 0);
  torso.add(head);

  const HS = 0.72;
  const HF = HS / 2 + 0.001;
  head.add(box(HS, HS, HS * 0.92, M.skin, 0, HS / 2, 0));
  head.add(box(HS * 0.98, HS * 0.98, 0.01, M.skinL, 0, HS / 2, HF - 0.01));
  head.add(box(0.06, 0.16, 0.13, M.skinD, HS * 0.52, HS * 0.48, 0));
  head.add(box(0.06, 0.16, 0.13, M.skinD, -HS * 0.52, HS * 0.48, 0));
  const maskY = HS * 0.62, maskH = 0.22;
  head.add(box(HS * 0.86, maskH, 0.04, M.mask, 0, maskY, HF));
  head.add(box(HS * 0.9, 0.03, 0.045, M.maskL, 0, maskY + maskH / 2, HF));
  head.add(box(HS * 0.9, 0.03, 0.045, M.maskL, 0, maskY - maskH / 2, HF));
  head.add(box(0.05, maskH, 0.14, M.mask, HS * 0.47, maskY, 0));
  head.add(box(0.05, maskH, 0.14, M.mask, -HS * 0.47, maskY, 0));
  for (const sx of [-1, 1]) head.add(box(0.17, 0.07, 0.05, M.eye, sx * 0.16, maskY, HF + 0.005));
  head.add(box(0.08, maskH * 0.7, 0.05, M.mask, 0, maskY - 0.02, HF + 0.01));

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
    an.add(box(0.29, 0.15, 0.42, M.skinD, 0, -0.07, 0.07));
    an.add(box(0.3, 0.05, 0.44, M.mask, 0, -0.15, 0.06));
    return { hp, kn, an };
  };
  const legL = leg(-1), legR = leg(1);

  const rig = { hips, hipsY: 1.15, torso, head, armL, armR, legL, legR, legX: 0.2, legY: 0 };

  // ---------------- МОТОЦИКЛ ----------------
  const bike = new THREE.Group();
  bike.visible = false;
  spinner.add(bike);

  const strut = (x1, y1, z1, x2, y2, z2, material, th = 0.06) => {
    const p1 = new THREE.Vector3(x1, y1, z1);
    const p2 = new THREE.Vector3(x2, y2, z2);
    const m = new THREE.Mesh(new THREE.BoxGeometry(th, p1.distanceTo(p2), th), material);
    m.position.copy(p1.clone().add(p2).multiplyScalar(0.5));
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p2.clone().sub(p1).normalize());
    m.castShadow = true;
    bike.add(m);
    return m;
  };

  const R = 0.42;
  const FRONT_X = 0.86, REAR_X = -0.8;
  const HEAD = { x: 0.72, y: 1.0, z: 0.52 };
  const PIVOT = { x: 0.02, y: 0.62, z: -0.05 };

  const wheel = (x) => {
    const g = new THREE.Group();
    g.position.set(x, R, 0);
    g.rotation.z = Math.PI / 2;
    g.add(cyl(R, R, 0.2, M.tire));
    g.add(cyl(R * 0.55, R * 0.55, 0.21, M.rim));
    g.add(cyl(0.06, 0.06, 0.23, M.chrome));
    for (let i = 0; i < 6; i++) {
      const spoke = box(R * 0.9, 0.03, 0.03, M.chrome);
      spoke.rotation.x = (i / 6) * Math.PI * 2;
      g.add(spoke);
    }
    bike.add(g);
    return g;
  };
  const wFront = wheel(FRONT_X), wRear = wheel(REAR_X);

  const frame = new THREE.Group();
  bike.add(frame);
  strut(FRONT_X, R, 0.09, HEAD.x, HEAD.y, HEAD.z, M.chrome, 0.05);
  strut(FRONT_X, R, -0.09, HEAD.x, HEAD.y, HEAD.z, M.chrome, 0.05);
  strut(HEAD.x, HEAD.y, HEAD.z, 0.0, 0.92, -0.4, M.motoD, 0.08);
  strut(HEAD.x, HEAD.y - 0.08, HEAD.z, PIVOT.x, PIVOT.y, PIVOT.z, M.motoD, 0.07);
  strut(PIVOT.x, PIVOT.y, PIVOT.z, REAR_X, R, 0.1, M.motoD, 0.08);
  strut(PIVOT.x, PIVOT.y, PIVOT.z, REAR_X, R, -0.1, M.motoD, 0.08);
  strut(-0.15, 0.85, -0.25, REAR_X + 0.1, R + 0.1, 0, M.chrome, 0.04);
  frame.add(box(0.3, 0.3, 0.4, M.motoD, 0.06, 0.6, 0));
  frame.add(box(0.32, 0.06, 0.42, M.chrome, 0.06, 0.44, 0));
  frame.add(box(0.4, 0.24, 0.5, M.moto, 0.28, 0.9, 0.2));
  frame.add(box(0.32, 0.1, 0.5, M.moto, -0.08, 0.9, -0.35));
  frame.add(box(0.3, 0.08, 0.14, M.motoD, -0.28, 0.88, -0.62));
  frame.add(box(0.3, 0.22, 0.16, M.moto, HEAD.x + 0.1, HEAD.y - 0.05, HEAD.z + 0.08));
  frame.add(box(0.28, 0.15, 0.04, M.glass, HEAD.x + 0.1, HEAD.y + 0.08, HEAD.z + 0.16));
  frame.add(box(0.16, 0.1, 0.08, M.chrome, HEAD.x + 0.16, HEAD.y - 0.1, HEAD.z + 0.16));
  frame.add(box(0.55, 0.05, 0.08, M.mask, HEAD.x, HEAD.y + 0.16, HEAD.z));
  frame.add(box(0.05, 0.12, 0.05, M.chrome, HEAD.x + 0.26, HEAD.y + 0.1, HEAD.z));
  frame.add(box(0.05, 0.12, 0.05, M.chrome, HEAD.x - 0.26, HEAD.y + 0.1, HEAD.z));
  strut(0.15, 0.52, 0.15, REAR_X + 0.15, 0.4, 0.16, M.chrome, 0.08);
  frame.add(box(0.1, 0.1, 0.1, M.chrome, REAR_X + 0.05, 0.4, 0.16));
  frame.add(box(0.05, 0.05, 0.16, M.motoD, 0.1, 0.52, 0.28));
  frame.add(box(0.05, 0.05, 0.16, M.motoD, 0.1, 0.52, -0.28));

  // ульта: крутится на мотоцикле с поднятым передним колесом
  const poseMoto = (t) => {
    bike.visible = true;
    const wheelie = 0.22 + Math.sin(t * 5) * 0.06;
    bike.rotation.x = -wheelie;
    wFront.rotation.x = t * 14;
    wRear.rotation.x = t * 16;
    spinner.rotation.y = t * 11;

    smi.position.set(0.1, -0.15 + wheelie * 0.9, -0.25);
    smi.rotation.x = -wheelie * 0.9;
    torso.rotation.x = 0.55;
    armL.sh.rotation.set(-1.5, 0, 0.25);
    armR.sh.rotation.set(-1.5, 0, -0.25);
    armL.el.rotation.x = -0.5; armR.el.rotation.x = -0.5;
    legL.hp.position.set(-0.24, 0, -0.1);
    legR.hp.position.set(0.24, 0, -0.1);
    legL.hp.rotation.x = -1.15; legR.hp.rotation.x = -1.15;
    legL.kn.rotation.x = 1.45; legR.kn.rotation.x = 1.45;
    head.rotation.set(0.15, 0, 0);
  };

  /**
   * state: { t, stride, moving, throw, throwSide, spin }
   *  throw — null или 0..1 бросок сметаны, throwSide — рука
   *  spin  — ульта на мотоцикле
   */
  const animate = ({ t, stride, moving, throw: th = null, throwSide = 1, spin = false }) => {
    resetRig(rig);
    bike.visible = false;
    spinner.rotation.y = 0;
    smi.position.set(0, 0, 0);
    smi.rotation.x = 0;
    if (spin) { poseMoto(t); return; }
    if (moving) poseRun(rig, stride);
    else poseIdle(rig, t);
    if (th != null) overlayThrust(rig, th, throwSide, 1.8);
  };

  return { root, animate };
}
