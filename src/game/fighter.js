import * as THREE from 'three';

// ============================================================
// БОЕЦ — общее для игрока, манекена и будущих ботов:
// ХП, получение урона, вспышка и отшатывание, смерть, возрождение.
// Что и как бьёт — решает набор приёмов персонажа (kits/*).
// ============================================================

export const RESPAWN_TIME = 3;
const DEATH_FALL = 0.35;   // время падения, с
const DEATH_HIDE = 1.0;    // когда тело исчезает

let nextId = 1;

export function createFighter({ name, team, model, maxHp, spawn, radius = 0.5, headY = 2.9 }) {
  const wrapper = new THREE.Group();
  wrapper.add(model.root);

  // уникальные материалы модели — для белой вспышки при попадании
  const mats = new Set();
  model.root.traverse((o) => { if (o.material) mats.add(o.material); });

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.62, 0.78, 32),
    new THREE.MeshBasicMaterial({ color: team === 'blue' ? 0x3fd0ff : 0xff4a4a, transparent: true, opacity: 0.85 })
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
    lastHitAt: -Infinity,
  };

  f.canAct = () => f.alive && !f.grabbedBy;

  // amount — урон; from — атакующий (для направления отшатывания)
  f.takeDamage = (amount, from) => {
    if (!f.alive) return 0;
    const dealt = Math.min(f.hp, Math.round(amount));
    f.hp -= dealt;
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
      f.respawnIn = RESPAWN_TIME;
      f.grabbedBy = null;
      f.lift = 0;
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

  // вызывается после animate модели
  f.updateView = (dt) => {
    if (!f.alive) {
      f.deathT += dt;
      f.respawnIn = Math.max(0, f.respawnIn - dt);
      tilt(Math.min(1, f.deathT / DEATH_FALL) * (Math.PI / 2));
      model.root.position.y = 0;
      if (f.deathT > DEATH_HIDE) { wrapper.visible = false; ring.visible = false; }
      if (f.respawnIn <= 0) f.respawn();
    } else {
      f.flinch = Math.max(0, f.flinch - dt * 6);
      tilt(Math.sin(f.flinch * Math.PI) * 0.28);
      model.root.position.y = f.lift;
    }

    f.flash = Math.max(0, f.flash - dt * 7);
    for (const m of mats) m.emissive.setScalar(f.flash * 0.6);

    wrapper.position.copy(f.pos);
    wrapper.rotation.y = f.facing;
    ring.position.set(f.pos.x, 0.03, f.pos.z);
  };

  f.addTo = (scene) => { scene.add(wrapper); scene.add(ring); };

  return f;
}
