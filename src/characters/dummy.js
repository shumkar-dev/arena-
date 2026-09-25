import * as THREE from 'three';

// ============================================================
// ТРЕНИРОВОЧНЫЙ МАНЕКЕН — мешок на столбе, блочный стиль.
// Неподвижный противник для проверки ударов. Смотрит в +Z, рост ≈ 2.4.
// ============================================================

const mat = (c, r = 0.95) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: 0 });

const box = (w, h, d, material, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
};

export function createDummy() {
  const M = {
    wood:   mat(0x8a5a2e),
    woodD:  mat(0x6b4322),
    sack:   mat(0xc9a86a),
    sackD:  mat(0xae8f55),
    rope:   mat(0x5e4a2c),
    red:    mat(0xc42a35, 0.7),
    white:  mat(0xf4f2ea, 0.7),
    stitch: mat(0x3a2a18),
  };

  const root = new THREE.Group();

  // подставка-крестовина
  root.add(box(1.3, 0.14, 0.28, M.woodD, 0, 0.07, 0));
  root.add(box(0.28, 0.14, 1.3, M.woodD, 0, 0.07, 0));
  // столб
  root.add(box(0.22, 1.1, 0.22, M.wood, 0, 0.6, 0));

  // тело-мешок качается на столбе
  const body = new THREE.Group();
  body.position.y = 1.0;
  root.add(body);

  body.add(box(0.86, 1.0, 0.5, M.sack, 0, 0.5, 0));
  body.add(box(0.88, 0.1, 0.52, M.rope, 0, 0.22, 0));     // пояс-верёвка
  body.add(box(0.88, 0.1, 0.52, M.rope, 0, 0.86, 0));
  // мишень на груди
  body.add(box(0.46, 0.46, 0.02, M.red, 0, 0.55, 0.26));
  body.add(box(0.3, 0.3, 0.02, M.white, 0, 0.55, 0.265));
  body.add(box(0.14, 0.14, 0.02, M.red, 0, 0.55, 0.27));
  // руки-палка
  body.add(box(1.9, 0.16, 0.16, M.wood, 0, 0.82, 0));
  for (const sx of [-1, 1]) body.add(box(0.26, 0.26, 0.26, M.sackD, sx * 0.98, 0.82, 0));

  // голова
  body.add(box(0.1, 0.12, 0.1, M.wood, 0, 1.06, 0));
  body.add(box(0.62, 0.6, 0.6, M.sack, 0, 1.4, 0));
  body.add(box(0.12, 0.12, 0.02, M.stitch, -0.14, 1.46, 0.31));   // глаза-крестики
  body.add(box(0.12, 0.12, 0.02, M.stitch, 0.14, 1.46, 0.31));
  body.add(box(0.3, 0.05, 0.02, M.stitch, 0, 1.26, 0.31));        // шов-рот

  // лёгкое покачивание; урон и падение накладывает Fighter поверх root
  const animate = ({ t }) => {
    body.rotation.z = Math.sin(t * 1.3) * 0.02;
  };

  return { root, animate };
}
