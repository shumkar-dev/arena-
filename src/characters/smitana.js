import * as THREE from 'three';
import { mat, box, part, resetRig, poseIdle, poseRun, overlayThrust } from './blocks.js';

// ============================================================
// СМИТАНА — игровая модель
// Геометрия из превью smitana-blocky.jsx (без мотоцикла: ульта теперь —
// сметанамёт). Смотрит в +Z, рост ≈ 2.45.
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
  };

  const root = new THREE.Group();
  const smi = new THREE.Group();
  root.add(smi);

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

  // ульта-сметанамёт: обе руки вперёд, ладони вместе, корпус упирается против отдачи
  const poseSpray = (t) => {
    const kick = Math.sin(t * 40) * 0.03;
    torso.rotation.x = -0.12 + kick;
    armL.sh.rotation.set(-1.45 + kick, 0, -0.28);
    armR.sh.rotation.set(-1.45 + kick, 0, 0.28);
    armL.el.rotation.x = -0.15; armR.el.rotation.x = -0.15;
    head.rotation.set(0.05, 0, 0);
  };

  /**
   * state: { t, stride, moving, throw, throwSide, spray }
   *  throw — null или 0..1 бросок сметаны, throwSide — рука
   *  spray — ульта: струя сметаны из ладоней
   */
  const animate = ({ t, stride, moving, throw: th = null, throwSide = 1, spray = false }) => {
    resetRig(rig);
    if (moving) poseRun(rig, stride);
    else poseIdle(rig, t);
    if (spray) poseSpray(t);
    else if (th != null) overlayThrust(rig, th, throwSide, 1.8);
  };

  // откуда бьёт струя — между ладонями, в координатах модели
  const nozzle = new THREE.Vector3(0, 2.05, 0.95);

  return { root, animate, nozzle };
}
