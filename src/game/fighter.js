import * as THREE from 'three';

// ============================================================
// БОЕЦ — общее для игрока, ботов, манекена, бутылок и прохожих:
// ХП, получение урона, статусы, смерть, возрождение.
// tick(dt) — логика (часть симуляции матча), updateView(dt) — только картинка.
// Что и как бьёт — решает набор приёмов героя (src/heroes/<id>/kit.js).
// ============================================================

export const RESPAWN_TIME = 3;
const DEATH_FALL = 0.35;   // время падения, с
const DEATH_HIDE = 1.0;    // когда тело исчезает

let nextId = 1;

const RING_COLORS = { self: 0x3fd0ff, ally: 0x5ce06a, enemy: 0xff4a4a, neutral: 0xd9d2c0 };

// side — чей это боец для локального игрока: 'self' | 'ally' | 'enemy' | 'neutral' (цвет кольца и полоски ХП)
export function createFighter({ name, team, model, maxHp, spawn, radius = 0.5, headY = 2.9, side = 'enemy', respawns = true }) {
  const wrapper = new THREE.Group();
  wrapper.add(model.root);

  // уникальные материалы модели — для белой вспышки при попадании
  // (запоминаем собственное свечение материала — у сопел Изюма и глаз Смитаны оно есть)
  const matSet = new Set();
  // у меша может быть массив материалов (этикетка бутылки), а у простых материалов нет свечения
  model.root.traverse((o) => { for (const m of [].concat(o.material ?? [])) if (m.emissive) matSet.add(m); });
  const mats = [...matSet].map((m) => ({ m, base: m.emissive.clone() }));

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.62, 0.78, 32),
    new THREE.MeshBasicMaterial({ color: RING_COLORS[side] ?? 0xff4a4a, transparent: true, opacity: 0.85 })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;

  const f = {
    id: nextId++,
    name,
    team,
    model,
    wrapper,
    ring,
    radius,
    headY,
    maxHp,
    hp: maxHp,
    alive: true,
    spawn: { ...spawn },
    pos: new THREE.Vector3(spawn.x, 0, spawn.z),
    facing: spawn.facing ?? 0,
    lift: 0,                 // подъём над землёй (например, в захвате)
    deathT: 0,
    respawnIn: 0,
    flash: 0,
    flinch: 0,
    hitDir: new THREE.Vector2(0, 1),
    grabbedBy: null,         // кто держит этого бойца
    effects: {},             // статусы: имя → { t — сколько осталось, ...данные }
    side,
    respawns,                // возрождается ли после смерти (в «каждый сам за себя» — нет)
    kills: 0,
  };

  // статусы: slow { mul } — замедление, frenzy — ускоренная атака и т. п.
  f.addEffect = (name, t, data = {}) => { f.effects[name] = { ...data, t }; };
  f.hasEffect = (name) => (f.effects[name]?.t ?? 0) > 0;
  f.moveMul = () => (f.hasEffect('slow') ? f.effects.slow.mul : 1);

  f.canAct = () => f.alive && !f.grabbedBy;

  // лечение (аптечка); вернёт, сколько реально восстановлено
  f.heal = (amount) => {
    if (!f.alive) return 0;
    const h = Math.min(f.maxHp - f.hp, Math.round(amount));
    f.hp += h;
    return h;
  };

  // amount — урон; from — атакующий (для направления отшатывания)
  f.takeDamage = (amount, from) => {
    if (!f.alive) return 0;
    const dealt = Math.min(f.hp, Math.round(amount));
    f.hp -= dealt;
    if (from) f.lastHitBy = from;   // кому засчитать, если это добивание
    f.flash = 1;
    f.flinch = 1;
    if (from) {
      f.hitDir.set(f.pos.x - from.pos.x, f.pos.z - from.pos.z);
      if (f.hitDir.lengthSq() < 1e-6) f.hitDir.set(0, 1);
      f.hitDir.normalize();
    }
    if (f.hp <= 0) {
      f.alive = false;
      f.deathT = 0;
      f.respawnIn = f.respawns ? RESPAWN_TIME : Infinity;
      f.grabbedBy = null;
      f.lift = 0;
      f.effects = {};
    }
    return dealt;
  };

  f.respawn = () => {
    f.alive = true;
    f.hp = f.maxHp;
    f.pos.set(f.spawn.x, 0, f.spawn.z);
    f.facing = f.spawn.facing ?? 0;
    f.lift = 0;
    f.flash = 0;
    f.flinch = 0;
    f.grabbedBy = null;
    f.effects = {};
    f.lastHitBy = null;
    wrapper.visible = true;
    ring.visible = true;
  };

  // наклон корпуса в сторону удара, в локальных осях модели
  const tilt = (amt) => {
    const c = Math.cos(-f.facing), s = Math.sin(-f.facing);
    const lx = f.hitDir.x * c + f.hitDir.y * s;
    const lz = -f.hitDir.x * s + f.hitDir.y * c;
    model.root.rotation.x = lz * amt;
    model.root.rotation.z = -lx * amt;
  };

  // логика: таймеры статусов, смерти и возрождения
  f.tick = (dt) => {
    if (!f.alive) {
      f.deathT += dt;
      f.respawnIn = Math.max(0, f.respawnIn - dt);
      if (f.respawnIn <= 0) f.respawn();
      return;
    }
    for (const k in f.effects) {
      f.effects[k].t -= dt;
      if (f.effects[k].t <= 0) delete f.effects[k];
    }
  };

  // картинка: вызывается после animate модели
  f.updateView = (dt) => {
    if (!f.alive) {
      tilt(Math.min(1, f.deathT / DEATH_FALL) * (Math.PI / 2));
      model.root.position.y = 0;
      if (f.deathT > DEATH_HIDE) { wrapper.visible = false; ring.visible = false; }
    } else {
      f.flinch = Math.max(0, f.flinch - dt * 6);
      tilt(Math.sin(f.flinch * Math.PI) * 0.28);
      model.root.position.y = f.lift;
    }

    f.flash = Math.max(0, f.flash - dt * 7);
    const slow = f.hasEffect('slow') ? 0.25 : 0;
    const w = f.flash * 0.6;
    for (const { m, base } of mats) m.emissive.setRGB(base.r + w, base.g + w + slow * 0.6, base.b + w + slow);

    wrapper.position.copy(f.pos);
    wrapper.rotation.y = f.facing;
    ring.position.set(f.pos.x, 0.03, f.pos.z);
  };

  f.addTo = (scene) => { scene.add(wrapper); scene.add(ring); };
  f.removeFrom = (scene) => { scene.remove(wrapper); scene.remove(ring); };

  return f;
}
