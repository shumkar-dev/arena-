import { createFighter } from './fighter.js';
import { createPedestrian } from '../characters/pedestrian.js';

// ============================================================
// ПРОХОЖИЕ — гуляют по маршрутам карты (map.walkRoutes).
// Их можно бить: вздрагивают и убегают быстрее; выбывший прохожий через
// пару секунд появляется снова в начале какого-нибудь маршрута.
// Они мешают пройти и ловят снаряды — живое укрытие, пока движутся.
// Целью их не выбирают (neutral), но удары и взрывы их задевают.
// ============================================================

const WALK = 1.7;
const RUN = 4.2;
const SCARE_TIME = 2.2;

export function addWalkers(match, routes, count) {
  const walkers = [];
  for (let i = 0; i < count; i++) {
    const route = routes[i % routes.length];
    const start = Math.floor((i / count) * route.points.length) % route.points.length;
    const p = route.points[start];
    const f = createFighter({
      name: 'Прохожий', team: 'npc', model: createPedestrian(), maxHp: 1200,
      spawn: { x: p.x, z: p.z, facing: 0 }, radius: 0.45, headY: 2.45, side: 'neutral',
    });
    f.neutral = true;
    f.stride = Math.random() * 6;
    f.walk = { route, idx: (start + 1) % route.points.length, dir: 1, lastHp: f.hp };
    f.scaredT = 0;
    match.addFighter(f);
    walkers.push(f);
  }

  // каждый кадр: идти к следующей точке маршрута
  const update = (dt) => {
    for (const f of walkers) {
      if (!f.alive) continue;
      const w = f.walk;
      if (f.hp < w.lastHp) f.scaredT = SCARE_TIME;     // ударили — побежал
      w.lastHp = f.hp;
      f.scaredT = Math.max(0, f.scaredT - dt);
      if (f.grabbedBy) { f.moving = false; continue; }

      const pts = w.route.points;
      const target = pts[w.idx];
      const dx = target.x - f.pos.x, dz = target.z - f.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.4) {
        // следующая точка: по кругу или туда-обратно
        if (w.route.loop) w.idx = (w.idx + 1) % pts.length;
        else {
          if (w.idx + w.dir >= pts.length || w.idx + w.dir < 0) w.dir = -w.dir;
          w.idx += w.dir;
        }
        continue;
      }
      const speed = f.scaredT > 0 ? RUN : WALK;
      const step = Math.min(d, speed * dt);
      f.pos.x += (dx / d) * step;
      f.pos.z += (dz / d) * step;
      f.stride += step * (f.scaredT > 0 ? 1.8 : 2.4);
      f.moving = true;
      const a = Math.atan2(dx, dz);
      f.facing += Math.atan2(Math.sin(a - f.facing), Math.cos(a - f.facing)) * Math.min(1, dt * 8);
    }
  };

  // выбывший прохожий появится в начале случайного маршрута
  const onDeath = (f) => {
    if (!f.walk) return;
    const route = routes[Math.floor(Math.random() * routes.length)];
    f.walk = { route, idx: 1 % route.points.length, dir: 1, lastHp: f.maxHp };
    f.spawn = { ...route.points[0], facing: 0 };
    f.scaredT = 0;
  };

  return { walkers, update, onDeath };
}
