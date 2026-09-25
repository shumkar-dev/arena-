import { OBSTACLES, pointBlocked, ARENA } from './arena.js';
import { enemiesOf, lineClear, wrapAngle } from './combat.js';

// ============================================================
// БОТ — управляет бойцом так же, как игрок: каждый кадр отдаёт команду
// { moveX, moveZ, aimDir, attack, ult } — движение, куда смотреть, атака, ульта.
// Как именно играть конкретным героем, бот берёт из hero.bot (папка героя):
//   melee — ближник; range — с какой дистанции бьёт; keep — где держаться;
//   projectileSpeed — для упреждения; ult.range / ult.lead / ult.stream — ульта.
//
// Что умеет:
//   • уклоняется от летящих снарядов, точек удара (шмель) и струи сметаны;
//   • стреляет с упреждением, ближники заходят зигзагом;
//   • теряя здоровье под огнём, прячется за укрытие, потом возвращается;
//   • ищет позицию, откуда видно врага, если тот спрятался;
//   • копит серию и бьёт третьей атакой; ульту бросает, когда она достанет.
// Чтобы не быть роботом-снайпером: реакция ~0,15 с, небольшой разброс прицела,
// от части снарядов не уворачивается.
// ============================================================

export const BOT_NAMES = [
  'Артём', 'Дима', 'Саша', 'Максим', 'Никита', 'Кирилл', 'Егор', 'Ваня', 'Миша', 'Тимур',
  'Руслан', 'Данияр', 'Арсен', 'Лёша', 'Рома', 'Катя', 'Аня', 'Лиза', 'Маша', 'Даша',
  'Полина', 'Алина', 'Камила', 'Вика', 'Соня', 'Ильяс', 'Азамат', 'Нурлан', 'Женя', 'Стас',
];

export const randomBotName = (taken = []) => {
  const free = BOT_NAMES.filter((n) => !taken.includes(n));
  return free[Math.floor(Math.random() * free.length)] ?? 'Бот';
};

// Мастерство бота. По умолчанию — сильный бот; в рейтинговых матчах мастерство
// зависит от звания игрока (src/rating/ranks.js → botSkill).
export const DEFAULT_SKILL = {
  think: 0.15,     // как часто бот принимает решения об атаке и ульте (реакция), с
  aimError: 0.06,  // разброс прицела, рад
  dodge: 0.8,      // от какой доли снарядов пытается увернуться
  lead: 1,         // насколько учитывает движение цели (0 — стреляет туда, где цель сейчас)
  hide: true,      // прячется ли за укрытие, когда ранен
  ultDelay: 0.3,   // сколько «думает», прежде чем бросить готовую ульту, с
};

const norm = (x, z) => { const l = Math.hypot(x, z) || 1; return { x: x / l, z: z / l }; };
const dist = (a, b) => Math.hypot(b.x - a.x, b.z - a.z);

// opts: { role, skill }
//   role — 'attack' (идёт бить чужие бутылки) или 'defend' (сторожит свои); без бутылок не важна
//   skill — мастерство (см. DEFAULT_SKILL), можно передать только часть полей
export function createBot(me, opts = {}) {
  const prof = me.hero.bot;
  const role = opts.role ?? me.botRole ?? 'attack';
  const sk = { ...DEFAULT_SKILL, ...opts.skill };
  const THINK = sk.think;
  const s = {
    think: Math.random() * THINK,
    strafe: Math.random() < 0.5 ? 1 : -1,
    strafeT: 1 + Math.random(),
    steerSide: 1,
    hideT: 0,               // сколько ещё прятаться
    hideSpot: null,
    lastHp: me.hp,
    hurtT: 9,               // сколько секунд назад по нам попали
    ultWish: 0,             // сколько уже держится условие для ульты
    noSight: 0,             // сколько не видит врага
    seen: new WeakMap(),    // снаряд → решил ли уворачиваться
  };
  // счётчики для автотестов и отладки (?debug → window.__game.fighters[i].botStats)
  const stats = me.botStats = { ults: 0, attacks: 0, specials: 0, dodges: 0, hides: 0 };

  // ближайший из списка; того, кого не видно, считаем чуть дальше
  const nearestOf = (list) => {
    let best = null, bestD = Infinity;
    for (const e of list) {
      const d = dist(me.pos, e.pos) - (lineClear(me.pos.x, me.pos.z, e.pos.x, e.pos.z) ? 0 : 3);
      if (d < bestD) { best = e; bestD = d; }
    }
    return best;
  };

  // Кого бить. В режимах с бутылками — по роли: защитник сторожит свои,
  // нападающий идёт к чужим, но отвечает тем, кто подошёл вплотную.
  // null — врага рядом нет, защитник стоит на посту.
  const pickTarget = (world) => {
    const foes = enemiesOf(me, world);
    const heroes = foes.filter((e) => e.kit);
    const objs = foes.filter((e) => e.isObjective);
    const mine = world.fighters.filter((f) => f.isObjective && f.alive && f.team === me.team);
    if (!objs.length && !mine.length) return nearestOf(heroes);

    const threat = nearestOf(heroes.filter((h) => mine.some((o) => dist(h.pos, o.pos) < 7)));
    const close = nearestOf(heroes.filter((h) => dist(me.pos, h.pos) < (role === 'defend' ? 8 : 5)));
    if (role === 'defend') return threat ?? close;
    return close ?? (threat && dist(me.pos, threat.pos) < 9 ? threat : null) ?? nearestOf(objs) ?? nearestOf(heroes);
  };

  // пост защитника: перед своими бутылками, ближе к центру
  const guardPoint = (world) => {
    const mine = world.fighters.filter((f) => f.isObjective && f.alive && f.team === me.team);
    if (!mine.length) return null;
    const cx = mine.reduce((a, o) => a + o.pos.x, 0) / mine.length;
    const cz = mine.reduce((a, o) => a + o.pos.z, 0) / mine.length;
    return { x: cx * 0.6, z: cz - Math.sign(cz) * 3.5 };
  };

  // стоит ли сходить за предметом: сигарета рядом, аптечка — когда ранен
  const wantPickup = (world, enemy) => {
    const foeNear = enemy && enemy.kit && dist(me.pos, enemy.pos) < 4.5;
    if (foeNear) return null;
    let best = null, bestD = Infinity;
    for (const sp of world.pickups?.spots ?? []) {
      if (!sp.active) continue;
      const d = dist(me.pos, sp);
      const want = sp.kind === 'cig' ? d < 7 && !me.hasEffect('cig') : sp.kind === 'medkit' && me.hp < me.maxHp * 0.6 && d < 11;
      if (want && d < bestD) { best = sp; bestD = d; }
    }
    return best;
  };

  // --- уклонение: вектор «прочь от опасности» или null ---
  const dodge = (world) => {
    let vx = 0, vz = 0;
    // снаряды, летящие в нас
    for (const p of world.projectiles.list) {
      if (p.owner.team === me.team) continue;
      if (!s.seen.has(p)) s.seen.set(p, Math.random() < sk.dodge);
      if (!s.seen.get(p)) continue;
      const sp = Math.hypot(p.vx, p.vz) || 1;
      const ux = p.vx / sp, uz = p.vz / sp;
      const rx = me.pos.x - p.x, rz = me.pos.z - p.z;
      const along = rx * ux + rz * uz;
      if (along < -0.3 || along > sp * 0.75) continue;          // уже пролетел или ещё далеко
      const cross = rx * uz - rz * ux;                          // сбоку от линии полёта
      if (Math.abs(cross) > me.radius + p.radius + 0.45) continue;
      const side = cross >= 0 ? 1 : -1;
      vx += uz * side * 1.5; vz += -ux * side * 1.5;            // шаг поперёк траектории
    }
    // точки удара (шмель) и зоны вражеской ульты
    for (const d of world.dangers) {
      if (d.team === me.team) continue;
      const dd = Math.hypot(me.pos.x - d.x, me.pos.z - d.z);
      if (dd < d.r + me.radius + 0.6) {
        const n = dd > 0.01 ? norm(me.pos.x - d.x, me.pos.z - d.z) : { x: 1, z: 0 };
        vx += n.x * 2; vz += n.z * 2;
      }
    }
    for (const e of enemiesOf(me, world)) {
      const area = e.kit?.activeArea?.();   // у бутылок и прохожих приёмов нет
      if (!area || area.type !== 'cone') continue;
      const dx = me.pos.x - e.pos.x, dz = me.pos.z - e.pos.z;
      const dd = Math.hypot(dx, dz);
      if (dd > area.reach + me.radius + 0.5) continue;
      const off = wrapAngle(Math.atan2(dx, dz) - e.facing);
      if (Math.abs(off) > area.arc + 0.35) continue;
      const side = off >= 0 ? 1 : -1;                             // выйти из конуса вбок и назад
      vx += Math.cos(e.facing) * side * 1.6 + dx / dd * 0.8;
      vz += -Math.sin(e.facing) * side * 1.6 + dz / dd * 0.8;
    }
    return vx || vz ? norm(vx, vz) : null;
  };

  // --- обход препятствий: повернуть желаемое направление, пока впереди не станет свободно ---
  const steer = (dir) => {
    const clear = (a) => {
      const x = Math.sin(a), z = Math.cos(a);
      for (const k of [0.7, 1.4]) if (pointBlocked(me.pos.x + x * k, me.pos.z + z * k, me.radius * 0.9)) return false;
      return true;
    };
    const base = Math.atan2(dir.x, dir.z);
    if (clear(base)) return dir;
    for (const step of [0.45, 0.9, 1.35, 1.8]) {
      for (const side of [s.steerSide, -s.steerSide]) {
        const a = base + step * side;
        if (clear(a)) { s.steerSide = side; return { x: Math.sin(a), z: Math.cos(a) }; }
      }
    }
    return dir;
  };

  // --- укрытие: точка за ближайшим препятствием с противоположной от врага стороны ---
  const findCover = (enemy) => {
    let best = null, bestD = 7;
    for (const o of OBSTACLES) {
      const n = norm(o.x - enemy.pos.x, o.z - enemy.pos.z);
      const off = Math.max(o.maxX - o.minX, o.maxZ - o.minZ) / 2 + me.radius + 0.5;
      const p = { x: o.x + n.x * off, z: o.z + n.z * off };
      if (pointBlocked(p.x, p.z, me.radius) || Math.abs(p.x) > ARENA.halfW - 1 || Math.abs(p.z) > ARENA.halfL - 1) continue;
      if (lineClear(enemy.pos.x, enemy.pos.z, p.x, p.z)) continue;       // оттуда враг всё равно видит
      const d = dist(me.pos, p);
      if (d < bestD) { best = p; bestD = d; }
    }
    return best;
  };

  // --- позиция, откуда видно врага (если он за укрытием) ---
  const findSight = (enemy, want) => {
    let best = null, bestScore = Infinity;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      for (const r of [2, 3.5]) {
        const p = { x: me.pos.x + Math.sin(a) * r, z: me.pos.z + Math.cos(a) * r };
        if (pointBlocked(p.x, p.z, me.radius)) continue;
        if (!lineClear(p.x, p.z, enemy.pos.x, enemy.pos.z)) continue;
        const score = Math.abs(dist(p, enemy.pos) - want) + r * 0.5;
        if (score < bestScore) { best = p; bestScore = score; }
      }
    }
    return best;
  };

  // --- точка прицела с упреждением ---
  const leadPoint = (enemy, time) => ({
    x: enemy.pos.x + (enemy.vel?.x ?? 0) * time,
    z: enemy.pos.z + (enemy.vel?.z ?? 0) * time,
  });

  return {
    /** Команда на этот кадр. */
    think(dt, world) {
      const cmd = { moveX: 0, moveZ: 0, aimDir: null };
      if (!me.alive) { s.lastHp = me.maxHp; return cmd; }

      s.hurtT = me.hp < s.lastHp ? 0 : s.hurtT + dt;
      s.lastHp = me.hp;
      s.strafeT -= dt;
      if (s.strafeT <= 0) { s.strafe = -s.strafe; s.strafeT = 0.9 + Math.random() * 1.2; }

      const enemy = pickTarget(world);
      if (!enemy) {
        // никого рядом: за предметом, на пост у своих бутылок или к центру
        const item = wantPickup(world, null);
        const post = item ?? guardPoint(world) ?? { x: 0, z: 0 };
        if (dist(me.pos, post) > 1.2) { const d = steer(norm(post.x - me.pos.x, post.z - me.pos.z)); cmd.moveX = d.x; cmd.moveZ = d.z; }
        const away = dodge(world);
        if (away) { const d = steer(away); cmd.moveX = d.x; cmd.moveZ = d.z; }
        return cmd;
      }

      const d = dist(me.pos, enemy.pos);
      const sight = lineClear(me.pos.x, me.pos.z, enemy.pos.x, enemy.pos.z);
      s.noSight = sight ? 0 : s.noSight + dt;
      const hud = me.kit.hud();
      const toE = norm(enemy.pos.x - me.pos.x, enemy.pos.z - me.pos.z);
      const perp = { x: toE.z * s.strafe, z: -toE.x * s.strafe };

      // ---- куда идти ----
      let move = null;

      const item = wantPickup(world, enemy);

      // ранен и под огнём — за укрытие (кроме ближников вплотную: им лучше добивать)
      if (sk.hide && s.hideT <= 0 && s.hurtT < 0.3 && me.hp < me.maxHp * 0.45 && !enemy.isStatic && !(prof.melee && d < prof.range + 0.5) && !hud.ultActive) {
        s.hideSpot = findCover(enemy);
        if (s.hideSpot) { s.hideT = 1.4; stats.hides += 1; }
      }
      if (s.hideT > 0) {
        s.hideT -= dt;
        if (s.hideSpot && dist(me.pos, s.hideSpot) > 0.4) move = norm(s.hideSpot.x - me.pos.x, s.hideSpot.z - me.pos.z);
        else move = { x: 0, z: 0 };
      } else if (item && !hud.ultActive) {
        // за сигаретой или аптечкой
        move = norm(item.x - me.pos.x, item.z - me.pos.z);
      } else if (hud.ultCd <= 0 && !hud.ultActive && d > prof.ult.range && d < prof.ult.range + 6) {
        // ульта готова, но не достаёт — подойти на её дистанцию (зигзагом)
        const zig = Math.sin(world.time * 5 + me.id) * 0.6;
        move = norm(toE.x + perp.x * zig, toE.z + perp.z * zig);
      } else if (hud.ultActive && prof.ult.stream) {
        // струя: подойти на треть дальности и держать её на враге
        move = d > prof.ult.range * 0.6 ? toE : { x: perp.x * 0.5, z: perp.z * 0.5 };
      } else if (prof.melee) {
        // ближник: сближение зигзагом, вплотную — кружит вокруг
        if (d > prof.keep + 0.3) {
          const zig = d > 3 ? Math.sin(world.time * 5 + me.id) * 0.7 : 0;
          move = norm(toE.x + perp.x * zig, toE.z + perp.z * zig);
        } else move = { x: perp.x * 0.6, z: perp.z * 0.6 };
      } else if (!sight && s.noSight > 0.4) {
        // стрелок не видит врага — выйти на линию огня
        const p = findSight(enemy, prof.keep);
        move = p ? norm(p.x - me.pos.x, p.z - me.pos.z) : toE;
      } else if (d > prof.range - 0.5) {
        move = norm(toE.x + perp.x * 0.35, toE.z + perp.z * 0.35);     // подойти, не по прямой
      } else if (d < prof.keep - 1.2) {
        move = norm(-toE.x + perp.x * 0.6, -toE.z + perp.z * 0.6);     // отойти от ближника
      } else {
        move = perp;                                                    // стрейф на дистанции
      }

      // уклонение важнее всего
      const away = dodge(world);
      if (away) { move = norm(move.x * 0.3 + away.x, move.z * 0.3 + away.z); stats.dodges += dt; }

      if (move.x || move.z) {
        const m = Math.hypot(move.x, move.z);
        const st = steer({ x: move.x / m, z: move.z / m });
        cmd.moveX = st.x * Math.min(1, m); cmd.moveZ = st.z * Math.min(1, m);
      }

      // струя сметаны всё время смотрит на врага
      if (hud.ultActive && prof.ult.stream) cmd.aimDir = toE;

      // ---- атака и ульта: решения не каждый кадр, а с реакцией ----
      s.think -= dt;
      if (s.think > 0) return cmd;
      s.think = THINK * (0.8 + Math.random() * 0.4);

      // ульта
      const ultReady = hud.ultCd <= 0 && !hud.ultActive;
      const ultOk = ultReady && d <= prof.ult.range && (sight || prof.ult.lead);
      s.ultWish = ultOk ? s.ultWish + THINK : 0;
      if (ultOk && s.ultWish >= sk.ultDelay) {
        const t = typeof prof.ult.lead === 'function' ? prof.ult.lead(d) * sk.lead : 0;
        cmd.ult = leadPoint(enemy, t);
        s.ultWish = 0;
        stats.ults += 1;
        return cmd;
      }

      // атака: только если достанет и путь чист — промах сбивает серию
      if (!hud.attackLocked && d <= prof.range) {
        const t = prof.projectileSpeed ? (d / prof.projectileSpeed) * sk.lead : 0;
        const p = leadPoint(enemy, t);
        if (prof.melee || lineClear(me.pos.x, me.pos.z, p.x, p.z)) {
          const a = Math.atan2(p.x - me.pos.x, p.z - me.pos.z) + (Math.random() * 2 - 1) * sk.aimError;
          cmd.attack = { x: Math.sin(a), z: Math.cos(a) };
          stats.attacks += 1;
          if (hud.combo >= 2) stats.specials += 1;
        }
      }
      return cmd;
    },
  };
}
