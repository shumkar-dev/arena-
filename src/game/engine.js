import * as THREE from 'three';
import { buildArena, resolveCollisions, ARENA } from './arena.js';
import { createDummy } from '../characters/dummy.js';
import { createFighter } from './fighter.js';
import { HEROES, heroById } from '../heroes/index.js';
import { createOverlay } from './overlay.js';
import { createProjectiles, nearestEnemy } from './combat.js';
import { createEffects } from './effects.js';
import { createAim } from './aim.js';
import { createBot, randomBotName } from './bot.js';
import { sound } from './sound.js';

// ============================================================
// ИГРОВОЙ ЦИКЛ — вне React, чтобы не пересоздавать сцену на каждый рендер.
// Каждый боец (игрок или бот) управляется одинаково: раз в кадр получает команду
// { moveX, moveZ, aimDir, attack, ult }. Игроку её собирает input с кнопок,
// боту — его мозг (bot.js). React-интерфейс пишет в input и читает onHud.
//
// options: { heroId, botHeroId, dummy, autoplay, fast }
//   dummy    — вместо бота манекен (тренировка, автотесты)
//   autoplay — игроком тоже управляет бот (автотесты, прогон баланса)
//   fast     — шагов симуляции на кадр (ускоренная прокрутка для автотестов)
// ============================================================

const PLAYER_SPAWN = { x: 0, z: ARENA.halfL - 3, facing: Math.PI };   // юг, смотрит на север (−Z)
const BOT_SPAWN = { x: 0, z: -ARENA.halfL + 3, facing: 0 };           // север, смотрит на юг
const DUMMY_SPAWN = { x: -2.2, z: 7.5, facing: 0 };

const CAM_OFFSET = new THREE.Vector3(0, 14.5, 9.5);

// Оттяжка кнопки: (dx, dy) — вектор −1..1 в экранных осях, экранный низ = +Z.
// Меньше порога — считаем коротким касанием (автоприцел).
const AIM_DEAD = 0.25;
const dragDir = (dx, dy) => {
  const m = Math.hypot(dx, dy);
  return m < AIM_DEAD ? null : { x: dx / m, z: dy / m };
};

export function createGame(mount, input, onHud, options = {}) {
  const hero = heroById(options.heroId);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fb4c8);
  scene.fog = new THREE.Fog(0x9fb4c8, 30, 60);

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const dom = renderer.domElement;
  dom.style.width = '100%';
  dom.style.height = '100%';
  dom.style.display = 'block';
  mount.appendChild(dom);

  const resize = () => {
    const w = mount.clientWidth || window.innerWidth, h = mount.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // в узком (портретном) окне отъезжаем, чтобы влезала ширина дороги
    camera.fov = camera.aspect < 1 ? 60 : 40;
    camera.updateProjectionMatrix();
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(mount);

  // ---- свет ----
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x4a4036, 1.1));
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 60 });
  sun.shadow.bias = -0.0005;
  scene.add(sun, sun.target);

  buildArena(scene);

  const overlay = createOverlay(mount);
  const projectiles = createProjectiles(scene);
  const fx = createEffects(scene);
  const aim = createAim(scene);

  const fighters = [];
  const score = { blue: 0, red: 0 };
  let player = null;

  const world = {
    fighters,
    projectiles,
    fx,
    time: 0,
    dangers: [],            // точки, куда вот-вот прилетит удар: { x, z, r, t, team } — боты их обходят
    damage(target, amount, from, kind) {
      const dealt = target.takeDamage(amount, from);
      if (dealt > 0) overlay.spawnNumber(target, dealt, target === player ? 'taken' : kind);
      if (dealt > 0 && target === player) sound.play('hurt');
      return dealt;
    },
    say(f, text) { overlay.spawnNumber(f, text, 'text'); },
    sfx(name, opts) { sound.play(name, opts); },
  };

  // ---- бойцы ----
  const spawnHero = (h, { name, team, spawn, brain }) => {
    const f = createFighter({ name, team, model: h.createModel(), maxHp: h.stats.maxHp, spawn });
    f.hero = h;
    f.kit = h.createKit(f);
    f.stride = 0;
    f.moving = false;
    f.vel = { x: 0, z: 0 };
    f.addTo(scene);
    fighters.push(f);
    if (brain) f.brain = createBot(f);
    return f;
  };

  player = spawnHero(hero, { name: hero.name, team: 'blue', spawn: PLAYER_SPAWN, brain: !!options.autoplay });

  if (options.dummy) {
    const dummy = createFighter({ name: 'Манекен', team: 'red', model: createDummy(), maxHp: 4000, spawn: DUMMY_SPAWN, radius: 0.55, headY: 2.75 });
    dummy.isStatic = true;
    dummy.addTo(scene);
    fighters.push(dummy);
  } else {
    const botHero = options.botHeroId ? heroById(options.botHeroId) : HEROES[Math.floor(Math.random() * HEROES.length)];
    spawnHero(botHero, { name: randomBotName(), team: 'red', spawn: BOT_SPAWN, brain: true });
  }

  // точка ульты по оттяжке кнопки игрока; короткое касание — в ближайшего врага, иначе перед собой
  const ultPoint = (f, dx, dy) => {
    const kit = f.kit;
    const mag = Math.hypot(dx, dy);
    if (mag < 0.2) {
      const tgt = nearestEnemy(f, world, kit.ultAutoRange ?? kit.ultRange ?? 8);
      if (tgt) return { x: tgt.pos.x, z: tgt.pos.z };
      const r = (kit.ultRange ?? 4) * 0.5;
      return { x: f.pos.x + Math.sin(f.facing) * r, z: f.pos.z + Math.cos(f.facing) * r };
    }
    const k = Math.min(1, mag) / mag;
    return { x: f.pos.x + dx * k * kit.ultRange, z: f.pos.z + dy * k * kit.ultRange };
  };

  // команда игрока из кнопок и джойстика
  const playerCommand = () => {
    const cmd = { moveX: input.moveX, moveZ: input.moveY, aimDir: null };
    if (input.attackAim?.active) cmd.aimDir = dragDir(input.attackAim.dx, input.attackAim.dy);
    if (input.attack) { input.attack = false; cmd.attack = null; }          // касание — автоприцел
    if (input.attackFire) {                                                   // отпустили оттянутую кнопку
      cmd.attack = dragDir(input.attackFire.dx, input.attackFire.dy);
      input.attackFire = null;
    }
    if (input.ult) { input.ult = false; cmd.ult = player.kit.ultAim === 'drag' ? ultPoint(player, 0, 0) : null; }
    if (input.ultFire) { cmd.ult = ultPoint(player, input.ultFire.dx, input.ultFire.dy); input.ultFire = null; }
    return cmd;
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
        const push = min - d, nx = dx / d, nz = dz / d;
        const wa = a.isStatic ? 0 : b.isStatic ? 1 : 0.5;
        const wb = 1 - wa;
        a.pos.x -= nx * push * wa; a.pos.z -= nz * push * wa;
        b.pos.x += nx * push * wb; b.pos.z += nz * push * wb;
      }
    }
  };

  const camTarget = new THREE.Vector3();
  const updateCamera = (dt) => {
    const tx = player.pos.x * 0.55;
    const tz = Math.max(-ARENA.halfL + 6, Math.min(ARENA.halfL - 4, player.pos.z));
    const k = dt < 0 ? 1 : 1 - Math.exp(-dt * 6);
    camTarget.x += (tx - camTarget.x) * k;
    camTarget.z += (tz - camTarget.z) * k;
    camera.position.copy(camTarget).add(CAM_OFFSET);
    camera.lookAt(camTarget.x, 0, camTarget.z - 1.5);
    sun.position.set(camTarget.x + 8, 20, camTarget.z + 6);
    sun.target.position.set(camTarget.x, 0, camTarget.z);
  };
  updateCamera(-1);

  const clock = new THREE.Clock();
  let raf = 0, hudAcc = 0, lastHud = '';

  const step = (dt, t) => {
    world.time += dt;
    for (let i = world.dangers.length - 1; i >= 0; i--) {
      world.dangers[i].t -= dt;
      if (world.dangers[i].t <= 0) world.dangers.splice(i, 1);
    }
    if (input.selfHit) { input.selfHit = false; world.damage(player, 1000, null, 'taken'); }

    // --- команды и действия всех бойцов ---
    for (const f of fighters) {
      if (!f.kit) continue;   // манекен
      f.cmd = f.brain ? f.brain.think(dt, world) : playerCommand();
      act(f, f.cmd, dt);
    }

    // --- столкновения, скорость, шаг ---
    separate();
    for (const f of fighters) if (f.alive && !f.grabbedBy) resolveCollisions(f.pos, f.radius);
    for (const f of fighters) {
      if (!f.kit) continue;
      f.stride += f.before.distanceTo(f.pos) * f.hero.stride / (f.kit.speedMul > 1.3 ? 1.22 : 1);
      // сглаженная скорость — боты по ней стреляют с упреждением
      const k = Math.min(1, dt * 10);
      f.vel.x += ((f.pos.x - f.before.x) / Math.max(dt, 1e-4) - f.vel.x) * k;
      f.vel.z += ((f.pos.z - f.before.z) / Math.max(dt, 1e-4) - f.vel.z) * k;
    }

    projectiles.update(dt, world);
    fx.update(dt);

    // --- модели, смерти и возрождения ---
    for (const f of fighters) {
      if (f.kit) f.model.animate({ t, stride: f.stride, moving: f.moving, ...f.kit.pose() });
      else f.model.animate({ t });
      f.updateView(dt);
      const was = f.wasAlive ?? true;
      if (f.alive !== was) {
        sound.play(f.alive ? 'respawn' : 'death');
        // очко команде того, кто добил
        if (!f.alive && f.lastHitBy && f.lastHitBy.team !== f.team) score[f.lastHitBy.team] += 1;
      }
      f.wasAlive = f.alive;
    }

    // --- прицел игрока на земле ---
    const kit = player.kit;
    const aDir = player.alive && !player.brain ? player.cmd?.aimDir : null;
    if (aDir) aim.showAttack(kit.attackShape(), player.pos, Math.atan2(aDir.x, aDir.z));
    else aim.hideAttack();

    // зона ульты, которая действует сейчас (струя Смитаны)
    const area = player.alive ? kit.activeArea?.() : null;
    if (area) aim.showArea(area, player.pos, player.facing);
    else aim.hideArea();

    if (kit.ultAim === 'drag' && input.ultAim?.active && player.alive) {
      const p = ultPoint(player, input.ultAim.dx, input.ultAim.dy);
      aim.showUlt(kit.ultShape, player.pos, Math.atan2(p.x - player.pos.x, p.z - player.pos.z), p);
    } else aim.hideUlt();

    updateCamera(dt);
    overlay.update(dt, camera, fighters);

    // --- HUD: ~10 раз в секунду и только при изменениях ---
    hudAcc += dt;
    if (hudAcc > 0.1) {
      hudAcc = 0;
      const k = kit.hud();
      const rival = fighters.find((f) => f.team !== player.team);
      const hud = {
        ...k,
        ultCd: Math.ceil(k.ultCd * 10) / 10,
        special: k.combo >= 2,
        ultAim: kit.ultAim,
        dead: !player.alive,
        respawnIn: Math.ceil(player.respawnIn),
        score: { me: score.blue, rival: score.red, rivalName: rival?.name ?? '', rivalHero: rival?.hero?.name ?? '' },
      };
      const key = JSON.stringify(hud);
      if (key !== lastHud) { lastHud = key; onHud?.(hud); }
    }
  };

  const loop = () => {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    for (let i = 0; i < (options.fast ?? 1); i++) step(dt, clock.elapsedTime + i * dt);
    renderer.render(scene, camera);
  };
  loop();

  return {
    fighters,
    hero,
    score,
    world,
    projectiles: projectiles.list,
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      overlay.dispose();
      sound.stopAll();
      projectiles.clear();
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
      renderer.dispose();
      dom.remove();
    },
  };
}
