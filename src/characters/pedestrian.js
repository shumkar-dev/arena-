import * as THREE from 'three';
import { mat, box, part, resetRig, poseIdle } from '../heroes/blocks.js';

// ============================================================
// ПРОХОЖИЙ — горожанин из «Городского забега 2», блочный.
// Внешность случайная: кожа, волосы, футболка, штаны, иногда кепка или сумка.
// Гуляет по дорожкам парка; если ударить — вздрагивает и убегает быстрее.
// ============================================================

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const SKIN = [0xf1c9a5, 0xd9a47a, 0xa8714a, 0x77492b, 0xe8b894];
const HAIR = [0x1a120c, 0x3b2616, 0x8a5a2b, 0xd8b35a, 0x6b6b6b];
const SHIRT = [0x3f7ad8, 0xe0584a, 0x49a86b, 0xf2c14e, 0x8a5ad8, 0xf4f1ea, 0x2c2c34, 0xe07ab0];
const PANTS = [0x2d3f66, 0x3a3a40, 0x6b5a45, 0x1f2a3a, 0x7a6f5a];

export function createPedestrian() {
  const M = {
    skin: mat(pick(SKIN)), hair: mat(pick(HAIR)), shirt: mat(pick(SHIRT)), pants: mat(pick(PANTS)),
    shoe: mat(0x2a2a2e), white: mat(0xf4f2ea, 0.4), pupil: mat(0x140d07, 0.4),
  };
  const extra = Math.random();

  const root = new THREE.Group();
  const hips = new THREE.Group();
  hips.position.y = 1.05;
  root.add(hips);
  const torso = new THREE.Group();
  hips.add(torso);
  torso.add(box(0.72, 1.0, 0.4, M.shirt, 0, 0.5, 0));
  torso.add(box(0.28, 0.12, 0.28, M.skin, 0, 1.06, 0));

  const head = new THREE.Group();
  head.position.set(0, 1.1, 0);
  torso.add(head);
  head.add(box(0.66, 0.66, 0.66, M.skin, 0, 0.33, 0));
  head.add(box(0.7, 0.14, 0.7, M.hair, 0, 0.64, 0));
  head.add(box(0.7, 0.3, 0.1, M.hair, 0, 0.5, -0.32));
  for (const sx of [-1, 1]) {
    head.add(box(0.12, 0.1, 0.03, M.white, sx * 0.14, 0.4, 0.33));
    head.add(box(0.06, 0.1, 0.04, M.pupil, sx * 0.15, 0.4, 0.34));
  }
  if (extra < 0.3) {                                     // кепка
    head.add(box(0.72, 0.16, 0.72, M.shirt, 0, 0.72, 0));
    head.add(box(0.5, 0.06, 0.3, M.shirt, 0, 0.66, 0.46));
  }

  const arm = (side) => {
    const sh = new THREE.Group();
    sh.position.set(side * 0.5, 0.95, 0);
    torso.add(sh);
    sh.add(part(0.26, 0.5, 0.26, M.shirt));
    const el = new THREE.Group();
    el.position.y = -0.5;
    sh.add(el);
    el.add(part(0.22, 0.45, 0.22, M.skin));
    return { sh, el };
  };
  const armL = arm(-1), armR = arm(1);
  if (extra > 0.75) armR.el.add(box(0.3, 0.4, 0.14, mat(0x6b4a2c), 0, -0.6, 0));   // сумка

  const leg = (side) => {
    const hp = new THREE.Group();
    hp.position.set(side * 0.18, 0, 0);
    hips.add(hp);
    hp.add(part(0.3, 0.55, 0.3, M.pants));
    const kn = new THREE.Group();
    kn.position.y = -0.55;
    hp.add(kn);
    kn.add(part(0.28, 0.42, 0.28, M.pants));
    kn.add(box(0.3, 0.12, 0.42, M.shoe, 0, -0.46, 0.06));
    return { hp, kn };
  };
  const legL = leg(-1), legR = leg(1);

  const rig = { hips, hipsY: 1.05, torso, head, armL, armR, legL, legR, legX: 0.18, legY: 0 };

  // прогулочный шаг — спокойнее бега героев; scared — бежит
  const animate = ({ t, stride = 0, moving = false, scared = false }) => {
    resetRig(rig);
    if (!moving) { poseIdle(rig, t); return; }
    const amp = scared ? 1 : 0.55;
    hips.position.y = 1.05 + Math.abs(Math.sin(stride)) * 0.04 * (scared ? 2 : 1);
    armL.sh.rotation.x = -Math.sin(stride) * 0.8 * amp;
    armR.sh.rotation.x = Math.sin(stride) * 0.8 * amp;
    legL.hp.rotation.x = Math.sin(stride) * 0.8 * amp;
    legR.hp.rotation.x = -Math.sin(stride) * 0.8 * amp;
    legL.kn.rotation.x = Math.max(0, -Math.sin(stride)) * 0.9 * amp;
    legR.kn.rotation.x = Math.max(0, Math.sin(stride)) * 0.9 * amp;
    if (scared) { armL.sh.rotation.z = 0.5; armR.sh.rotation.z = -0.5; torso.rotation.x = 0.25; }
  };

  return { root, animate };
}
