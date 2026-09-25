import * as THREE from 'three';
import { buildArena, resolveCollisions, ARENA } from './arena.js';
import { createDummy } from '../characters/dummy.js';
import { createFighter } from './fighter.js';
import { heroById } from './heroes.js';
import { createOverlay } from './overlay.js';
import { createProjectiles, nearestEnemy } from './combat.js';
import { createEffects } from './effects.js';

// ============================================================
// ИГРОВОЙ ЦИКЛ — вне React, чтобы не пересоздавать сцену на каждый рендер.
// React-интерфейс пишет в input и читает состояние через onHud.
// ============================================================

const PLAYER_SPAWN = { x: 0, z: ARENA.halfL - 3, facing: Math.PI };   // смотрит на север (−Z)
const DUMMY_SPAWN = { x: -2.2, z: 7.5, facing: 0 };

const CAM_OFFSET = new THREE.Vector3(0, 14.5, 9.5);

export function createGame(mount, input, onHud, heroId) {
  const hero = heroById(heroId);

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

  // ---- бойцы ----
  const player = createFighter({ name: hero.name, team: 'blue', model: hero.createModel(), maxHp: hero.stats.maxHp, spawn: PLAYER_SPAWN });
  const kit = hero.createKit(player);
  player.stride = 0;
  player.moving = false;

  const dummy = createFighter({ name: 'Манекен', team: 'red', model: createDummy(), maxHp: 4000, spawn: DUMMY_SPAWN, radius: 0.55, headY: 2.75 });
  dummy.isStatic = true;

  const fighters = [player, dummy];
  for (const f of fighters) f.addTo(scene);

  const overlay = createOverlay(mount);
  const projectiles = createProjectiles(scene);
  const fx = createEffects(scene);

  const world = {
    fighters,
    projectiles,
    fx,
    damage(target, amount, from, kind) {
      const dealt = target.takeDamage(amount, from);
      if (dealt > 0) overlay.spawnNumber(target, dealt, target === player ? 'taken' : kind);
      return dealt;
    },
    say(f, text) { overlay.spawnNumber(f, text, 'text'); },
  };

  // ---- круги на земле: прицел ульты, дальность ульты, зона вращения ----
  const groundRing = (color, opacity) => {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1, 48),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.06;
    m.visible = false;
    scene.add(m);
    return m;
  };
  const aimRing = groundRing(0xffc23a, 0.9);
  const aimFill = new THREE.Mesh(
    new THREE.CircleGeometry(1, 40),
    new THREE.MeshBasicMaterial({ color: 0xffc23a, transparent: true, opacity: 0.22, depthWrite: false })
  );
  aimFill.rotation.x = -Math.PI / 2;
  aimFill.position.y = 0.055;
  aimFill.visible = false;
  scene.add(aimFill);
  const rangeRing = groundRing(0xffffff, 0.35);
  const auraRing = groundRing(0xff5a5f, 0.7);

  // точка ульты по оттяжке кнопки: (dx, dy) — вектор −1..1, экранный низ = +Z.
  // короткое касание без оттяжки — в ближайшего врага в радиусе, иначе перед собой
  const ultPoint = (dx, dy) => {
    const mag = Math.hypot(dx, dy);
    if (mag < 0.2) {
      const tgt = nearestEnemy(player, world, kit.ultRange);
      if (tgt) return { x: tgt.pos.x, z: tgt.pos.z };
      const r = kit.ultRange * 0.5;
      return { x: player.pos.x + Math.sin(player.facing) * r, z: player.pos.z + Math.cos(player.facing) * r };
    }
    const k = Math.min(1, mag) / mag;
    return { x: player.pos.x + dx * k * kit.ultRange, z: player.pos.z + dy * k * kit.ultRange };
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
    // --- кнопки ---
    if (input.attack) { input.attack = false; kit.attack(); }
    if (input.ult) {
      // тап по ульте (или K на клавиатуре); прицельной ульте — автоцель
      input.ult = false;
      kit.ult(kit.ultAim === 'drag' ? ultPoint(0, 0) : null, world);
    }
    if (input.ultFire) {
      const { dx, dy } = input.ultFire;
      input.ultFire = null;
      kit.ult(ultPoint(dx, dy), world);
    }
    if (input.selfHit) { input.selfHit = false; world.damage(player, 1000, null, 'taken'); }

    // --- движение игрока ---
    let mx = input.moveX, mz = input.moveY;
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }
    const mag = Math.min(1, len);

    player.moving = mag > 0.12 && player.canAct() && !kit.busy;
    const before = player.pos.clone();
    if (player.moving) {
      const speed = hero.stats.speed * kit.speedMul * player.moveMul();
      player.pos.x += mx * speed * mag * dt;
      player.pos.z += mz * speed * mag * dt;
      // плавный поворот к направлению движения
      const d = Math.atan2(Math.sin(Math.atan2(mx, mz) - player.facing), Math.cos(Math.atan2(mx, mz) - player.facing));
      player.facing += d * Math.min(1, dt * 14);
    }

    kit.update(dt, world);
    if (kit.forcedMoving != null) player.moving = kit.forcedMoving;

    // --- столкновения ---
    separate();
    for (const f of fighters) if (f.alive && !f.grabbedBy) resolveCollisions(f.pos, f.radius);
    player.stride += before.distanceTo(player.pos) * hero.stride / (kit.speedMul > 1.3 ? 1.22 : 1);

    projectiles.update(dt, world);
    fx.update(dt);

    // --- модели ---
    player.model.animate({ t, stride: player.stride, moving: player.moving, ...kit.pose() });
    dummy.model.animate({ t });
    for (const f of fighters) f.updateView(dt);

    // --- круги на земле ---
    const aiming = kit.ultAim === 'drag' && input.ultAim?.active && player.alive;
    aimRing.visible = aimFill.visible = rangeRing.visible = !!aiming;
    if (aiming) {
      const p = ultPoint(input.ultAim.dx, input.ultAim.dy);
      aimRing.position.set(p.x, 0.06, p.z);
      aimFill.position.set(p.x, 0.055, p.z);
      aimRing.scale.setScalar(kit.ultRadius);
      aimFill.scale.setScalar(kit.ultRadius);
      rangeRing.position.set(player.pos.x, 0.06, player.pos.z);
      rangeRing.scale.setScalar(kit.ultRange);
    }
    const aura = player.alive ? kit.aura ?? 0 : 0;
    auraRing.visible = aura > 0;
    if (aura > 0) {
      auraRing.position.set(player.pos.x, 0.06, player.pos.z);
      auraRing.scale.setScalar(aura);
      auraRing.rotation.z = t * 4;
    }

    updateCamera(dt);
    overlay.update(dt, camera, fighters);

    // --- HUD: ~10 раз в секунду и только при изменениях ---
    hudAcc += dt;
    if (hudAcc > 0.1) {
      hudAcc = 0;
      const k = kit.hud();
      const hud = {
        ...k,
        ultCd: Math.ceil(k.ultCd * 10) / 10,
        special: k.combo >= 2,
        ultAim: kit.ultAim,
        dead: !player.alive,
        respawnIn: Math.ceil(player.respawnIn),
      };
      const key = JSON.stringify(hud);
      if (key !== lastHud) { lastHud = key; onHud?.(hud); }
    }
  };

  const loop = () => {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    step(dt, clock.elapsedTime);
    renderer.render(scene, camera);
  };
  loop();

  return {
    fighters,
    hero,
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      overlay.dispose();
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
