// ============================================================
// ТЕКУЩАЯ КАРТА — размеры, препятствия и столкновения.
// Сами карты — в src/maps/<id>.js. Режим выбирает карту, движок вызывает
// setMap(map) до начала матча; ARENA и OBSTACLES — живые объекты, их читают
// бот, снаряды, камера и режимы.
// ============================================================

import road from '../maps/road.js';

export const ARENA = { halfW: 11, halfL: 17 };
export const OBSTACLES = [];
let current = null;

export function setMap(map) {
  current = map;
  Object.assign(ARENA, map.size);
  OBSTACLES.length = 0;
  OBSTACLES.push(...map.obstacles);
}
setMap(road);

export const currentMap = () => current;

export function buildArena(scene) { current.build(scene); }

// Выталкивает круг (x, z, r) из препятствий и из-за границ арены.
export function resolveCollisions(p, r) {
  const { halfW, halfL } = ARENA;
  for (let pass = 0; pass < 2; pass++) {
    for (const o of OBSTACLES) {
      const cx = Math.max(o.minX, Math.min(p.x, o.maxX));
      const cz = Math.max(o.minZ, Math.min(p.z, o.maxZ));
      let dx = p.x - cx, dz = p.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        p.x = cx + (dx / d) * r;
        p.z = cz + (dz / d) * r;
      } else {
        // центр внутри прямоугольника — выталкиваем по кратчайшей оси
        const pen = [p.x - o.minX, o.maxX - p.x, p.z - o.minZ, o.maxZ - p.z];
        const i = pen.indexOf(Math.min(...pen));
        if (i === 0) p.x = o.minX - r;
        else if (i === 1) p.x = o.maxX + r;
        else if (i === 2) p.z = o.minZ - r;
        else p.z = o.maxZ + r;
      }
    }
  }
  p.x = Math.max(-halfW + r, Math.min(halfW - r, p.x));
  p.z = Math.max(-halfL + r, Math.min(halfL - r, p.z));
}

// Упирается ли точка (x, z) с радиусом r в укрытие или край арены — для снарядов.
export function pointBlocked(x, z, r = 0) {
  const { halfW, halfL } = ARENA;
  if (Math.abs(x) > halfW - r || Math.abs(z) > halfL - r) return true;
  for (const o of OBSTACLES) {
    if (x > o.minX - r && x < o.maxX + r && z > o.minZ - r && z < o.maxZ + r) return true;
  }
  return false;
}
