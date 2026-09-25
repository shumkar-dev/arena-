import * as THREE from 'three';
import { mat, box, part, resetRig, poseRun, overlayThrust } from '../blocks.js';

// ============================================================
// ЧЁРНЫЙ ИЗЮМ — игровая модель
// Геометрия из превью cherniy-izyum-blocky.jsx. Смотрит в +Z.
// Обычно парит низко на реактивных изюминках из ладоней и стоп,
// в ульте спускается на землю.
// ============================================================

export const HOVER_HEIGHT = 0.55;

export function createIzyum() {
  const M = {
    raisin:  mat(0x3a2030, 0.92),
    raisinD: mat(0x241422, 0.92),
    raisinL: mat(0x54314a, 0.92),
    brow:    mat(0x120a12, 0.92),
    white:   mat(0xf0ece8, 0.4),
    pupil:   mat(0x0e0a10, 0.4),
    shorts:  mat(0x1c1a22, 0.92),
    shortsD: mat(0x121016, 0.92),
    jet:     new THREE.MeshStandardMaterial({ color: 0x241422, roughness: 0.5, emissive: 0x4a1f3a, emissiveIntensity: 0.9 }),
  };

  const root = new THREE.Group();
  const izm = new THREE.Group();
  root.add(izm);

  const hips = new THREE.Group();
  hips.position.y = 1.14;
  izm.add(hips);

  const torso = new THREE.Group();
  hips.add(torso);

  torso.add(box(0.92, 0.28, 0.48, M.raisin, 0, 1.02, 0));
  torso.add(box(0.66, 0.4, 0.44, M.raisin, 0, 0.7, 0));
  torso.add(box(0.52, 0.4, 0.4, M.raisin, 0, 0.34, 0));
  torso.add(box(0.34, 0.22, 0.1, M.raisinL, -0.18, 0.96, 0.25));
  torso.add(box(0.34, 0.22, 0.1, M.raisinL, 0.18, 0.96, 0.25));
  for (let i = 0; i < 3; i++) {
    const y = 0.76 - i * 0.14;
    torso.add(box(0.12, 0.09, 0.09, M.raisinD, -0.09, y, 0.23));
    torso.add(box(0.12, 0.09, 0.09, M.raisinD, 0.09, y, 0.23));
  }
  torso.add(box(0.3, 0.14, 0.28, M.raisinD, 0, 1.2, 0));
  torso.add(box(0.58, 0.24, 0.42, M.shorts, 0, 0.11, 0));
  torso.add(box(0.6, 0.06, 0.44, M.shortsD, 0, 0.0, 0));

  // ---- голова-изюмина ----
  const head = new THREE.Group();
  head.position.set(0, 1.28, 0);
  torso.add(head);

  const HR = 0.42;
  head.add(box(HR * 1.5, HR * 1.3, HR * 1.4, M.raisin, 0, HR * 0.6, 0));
  head.add(box(HR * 1.1, HR * 0.7, HR * 1.1, M.raisin, HR * 0.35, HR * 1.1, -HR * 0.1));
  head.add(box(HR * 0.9, HR * 0.6, HR * 1.0, M.raisin, -HR * 0.4, HR * 0.95, HR * 0.15));
  head.add(box(HR * 0.8, HR * 0.7, HR * 0.9, M.raisin, HR * 0.15, HR * 0.35, -HR * 0.45));
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
  head.add(box(HR * 1.15, HR * 1.0, 0.02, M.raisinL, 0, HR * 0.55, HR * 0.68));
  for (const sx of [-1, 1]) {
    head.add(box(0.16, 0.045, 0.05, M.brow, sx * 0.14, HR * 0.85, HR * 0.62));
    head.add(box(0.13, 0.09, 0.04, M.white, sx * 0.14, HR * 0.72, HR * 0.63));
    head.add(box(0.06, 0.09, 0.05, M.pupil, sx * 0.15, HR * 0.72, HR * 0.66));
  }
  head.add(box(0.24, 0.04, 0.05, M.raisinD, 0, HR * 0.28, HR * 0.66));

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
    wr.add(part(0.22, 0.15, 0.22, M.raisinD));
    wr.add(box(0.24, 0.05, 0.24, M.jet, 0, -0.17, 0));
    return { sh, el, wr };
  };
  const armL = arm(-1), armR = arm(1);

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
    an.add(box(0.28, 0.14, 0.4, M.raisinD, 0, -0.07, 0.06));
    an.add(box(0.3, 0.05, 0.3, M.jet, 0, -0.15, 0.02));
    return { hp, kn, an };
  };
  const legL = leg(-1), legR = leg(1);

  const rig = { hips, hipsY: 1.14, torso, head, armL, armR, legL, legR, legX: 0.2, legY: 0 };

  // ---- реактивные изюминки из ладоней и стоп ----
  const jetMat = new THREE.MeshStandardMaterial({
    color: 0x2c1726, roughness: 0.7, emissive: 0x3a1530, emissiveIntensity: 0.7, transparent: true,
  });
  const jetGeo = new THREE.BoxGeometry(0.07, 0.08, 0.07);
  const jets = [armL.wr, armR.wr, legL.an, legR.an].map((src) => {
    const g = new THREE.Group();
    root.add(g);
    const bits = [];
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(jetGeo, jetMat);
      g.add(m);
      bits.push(m);
    }
    return { g, bits, src };
  });
  const tmp = new THREE.Vector3();

  const updateJets = (t, on) => {
    for (const [ji, j] of jets.entries()) {
      j.g.visible = on;
      if (!on) continue;
      j.src.updateWorldMatrix(true, false);
      tmp.setFromMatrixPosition(j.src.matrixWorld);
      root.worldToLocal(tmp);
      j.g.position.copy(tmp);
      j.bits.forEach((m, i) => {
        const ph = (t * 3.4 + i / j.bits.length + ji * 0.07) % 1;
        m.position.set(Math.sin(t * 7 + i * 2 + ji) * 0.05 * ph, -ph * 0.6, Math.cos(t * 7 + i * 2 + ji) * 0.05 * ph);
        m.scale.setScalar(1 - ph * 0.7);
      });
    }
  };

  // парение: руки чуть вперёд, ноги свисают; на ходу корпус наклонён по движению
  const poseHover = (t, moving) => {
    const lean = moving ? 0.35 : 0.08;
    torso.rotation.x = lean * 0.6 + Math.sin(t * 1.8) * 0.03;
    armL.sh.rotation.set(-0.35, 0, 0.18);
    armR.sh.rotation.set(-0.35, 0, -0.18);
    armL.el.rotation.x = -0.5; armR.el.rotation.x = -0.5;
    legL.hp.rotation.x = moving ? 0.35 : 0.12 + Math.sin(t * 2) * 0.05;
    legR.hp.rotation.x = moving ? 0.25 : 0.05 - Math.sin(t * 2) * 0.05;
    legL.kn.rotation.x = 0.45; legR.kn.rotation.x = 0.35;
    head.rotation.set(-0.05, 0, 0);
    izm.rotation.x = lean * 0.4;
  };

  let alt = HOVER_HEIGHT, lastT = 0;

  /**
   * state: { t, stride, moving, grounded, shot, shotSide, punch, punchSide }
   *  grounded — ульта: стоит на земле
   *  shot     — null или 0..1 выстрел изюминкой из ладони
   *  punch    — null или 0..1 удар в ульте
   */
  const animate = ({ t, stride, moving, grounded = false, shot = null, shotSide = 1, punch = null, punchSide = 1 }) => {
    const dt = Math.min(0.1, Math.max(0, t - lastT));
    lastT = t;
    resetRig(rig);
    izm.rotation.x = 0;

    const target = grounded ? 0 : HOVER_HEIGHT + Math.sin(t * 1.8) * 0.06;
    alt += (target - alt) * Math.min(1, dt * 10);
    izm.position.y = alt;

    if (grounded) {
      if (moving) poseRun(rig, stride);
      else { hips.position.y = 1.14 - 0.08; legL.hp.rotation.x = -0.3; legR.hp.rotation.x = 0.3; legL.kn.rotation.x = 0.35; legR.kn.rotation.x = 0.1; torso.rotation.x = 0.15; armL.sh.rotation.x = -0.9; armR.sh.rotation.x = -0.9; armL.el.rotation.x = -1.2; armR.el.rotation.x = -1.2; }
      if (punch != null) overlayThrust(rig, punch, punchSide, 1.6);
    } else {
      poseHover(t, moving);
      if (shot != null) overlayThrust(rig, shot, shotSide, 1.6);
    }
    updateJets(t, alt > 0.2);
  };

  return { root, animate };
}
