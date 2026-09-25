import * as THREE from 'three';
import { mat, box, withBounds } from './parts.js';

// ============================================================
// КАРТА «ПАРК» — для режима «каждый сам за себя».
// Квадратный парк: фонтан в центре, дорожки крестом и кольцом вокруг фонтана,
// деревья, скамейки и кусты — укрытия. По дорожкам гуляют прохожие.
// Расстановка симметрична во все четыре стороны.
// ============================================================

const SIZE = { halfW: 13, halfL: 15 };
const RING_R = 4.5;          // кольцевая дорожка вокруг фонтана
const PATH_W = 2.4;

// укрытия одной четверти (x > 0, z > 0) — остальные три получаются отражением
const QUARTER = [
  { x: 5.5,  z: 9,    w: 1,   d: 1,   kind: 'tree' },
  { x: 10,   z: 4.5,  w: 1,   d: 1,   kind: 'tree' },
  { x: 10,   z: 11.5, w: 1,   d: 1,   kind: 'tree' },
  { x: 3,    z: 12.5, w: 1,   d: 1,   kind: 'tree' },
  { x: 3.4,  z: 6.2,  w: 2.0, d: 0.6, kind: 'bench' },
  { x: 6.6,  z: 2.8,  w: 0.6, d: 2.0, kind: 'bench' },
  { x: 7.6,  z: 7.4,  w: 2.6, d: 0.9, kind: 'hedge' },
];

const OBSTACLES = [
  { x: 0, z: 0, w: 3.4, d: 3.4, kind: 'fountain' },
  ...[[1, 1], [-1, 1], [1, -1], [-1, -1]].flatMap(([sx, sz]) => QUARTER.map((o) => ({ ...o, x: o.x * sx, z: o.z * sz }))),
].map(withBounds);

// старты для четырёх бойцов — по углам, лицом к центру
const SPAWNS = [[7, 13], [-7, 13], [7, -13], [-7, -13]].map(([x, z]) => ({ x, z, facing: Math.atan2(-x, -z) }));

// маршруты прохожих: кольцо вокруг фонтана и дорожки крестом
const ring = Array.from({ length: 12 }, (_, i) => {
  const a = (i / 12) * Math.PI * 2;
  return { x: Math.sin(a) * RING_R, z: Math.cos(a) * RING_R };
});
// loop — ходят по кругу; иначе туда-обратно
const WALK_ROUTES = [
  { loop: true, points: ring },
  { loop: true, points: [...ring].reverse() },
  { loop: false, points: [{ x: 0, z: 13 }, ...ring.slice(0, 7), { x: 0, z: -13 }] },     // север–юг, огибая фонтан
  { loop: false, points: [{ x: 12, z: 0 }, ...ring.slice(3, 10), { x: -12, z: 0 }] },    // запад–восток
];

const M = {
  grass:   mat(0x4f8a3c),
  grassD:  mat(0x437a33),
  path:    mat(0xcdbb95),
  pathD:   mat(0xb9a67f),
  stone:   mat(0x9d9a92),
  stoneD:  mat(0x7f7c75),
  water:   new THREE.MeshStandardMaterial({ color: 0x4aa3d8, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85 }),
  spray:   new THREE.MeshStandardMaterial({ color: 0xcfeaff, roughness: 0.2, transparent: true, opacity: 0.6 }),
  trunk:   mat(0x6b4a2c),
  leaf:    mat(0x2f7a34),
  leafL:   mat(0x3d9142),
  wood:    mat(0xa7713d),
  iron:    mat(0x2c3a33, 0.6),
  hedge:   mat(0x2e6b2c),
  lamp:    new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffe6a0, emissiveIntensity: 0.5 }),
  flowerR: mat(0xd8454a),
  flowerY: mat(0xf2c14e),
};

// кроны деревьев на арене: движок делает их полупрозрачными, если они закрывают героя
const occluders = [];

function buildTree(g, big = 1, fade = false) {
  g.add(box(0.6, 1.8 * big, 0.6, M.trunk, 0, 0.9 * big, 0));
  const leaf = fade ? M.leaf.clone() : M.leaf;
  const leafL = fade ? M.leafL.clone() : M.leafL;
  const crown = [
    box(2.2 * big, 1.1 * big, 2.2 * big, leaf, 0, 2.2 * big, 0),
    box(1.6 * big, 0.9 * big, 1.6 * big, leafL, 0.15, 3.1 * big, -0.1),
    box(0.9 * big, 0.6 * big, 0.9 * big, leaf, -0.1, 3.8 * big, 0.1),
  ];
  for (const c of crown) g.add(c);
  if (fade) {
    leaf.transparent = leafL.transparent = true;
    occluders.push({ group: g, mats: [leaf, leafL] });
  }
}

function buildBench(g, o) {
  const along = o.w > o.d;        // вдоль X или вдоль Z
  const L = Math.max(o.w, o.d);
  const sx = along ? L : 0.55, sz = along ? 0.55 : L;
  g.add(box(sx, 0.1, sz, M.wood, 0, 0.5, 0));
  g.add(box(along ? L : 0.1, 0.45, along ? 0.1 : L, M.wood, along ? 0 : -0.25, 0.8, along ? -0.25 : 0));   // спинка
  for (const k of [-1, 1]) {
    const lx = along ? k * (L / 2 - 0.15) : 0, lz = along ? 0 : k * (L / 2 - 0.15);
    g.add(box(0.1, 0.5, 0.1, M.iron, lx - (along ? 0 : 0.2), 0.25, lz - (along ? 0.2 : 0)));
    g.add(box(0.1, 0.5, 0.1, M.iron, lx + (along ? 0 : 0.2), 0.25, lz + (along ? 0.2 : 0)));
  }
}

function buildFountain(g) {
  g.add(box(3.4, 0.6, 3.4, M.stone, 0, 0.3, 0));
  g.add(box(2.8, 0.1, 2.8, M.water, 0, 0.56, 0, false));
  g.add(box(0.7, 1.4, 0.7, M.stoneD, 0, 1.0, 0));
  g.add(box(1.3, 0.2, 1.3, M.stone, 0, 1.6, 0));
  g.add(box(0.35, 0.6, 0.35, M.spray, 0, 2.0, 0, false));
  for (const [x, z] of [[1.6, 0], [-1.6, 0], [0, 1.6], [0, -1.6]]) g.add(box(0.3, 0.72, 0.3, M.stoneD, x, 0.36, z));
}

function build(scene) {
  const { halfW, halfL } = SIZE;
  occluders.length = 0;

  // трава и декоративные пятна
  scene.add(box(90, 0.1, 90, M.grass, 0, -0.06, 0, false));
  for (let i = 0; i < 30; i++) {
    const x = ((i * 41) % 24) - 12, z = ((i * 29) % 28) - 14;
    scene.add(box(1 + (i % 3) * 0.6, 0.02, 1 + (i % 2) * 0.8, M.grassD, x, 0.0, z, false));
  }

  // дорожки: крест и кольцо вокруг фонтана
  scene.add(box(PATH_W, 0.04, halfL * 2, M.path, 0, 0.01, 0, false));
  scene.add(box(halfW * 2, 0.04, PATH_W, M.path, 0, 0.012, 0, false));
  const segs = 28;
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const t = box(1.1, 0.045, PATH_W * 0.8, M.path, Math.sin(a) * RING_R, 0.014, Math.cos(a) * RING_R, false);
    t.rotation.y = a;
    scene.add(t);
  }
  // бордюрчики дорожек и клумбы
  for (let z = -halfL + 1; z < halfL; z += 2.2) {
    if (Math.abs(z) < RING_R + 1.2) continue;
    for (const sx of [-1, 1]) scene.add(box(0.15, 0.08, 1.4, M.pathD, sx * (PATH_W / 2 + 0.08), 0.04, z, false));
  }
  for (const [x, z, c] of [[2.2, 2.6, M.flowerR], [-2.2, -2.6, M.flowerY], [-2.6, 2.2, M.flowerY], [2.6, -2.2, M.flowerR]]) {
    for (let i = 0; i < 4; i++) scene.add(box(0.25, 0.3, 0.25, c, x + (i % 2) * 0.4, 0.15, z + Math.floor(i / 2) * 0.4, false));
  }

  // ограда парка
  const fenceH = 0.9;
  for (const sx of [-1, 1]) {
    scene.add(box(0.2, 0.12, halfL * 2 + 0.4, M.iron, sx * (halfW + 0.2), fenceH, 0));
    for (let z = -halfL; z <= halfL; z += 1) scene.add(box(0.12, fenceH, 0.12, M.iron, sx * (halfW + 0.2), fenceH / 2, z));
  }
  for (const sz of [-1, 1]) {
    scene.add(box(halfW * 2 + 0.4, 0.12, 0.2, M.iron, 0, fenceH, sz * (halfL + 0.2)));
    for (let x = -halfW; x <= halfW; x += 1) scene.add(box(0.12, fenceH, 0.12, M.iron, x, fenceH / 2, sz * (halfL + 0.2)));
  }

  // фонари на углах кольца (декор)
  for (const [x, z] of [[3.6, 3.6], [-3.6, 3.6], [3.6, -3.6], [-3.6, -3.6]]) {
    scene.add(box(0.14, 2.6, 0.14, M.iron, x, 1.3, z));
    scene.add(box(0.4, 0.3, 0.4, M.lamp, x, 2.7, z));
  }

  // деревья за оградой — лес вокруг (декор); у ближнего края низкие кусты, чтобы не закрывать вид
  for (let i = 0; i < 26; i++) {
    const side = i % 3;
    const t = (i * 0.618) % 1;
    const g = new THREE.Group();
    if (side === 0) { g.position.set(-halfW - 3 - (i % 2) * 2.5, 0, -halfL + t * halfL * 2); buildTree(g, 1.2); }
    else if (side === 1) { g.position.set(halfW + 3 + (i % 2) * 2.5, 0, -halfL + t * halfL * 2); buildTree(g, 1.2); }
    else { g.position.set(-halfW + t * halfW * 2, 0, -halfL - 3 - (i % 2) * 2.5); buildTree(g, 1.3); }
    scene.add(g);
  }

  // укрытия
  for (const o of OBSTACLES) {
    const g = new THREE.Group();
    g.position.set(o.x, 0, o.z);
    if (o.kind === 'tree') buildTree(g, 1, true);
    else if (o.kind === 'bench') buildBench(g, o);
    else if (o.kind === 'fountain') buildFountain(g);
    else if (o.kind === 'hedge') {
      g.add(box(o.w, 1.1, o.d, M.hedge, 0, 0.55, 0));
      g.add(box(o.w * 0.9, 0.25, o.d * 0.8, M.leafL, 0, 1.2, 0));
    }
    scene.add(g);
  }
}

export default {
  id: 'park',
  name: 'Парк',
  size: SIZE,
  obstacles: OBSTACLES,
  spawns: SPAWNS,
  walkRoutes: WALK_ROUTES,
  occluders,
  build,
};
