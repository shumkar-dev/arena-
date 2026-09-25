import * as THREE from 'three';
import { mat, box, withBounds } from './parts.js';

// ============================================================
// КАРТА «ДОРОГА» — улица из «Городского забега 2» с укрытиями.
// Вытянута по Z: камера смотрит с юга (+Z) на север (−Z).
// Расстановка точечно-симметрична — для командных режимов.
// ============================================================

const SIZE = { halfW: 11, halfL: 17 };

// препятствия задаются для одной половины, вторая получается отражением (x,z) → (−x,−z)
const HALF = [
  { x: 0,    z: -3.2,  w: 4,   d: 1,   kind: 'barrier' },
  { x: -5.5, z: -6.5,  w: 2.2, d: 4.2, kind: 'car', color: 0xb8322a },
  { x: 5,    z: -9.5,  w: 3,   d: 1,   kind: 'barrier' },
  { x: -1.3, z: -11,   w: 1.2, d: 1.2, kind: 'crate' },
  { x: 0,    z: -11,   w: 1.2, d: 1.2, kind: 'crate' },
  { x: 7.8,  z: -2.5,  w: 1.2, d: 1.2, kind: 'crate' },
  { x: 7.8,  z: -3.8,  w: 1.2, d: 1.2, kind: 'crate' },
  { x: -8.2, z: -13.5, w: 2.4, d: 1,   kind: 'barrier' },
  { x: 4.2,  z: -14.5, w: 2.2, d: 4.2, kind: 'car', color: 0x2f6fb0 },
];

const OBSTACLES = [
  ...HALF,
  ...HALF.map((o) => ({ ...o, x: -o.x, z: -o.z, color: o.color === 0xb8322a ? 0xd9a21e : o.color === 0x2f6fb0 ? 0x3f8f4a : o.color })),
].map(withBounds);

const M = {
  asphalt:  mat(0x34363d),
  asphaltD: mat(0x2c2e34),
  line:     mat(0xe8e2c8),
  curb:     mat(0x9a9aa0),
  walk:     mat(0x6d6a66),
  walkD:    mat(0x625f5b),
  concrete: mat(0xb9b6ae),
  stripe:   mat(0xd8452f),
  crate:    mat(0xa8763e),
  crateD:   mat(0x7d5429),
  tire:     mat(0x1b1c20, 0.8),
  glass:    mat(0x9cc4d8, 0.3),
  lamp:     mat(0xfff2c0, 0.4),
  fence:    mat(0x4a4c54),
  grass:    mat(0x3f6a35),
};

function buildCar(o) {
  const g = new THREE.Group();
  const body = mat(o.color ?? 0xb8322a, 0.6);
  g.add(box(o.w, 0.7, o.d, body, 0, 0.55, 0));
  g.add(box(o.w * 0.86, 0.6, o.d * 0.5, body, 0, 1.2, -0.15));
  g.add(box(o.w * 0.88, 0.46, o.d * 0.02 + 0.02, M.glass, 0, 1.2, o.d * 0.1 + 0.02));
  g.add(box(o.w * 0.88, 0.46, 0.04, M.glass, 0, 1.2, -o.d * 0.4 + 0.02));
  for (const sx of [-1, 1]) {
    g.add(box(0.04, 0.42, o.d * 0.4, M.glass, sx * o.w * 0.44, 1.2, -0.15));
    for (const sz of [-1, 1]) g.add(box(0.3, 0.5, 0.6, M.tire, sx * (o.w / 2 - 0.1), 0.25, sz * o.d * 0.3));
    g.add(box(0.36, 0.18, 0.06, M.lamp, sx * o.w * 0.3, 0.68, o.d / 2 + 0.01));
  }
  return g;
}

function buildBarrier(o) {
  const g = new THREE.Group();
  g.add(box(o.w, 1.0, o.d, M.concrete, 0, 0.5, 0));
  g.add(box(o.w + 0.02, 0.18, o.d + 0.02, M.stripe, 0, 0.72, 0));
  return g;
}

function buildCrate() {
  const g = new THREE.Group();
  g.add(box(1.2, 1.2, 1.2, M.crate, 0, 0.6, 0));
  // рёбра ящика
  for (const [x, z] of [[-0.55, -0.55], [0.55, -0.55], [-0.55, 0.55], [0.55, 0.55]]) {
    g.add(box(0.12, 1.22, 0.12, M.crateD, x, 0.6, z));
  }
  g.add(box(1.22, 0.12, 1.22, M.crateD, 0, 1.15, 0));
  return g;
}

function build(scene) {
  const { halfW, halfL } = SIZE;

  // ---- дорога ----
  const roadW = halfW * 2 - 5;
  scene.add(box(roadW, 0.1, halfL * 2 + 2, M.asphalt, 0, -0.05, 0, false));
  // пятна асфальта — чтобы бег читался
  for (let i = 0; i < 26; i++) {
    const x = ((i * 37) % 13) - 6.5, z = ((i * 53) % 32) - 16;
    scene.add(box(1 + (i % 3) * 0.5, 0.02, 1 + (i % 2), M.asphaltD, x, 0.005, z, false));
  }
  // разметка: пунктир по центру
  for (let z = -halfL; z <= halfL; z += 3) scene.add(box(0.2, 0.02, 1.6, M.line, 0, 0.01, z, false));
  // пешеходный переход в центре
  for (let x = -roadW / 2 + 0.8; x < roadW / 2; x += 1.1) scene.add(box(0.6, 0.02, 2.2, M.line, x, 0.012, 0, false));

  // ---- тротуары ----
  for (const sx of [-1, 1]) {
    const cx = sx * (roadW / 2 + 1.25);
    scene.add(box(2.5, 0.2, halfL * 2 + 2, M.walk, cx, 0.0, 0, false));
    scene.add(box(0.2, 0.26, halfL * 2 + 2, M.curb, sx * (roadW / 2 + 0.1), 0.03, 0, false));
    for (let z = -halfL; z < halfL; z += 1.25) scene.add(box(2.4, 0.01, 0.06, M.walkD, cx, 0.105, z, false));
  }

  // ---- ограждение по краю арены ----
  const fenceH = 0.9;
  for (const sx of [-1, 1]) scene.add(box(0.4, fenceH, halfL * 2 + 0.8, M.fence, sx * (halfW + 0.2), fenceH / 2, 0));
  for (const sz of [-1, 1]) scene.add(box(halfW * 2 + 0.8, fenceH, 0.4, M.fence, 0, fenceH / 2, sz * (halfL + 0.2)));

  // ---- город вокруг (декор, без столкновений) ----
  scene.add(box(80, 0.1, 80, M.grass, 0, -0.12, 0, false));
  const cols = [0x7a3b33, 0x5e5a6b, 0x8a7355, 0x4f5d6a, 0x6b4a3c];
  for (const sx of [-1, 1]) {
    for (let z = -halfL - 2, i = 0; z < halfL - 2; z += 6, i++) {
      const h = 4 + ((i * 7 + (sx > 0 ? 3 : 0)) % 5) * 1.6;
      const b = box(5, h, 5.4, mat(cols[(i + (sx > 0 ? 2 : 0)) % cols.length]), sx * (halfW + 4), h / 2, z);
      scene.add(b);
      for (let y = 1.5; y < h - 0.8; y += 1.6) {
        scene.add(box(0.05, 0.8, 4.2, M.glass, sx * (halfW + 1.47), y, z, false));
      }
    }
  }
  // дома только на дальнем краю: ближний край смотрит в камеру и загораживал бы игрока
  for (let x = -halfW - 2; x <= halfW + 2; x += 6) {
    const h = 5 + (Math.abs(x * 3) % 4);
    scene.add(box(5.6, h, 5, mat(cols[Math.abs(x) % cols.length]), x, h / 2, -(halfL + 4)));
  }

  // ---- укрытия ----
  for (const o of OBSTACLES) {
    const g = o.kind === 'car' ? buildCar(o) : o.kind === 'crate' ? buildCrate() : buildBarrier(o);
    g.position.set(o.x, 0, o.z);
    scene.add(g);
  }
}


export default {
  id: 'road',
  name: 'Дорога',
  size: SIZE,
  obstacles: OBSTACLES,
  build,
};
