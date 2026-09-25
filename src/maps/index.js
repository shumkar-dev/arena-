// ============================================================
// КАРТЫ — каждый файл src/maps/<id>.js с export default { id, name, size, obstacles, build, ... }.
// Режим называет карту по id (map: 'park'), движок включает её через setMap.
//   size       — { halfW, halfL }: полуширина по X и полудлина по Z
//   obstacles  — укрытия-прямоугольники { x, z, w, d, minX, maxX, minZ, maxZ }
//   build      — нарисовать карту в сцене
//   occluders  — (по желанию) высокие детали { group, mats }: если закрывают героя, становятся прозрачными
//   spawns     — (по желанию) точки старта { x, z, facing }
//   walkRoutes — (по желанию) маршруты прохожих: { loop, points: [{ x, z }] }
// ============================================================

const modules = import.meta.glob('./*.js', { eager: true });

export const MAPS = Object.entries(modules)
  .filter(([path]) => !path.endsWith('/index.js') && !path.endsWith('/parts.js'))
  .map(([, m]) => m.default);

export const mapById = (id) => MAPS.find((m) => m.id === id) ?? MAPS.find((m) => m.id === 'road');
