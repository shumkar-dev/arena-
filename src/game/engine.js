import * as THREE from 'three';
import { buildArena, resolveCollisions, ARENA } from './arena.js';
import { createShaba } from '../characters/shaba.js';

// ============================================================
// ИГРОВОЙ ЦИКЛ — вне React, чтобы не пересоздавать сцену на каждый рендер.
// React-интерфейс пишет в input и читает состояние через onHud.
// ============================================================

export const TUNING = {
  speed: 5.5,          // ед/с
  radius: 0.5,         // радиус столкновений персонажа
  punchTime: 0.3,      // длительность удара, с
  punchCooldown: 0.45,
  ultDuration: 5,      // ульта Шабы: баран, 5 с
  ultCooldown: 20,     // все ульты — 20 с
  ultSpeedMul: 1.5,
};

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

  // ---- игрок ----
  const shaba = createShaba();
  scene.add(shaba.root);

  // тень-метка под игроком, как в Brawl Stars
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.62, 0.78, 32),
    new THREE.MeshBasicMaterial({ color: 0x3fd0ff, transparent: true, opacity: 0.85 })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;
  scene.add(ring);

  const player = {
    pos: new THREE.Vector3(0, 0, ARENA.halfL - 3),
    facing: Math.PI,        // смотрит на север (−Z)
    stride: 0,
    moving: false,
    punchT: -1,             // −1 — удара нет
    punchCd: 0,
    ultT: 0,                // осталось ульты
    ultCd: 0,               // осталось перезарядки
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

  const tryAttack = () => {
    if (player.punchCd > 0) return;
    player.punchT = 0;
    player.punchCd = TUNING.punchCooldown;
  };
  const tryUlt = () => {
    if (player.ultCd > 0) return;
    player.ultT = TUNING.ultDuration;
    player.ultCd = TUNING.ultCooldown;
  };

  const clock = new THREE.Clock();
  let raf = 0, hudAcc = 0, lastHud = '';

  const step = (dt, t) => {
    // --- кнопки ---
    if (input.attack) { input.attack = false; tryAttack(); }
    if (input.ult) { input.ult = false; tryUlt(); }

    // --- движение ---
    let mx = input.moveX, mz = input.moveY;
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }
    const mag = Math.min(1, len);
    const riding = player.ultT > 0;
    const speed = TUNING.speed * (riding ? TUNING.ultSpeedMul : 1);

    player.moving = mag > 0.12;
    if (player.moving) {
      const before = player.pos.clone();
      player.pos.x += mx * speed * mag * dt;
      player.pos.z += mz * speed * mag * dt;
      resolveCollisions(player.pos, TUNING.radius);
      const moved = before.distanceTo(player.pos);
      player.stride += moved * (riding ? 1.35 : 1.65);
      // плавный поворот к направлению движения
      const target = Math.atan2(mx, mz);
      let d = target - player.facing;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      player.facing += d * Math.min(1, dt * 14);
    }

    // --- таймеры ---
    player.punchCd = Math.max(0, player.punchCd - dt);
    player.ultCd = Math.max(0, player.ultCd - dt);
    player.ultT = Math.max(0, player.ultT - dt);
    if (player.punchT >= 0) {
      player.punchT += dt / TUNING.punchTime;
      if (player.punchT >= 1) player.punchT = -1;
    }

    // --- модель ---
    shaba.root.position.copy(player.pos);
    shaba.root.rotation.y = player.facing;
    shaba.animate({
      t,
      stride: player.stride,
      moving: player.moving,
      riding: player.ultT > 0,
      punch: player.punchT >= 0 ? player.punchT : null,
    });
    ring.position.x = player.pos.x;
    ring.position.z = player.pos.z;

    updateCamera(dt);

    // --- HUD: ~10 раз в секунду и только при изменениях ---
    hudAcc += dt;
    if (hudAcc > 0.1) {
      hudAcc = 0;
      const hud = {
        ultCd: Math.ceil(player.ultCd * 10) / 10,
        ultFrac: player.ultCd / TUNING.ultCooldown,
        ultActive: player.ultT > 0,
      };
      const key = `${hud.ultCd}|${hud.ultActive}`;
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
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
      renderer.dispose();
      dom.remove();
    },
  };
}
