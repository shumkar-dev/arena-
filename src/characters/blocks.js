import * as THREE from 'three';

// ============================================================
// ОБЩЕЕ ДЛЯ БЛОЧНЫХ МОДЕЛЕЙ: кубики, конечности и типовые позы.
// Риг: { hips, hipsY, torso, head, armL, armR, legL, legR, legX, legY }
// armX: { sh, el }, legX: { hp, kn }
// ============================================================

export const mat = (c, r = 0.9) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: 0 });

export const box = (w, h, d, material, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
};

// конечность: пивот сверху
export const part = (w, h, d, material) => {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(0, -h / 2, 0);
  const m = new THREE.Mesh(g, material);
  m.castShadow = true;
  return m;
};

export const cyl = (rt, rb, h, material, x = 0, y = 0, z = 0, rotZ = 0) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 14), material);
  m.position.set(x, y, z);
  m.rotation.z = rotZ;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
};

export function resetRig(r) {
  for (const l of [r.legL, r.legR]) { l.hp.rotation.set(0, 0, 0); l.kn.rotation.set(0, 0, 0); }
  r.legL.hp.position.set(-r.legX, r.legY, 0);
  r.legR.hp.position.set(r.legX, r.legY, 0);
  for (const a of [r.armL, r.armR]) { a.sh.rotation.set(0, 0, 0); a.el.rotation.set(0, 0, 0); }
  r.torso.rotation.set(0, 0, 0);
  r.torso.position.set(0, 0, 0);
  r.head.rotation.set(0, 0, 0);
  r.hips.position.y = r.hipsY;
}

export function poseIdle(r, t) {
  r.hips.position.y = r.hipsY + Math.sin(t * 1.6) * 0.018;
  r.armL.sh.rotation.x = Math.sin(t * 1.6) * 0.06;
  r.armR.sh.rotation.x = -Math.sin(t * 1.6) * 0.06;
  r.head.rotation.y = Math.sin(t * 0.55) * 0.2;
}

// бег: ph — фаза шага, её ведёт игровой цикл по пройденному пути
export function poseRun(r, ph) {
  r.hips.position.y = r.hipsY + Math.abs(Math.sin(ph)) * 0.07;
  r.torso.rotation.x = 0.14;
  r.torso.rotation.z = Math.sin(ph) * 0.04;
  r.armL.sh.rotation.x = -Math.sin(ph) * 1.0 - 0.1;
  r.armR.sh.rotation.x = Math.sin(ph) * 1.0 - 0.1;
  r.armL.el.rotation.x = -0.5 - Math.max(0, -Math.sin(ph)) * 0.5;
  r.armR.el.rotation.x = -0.5 - Math.max(0, Math.sin(ph)) * 0.5;
  r.legL.hp.rotation.x = Math.sin(ph) * 0.9;
  r.legR.hp.rotation.x = -Math.sin(ph) * 0.9;
  r.legL.kn.rotation.x = 0.2 + Math.max(0, -Math.sin(ph)) * 1.1;
  r.legR.kn.rotation.x = 0.2 + Math.max(0, Math.sin(ph)) * 1.1;
  r.head.rotation.set(-0.08, 0, 0);
}

// выброс руки вперёд: удар или бросок; k: 0..1, side: 1 правая, −1 левая
export function overlayThrust(r, k, side, lift = 1.55) {
  const a = side > 0 ? r.armR : r.armL;
  const s = Math.sin(k * Math.PI);
  a.sh.rotation.x = -lift * s + a.sh.rotation.x * (1 - s);
  a.sh.rotation.z = 0;
  a.el.rotation.x = -0.15 * s;
  r.torso.rotation.y = -0.35 * s * side;
}
