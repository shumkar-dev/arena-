import * as THREE from 'three';
import { buildArena, resolveCollisions, ARENA } from './arena.js';
import { createShaba } from '../characters/shaba.js';
import { createDummy } from '../characters/dummy.js';
import { createFighter } from './fighter.js';
import { createShabaKit, SHABA } from './kits/shaba.js';
import { createOverlay } from './overlay.js';

// ============================================================
// ИГРОВОЙ ЦИКЛ — вне React, чтобы не пересоздавать сцену на каждый рендер.
// React-интерфейс пишет в input и читает состояние через onHud.
// ============================================================

const PLAYER_SPAWN = { x: 0, z: ARENA.halfL - 3, facing: Math.PI };   // смотрит на север (−Z)
const DUMMY_SPAWN = { x: -2.2, z: 7.5, facing: 0 };

const CAM_OFFSET = new THREE.Vector3(0, 14.5, 9.5);

export function createGame(mount, input, onHud) {
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
  const player = createFighter({ name: 'Шаба', team: 'blue', model: createShaba(), maxHp: SHABA.maxHp, spawn: PLAYER_SPAWN });
  const kit = createShabaKit(player);
  player.stride = 0;
  player.moving = false;

  const dummy = createFighter({ name: 'Манекен', team: 'red', model: createDummy(), maxHp: 4000, spawn: DUMMY_SPAWN, radius: 0.55, headY: 2.75 });
  dummy.isStatic = true;

  const fighters = [player, dummy];
  for (const f of fighters) f.addTo(scene);

  const overlay = createOverlay(mount);

  const world = {
    fighters,
    damage(target, amount, from, kind) {
      const dealt = target.takeDamage(amount, from);
      if (dealt > 0) overlay.spawnNumber(target, dealt, target === player ? 'taken' : kind);
    },
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
    if (input.ult) { input.ult = false; kit.ult(); }
    if (input.selfHit) { input.selfHit = false; world.damage(player, 1000, null, 'taken'); }

    // --- движение игрока ---
    let mx = input.moveX, mz = input.moveY;
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }
    const mag = Math.min(1, len);

    player.moving = mag > 0.12 && player.canAct() && !kit.busy;
    const before = player.pos.clone();
    if (player.moving) {
      const speed = SHABA.speed * kit.speedMul;
      player.pos.x += mx * speed * mag * dt;
      player.pos.z += mz * speed * mag * dt;
      // плавный поворот к направлению движения
      const d = Math.atan2(Math.sin(Math.atan2(mx, mz) - player.facing), Math.cos(Math.atan2(mx, mz) - player.facing));
      player.facing += d * Math.min(1, dt * 14);
    }

    kit.update(dt, world);

    // --- столкновения ---
    separate();
    for (const f of fighters) if (f.alive && !f.grabbedBy) resolveCollisions(f.pos, f.radius);
    player.stride += before.distanceTo(player.pos) * (kit.speedMul > 1 ? 1.35 : 1.65);

    // --- модели ---
    player.model.animate({ t, stride: player.stride, moving: player.moving, ...kit.pose() });
    dummy.model.animate({ t });
    for (const f of fighters) f.updateView(dt);

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
        dead: !player.alive,
        respawnIn: Math.ceil(player.respawnIn),
      };
      const key = `${hud.ultCd}|${hud.ultActive}|${hud.combo}|${hud.grabbing}|${hud.dead}|${hud.respawnIn}`;
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
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      overlay.dispose();
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
      renderer.dispose();
      dom.remove();
    },
  };
}
