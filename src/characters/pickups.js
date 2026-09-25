import * as THREE from 'three';
import { mat, box } from '../heroes/blocks.js';

// ============================================================
// ПОДБИРАЕМЫЕ ПРЕДМЕТЫ — блочные модели.
//   сигарета — усилитель: удары больнее на время
//   аптечка  — восстанавливает ХП
// ============================================================

export function createCigarette() {
  const root = new THREE.Group();
  const g = new THREE.Group();
  root.add(g);
  g.add(box(0.9, 0.16, 0.16, mat(0xf4f1ea, 0.8), 0.1, 0, 0));        // бумага
  g.add(box(0.3, 0.17, 0.17, mat(0xd98a3a, 0.8), -0.5, 0, 0));       // фильтр
  g.add(box(0.06, 0.18, 0.18, mat(0xc9a36a, 0.8), -0.34, 0, 0));
  const ember = new THREE.MeshStandardMaterial({ color: 0xff5a1a, emissive: 0xff3a00, emissiveIntensity: 1.2 });
  g.add(box(0.08, 0.15, 0.15, ember, 0.58, 0, 0));                   // тлеющий кончик
  // дымок
  const smoke = new THREE.MeshStandardMaterial({ color: 0xdddddd, transparent: true, opacity: 0.5, roughness: 1 });
  const puffs = [0, 1, 2].map((i) => { const p = box(0.12, 0.12, 0.12, smoke, 0.62, 0.2 + i * 0.2, 0); g.add(p); return p; });
  g.scale.setScalar(1.3);

  const animate = (t) => {
    g.rotation.y = t * 1.5;
    g.position.y = Math.sin(t * 2.5) * 0.1;
    puffs.forEach((p, i) => {
      const k = (t * 0.6 + i / 3) % 1;
      p.position.y = 0.15 + k * 0.7;
      p.scale.setScalar(0.6 + k);
      p.material.opacity = 0.5 * (1 - k);
    });
  };
  return { root, animate };
}

export function createMedkit() {
  const root = new THREE.Group();
  const g = new THREE.Group();
  root.add(g);
  g.add(box(0.8, 0.55, 0.55, mat(0xf4f1ea, 0.6)));
  g.add(box(0.82, 0.08, 0.57, mat(0xc42a35, 0.6), 0, 0.2, 0));
  const red = mat(0xe0342f, 0.5);
  for (const sz of [-1, 1]) {
    g.add(box(0.36, 0.1, 0.02, red, 0, 0, sz * 0.285));
    g.add(box(0.1, 0.36, 0.02, red, 0, 0, sz * 0.285));
  }
  g.add(box(0.3, 0.08, 0.1, mat(0x6b6b70, 0.5), 0, 0.33, 0));        // ручка
  const animate = (t) => { g.rotation.y = t * 1.5; g.position.y = Math.sin(t * 2.5) * 0.1; };
  return { root, animate };
}
