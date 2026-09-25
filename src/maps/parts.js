import * as THREE from 'three';

// Кубики для карт: материал и коробка (cast — отбрасывает ли тень).
export const mat = (c, r = 0.95) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: 0 });

export const box = (w, h, d, material, x = 0, y = 0, z = 0, cast = true) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = true;
  return m;
};

// прямоугольник препятствия → с границами для столкновений
export const withBounds = (o) => ({ ...o, minX: o.x - o.w / 2, maxX: o.x + o.w / 2, minZ: o.z - o.d / 2, maxZ: o.z + o.d / 2 });
