import { resolveCollisions } from './arena.js';
import { createFighter } from './fighter.js';
import { heroById } from '../heroes/index.js';
import { createProjectiles } from './combat.js';
import { createPickups } from './pickups.js';

// ============================================================
// МАТЧ — симуляция боя без камеры, кнопок и экрана.
//
// Каждый боец управляется контроллером: раз в кадр контроллер отдаёт команду
//   { moveX, moveZ, aimDir, attack, ult }
// Контроллеры — кнопки (local), бот (bot) и игрок по сети (remote):
// команды приходят по сети, а симуляция остаётся той же (сервер — server/).
// Команда — простой объект без ссылок, её можно переслать как JSON.
//
// Всё, что должен увидеть или услышать игрок, матч не рисует сам, а кладёт
// в очередь событий match.events: урон, смерть, возрождение, звук, реплика.
// Отображение (engine.js) разбирает очередь каждый кадр. При сетевой игре
// хост будет рассылать эти же события клиентам.
//
// Правила — в режиме (src/modes/*): кто выходит на арену, счёт, конец матча.
// ============================================================

export function createMatch({ scene, fx, mode, options = {} }) {
  const fighters = [];
  const events = [];
  const projectiles = createProjectiles(scene);
  const pickups = createPickups(scene);

  const world = {
    fighters,
    projectiles,
    fx,
    pickups,
    time: 0,
    dangers: [],            // точки, куда вот-вот прилетит удар: { x, z, r, t, team } — боты их обходят
    damage(target, amount, from, kind) {
      const mul = from?.damageMul?.() ?? 1;
      const dealt = target.takeDamage(amount * mul, from);
      if (dealt > 0) events.push({ type: 'damage', target, amount: dealt, kind });
      return dealt;
    },
    heal(f, amount) { if (amount > 0) events.push({ type: 'heal', target: f, amount }); },
    say(f, text) { events.push({ type: 'say', f, text }); },
    sfx(name, opts) { events.push({ type: 'sfx', name, opts }); },
  };

  const match = {
    world,
    fighters,
    events,
    mode,
    options,
    result: null,           // когда матч кончился: { winners: [команды], places: [{ f, place }], reason }
    state: {},              // счёт и прочее — заводит режим

    /**
     * Выпустить героя на арену.
     * control: 'local' — кнопки этого устройства, 'bot' — бот, 'remote' — игрок по сети.
     */
    addHero(heroId, { name, team, spawn, control = 'bot', side = 'enemy', respawns = true }) {
      const hero = heroById(heroId);
      const f = createFighter({ name, team, model: hero.createModel(), maxHp: hero.stats.maxHp, spawn, side, respawns });
      f.hero = hero;
      f.kit = hero.createKit(f);
      f.control = control;
      f.stride = 0;
      f.moving = false;
      f.vel = { x: 0, z: 0 };
      f.damageMul = () => (f.hasEffect('cig') ? f.effects.cig.mul : 1);
      f.addTo(scene);
      fighters.push(f);
      return f;
    },

    // любой боец без приёмов героя (прохожий): двигает его режим
    addFighter(f) {
      f.addTo(scene);
      fighters.push(f);
      return f;
    },

    // неподвижный объект с ХП: манекен, бутылка «Султан чая»
    addObject(f) {
      f.isStatic = true;
      f.addTo(scene);
      fighters.push(f);
      return f;
    },

    // предмет на карте: 'cig' — усилитель, 'medkit' — аптечка
    addPickup(kind, x, z, respawn) { return pickups.add(kind, x, z, respawn); },

    finish(result) {
      if (!match.result) {
        match.result = { ...result, at: world.time };
        events.push({ type: 'finish', result: match.result });
      }
    },
  };

  // выполнить команду бойца: движение, взгляд, атака, ульта
  const act = (f, cmd, dt) => {
    const kit = f.kit;
    if (cmd.attack !== undefined) kit.attack(cmd.attack);
    if (cmd.ult !== undefined) kit.ult(cmd.ult, world);

    let mx = cmd.moveX, mz = cmd.moveZ;
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }
    const mag = Math.min(1, len);

    f.moving = mag > 0.12 && f.canAct() && !kit.busy;
    f.before = f.pos.clone();
    // Пока прицел оттянут или идёт атака, боец смотрит в сторону прицела,
    // даже если бежит в другую сторону (как в Brawl Stars). Иначе — по ходу движения.
    const holdFacing = !!cmd.aimDir || kit.lockFacing != null;
    if (f.moving) {
      const speed = f.hero.stats.speed * kit.speedMul * f.moveMul();
      f.pos.x += mx * speed * mag * dt;
      f.pos.z += mz * speed * mag * dt;
      if (!holdFacing) {
        const d = Math.atan2(Math.sin(Math.atan2(mx, mz) - f.facing), Math.cos(Math.atan2(mx, mz) - f.facing));
        f.facing += d * Math.min(1, dt * 14);
      }
    }
    // прицел оттянут — смотрит туда (так же ведётся струя сметанамёта)
    if (cmd.aimDir && f.canAct() && !kit.busy) f.facing = Math.atan2(cmd.aimDir.x, cmd.aimDir.z);

    kit.update(dt, world);
    // атака началась или идёт — держим угол, в который она направлена
    if (kit.lockFacing != null) f.facing = kit.lockFacing;
    if (kit.forcedMoving != null) f.moving = kit.forcedMoving;
  };

  // бойцы не проходят друг сквозь друга; неподвижных толкать нельзя
  const separate = () => {
    for (let i = 0; i < fighters.length; i++) {
      for (let j = i + 1; j < fighters.length; j++) {
        const a = fighters[i], b = fighters[j];
        if (!a.alive || !b.alive || a.grabbedBy === b || b.grabbedBy === a) continue;
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
        const d = Math.hypot(dx, dz), min = a.radius + b.radius;
        if (d >= min || d < 1e-6) continue;
        if (a.isStatic && b.isStatic) continue;
        const push = min - d, nx = dx / d, nz = dz / d;
        const wa = a.isStatic ? 0 : b.isStatic ? 1 : 0.5;
        const wb = 1 - wa;
        a.pos.x -= nx * push * wa; a.pos.z -= nz * push * wa;
        b.pos.x += nx * push * wb; b.pos.z += nz * push * wb;
      }
    }
  };

  /** Шаг симуляции. controllers: fighter → { command(dt, world) } */
  match.step = (dt, controllers) => {
    world.time += dt;
    for (let i = world.dangers.length - 1; i >= 0; i--) {
      world.dangers[i].t -= dt;
      if (world.dangers[i].t <= 0) world.dangers.splice(i, 1);
    }

    // команды и действия всех героев (после конца матча — стоят)
    for (const f of fighters) {
      if (!f.kit) continue;
      const ctl = controllers.get(f);
      f.cmd = !match.result && ctl ? ctl.command(dt, world) : { moveX: 0, moveZ: 0, aimDir: null };
      act(f, f.cmd, dt);
    }
    mode.beforePhysics?.(match, dt);

    // столкновения, скорость, шаг
    separate();
    for (const f of fighters) if (f.alive && !f.grabbedBy && !f.isStatic) resolveCollisions(f.pos, f.radius);
    for (const f of fighters) {
      if (!f.kit) continue;
      f.stride += f.before.distanceTo(f.pos) * f.hero.stride / (f.kit.speedMul > 1.3 ? 1.22 : 1);
      // сглаженная скорость — боты по ней стреляют с упреждением
      const k = Math.min(1, dt * 10);
      f.vel.x += ((f.pos.x - f.before.x) / Math.max(dt, 1e-4) - f.vel.x) * k;
      f.vel.z += ((f.pos.z - f.before.z) / Math.max(dt, 1e-4) - f.vel.z) * k;
    }

    projectiles.update(dt, world);
    pickups.update(dt, world);

    // таймеры, смерти, возрождения
    for (const f of fighters) {
      f.tick(dt);
      const was = f.wasAlive ?? true;
      if (f.alive !== was) {
        if (!f.alive) {
          const killer = f.lastHitBy && f.lastHitBy !== f ? f.lastHitBy : null;
          if (killer && killer.team !== f.team && f.kit) killer.kills += 1;   // прохожие и бутылки — не убийства
          events.push({ type: 'death', victim: f, killer });
          mode.onDeath?.(match, f, killer);
        } else {
          events.push({ type: 'respawn', f });
        }
      }
      f.wasAlive = f.alive;
    }

    if (!match.result) mode.update?.(match, dt);
  };

  match.dispose = () => projectiles.clear();

  return match;
}
