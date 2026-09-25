import * as THREE from 'three';
import { buildArena, ARENA } from './arena.js';
import { createMatch } from './match.js';
import { modeById } from '../modes/index.js';
import { createLocalController, createBotController, ultPoint } from './controllers.js';
import { createOverlay } from './overlay.js';
import { createEffects } from './effects.js';
import { createAim } from './aim.js';
import { sound } from './sound.js';

// ============================================================
// ДВИЖОК — отображение матча: сцена, камера, прицел, полоски ХП, звук, HUD.
// Сам бой считает match.js, правила — режим (src/modes), бойцами управляют
// контроллеры (controllers.js). React-интерфейс пишет в input и читает onHud.
//
// options: { modeId, heroId, botHeroId, playerName, autoplay, fast }
//   autoplay — локальным бойцом тоже управляет бот (автотесты, прогон баланса)
//   fast     — шагов симуляции на кадр (ускоренная прокрутка для автотестов)
// ============================================================

const CAM_OFFSET = new THREE.Vector3(0, 14.5, 9.5);
const END_DELAY = 1.4;   // сколько секунд после победы ещё видно арену, прежде чем покажется итог

export function createGame(mount, input, onHud, options = {}) {
  const mode = modeById(options.modeId);

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
  const fx = createEffects(scene);
  const aim = createAim(scene);

  // ---- матч и контроллеры ----
  const match = createMatch({ scene, fx, mode, options });
  mode.setup(match, { heroId: options.heroId, botHeroId: options.botHeroId, playerName: options.playerName });

  const player = match.fighters.find((f) => f.control === 'local') ?? match.fighters[0];
  const controllers = new Map();
  for (const f of match.fighters) {
    if (!f.kit) continue;
    if (f.control === 'local' && !options.autoplay) controllers.set(f, createLocalController(f, input));
    else if (f.control === 'local' || f.control === 'bot') controllers.set(f, createBotController(f, options.botOptions));
    // 'remote' — сюда встанет контроллер сетевого игрока
  }

  // ---- события матча → экран и звук ----
  const handleEvents = () => {
    for (const e of match.events) {
      if (e.type === 'damage') {
        overlay.spawnNumber(e.target, e.amount, e.target === player ? 'taken' : e.kind);
        if (e.target === player) sound.play('hurt');
      } else if (e.type === 'heal') overlay.spawnNumber(e.target, `+${e.amount}`, 'heal');
      else if (e.type === 'say') overlay.spawnNumber(e.f, e.text, 'text');
      else if (e.type === 'sfx') sound.play(e.name, e.opts);
      else if (e.type === 'death') sound.play('death');
      else if (e.type === 'respawn') sound.play('respawn');
      else if (e.type === 'finish') sound.play(e.result.winners.includes(player.team) ? 'victory' : 'defeat');
    }
    match.events.length = 0;
  };

  const camTarget = new THREE.Vector3();
  const updateCamera = (dt) => {
    // после смерти без возрождения камера следит за тем, кто ещё жив
    const follow = player.alive || player.respawns ? player : match.fighters.find((f) => f.kit && f.alive) ?? player;
    const tx = follow.pos.x * 0.55;
    const tz = Math.max(-ARENA.halfL + 6, Math.min(ARENA.halfL - 4, follow.pos.z));
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
    if (input.selfHit) { input.selfHit = false; match.world.damage(player, 1000, null, 'taken'); }

    // после конца матча ещё немного показываем арену, потом замираем
    const frozen = match.result && match.world.time - match.result.at > END_DELAY;
    if (!frozen) match.step(dt, controllers);
    handleEvents();
    fx.update(dt);
    match.world.pickups.animate(t);

    // --- модели ---
    for (const f of match.fighters) {
      if (f.kit) f.model.animate({ t, stride: f.stride, moving: f.moving, ...f.kit.pose() });
      else f.model.animate?.({ t });
      f.updateView(dt);
    }

    // --- прицел игрока на земле ---
    const kit = player.kit;
    const aDir = player.alive && !options.autoplay ? player.cmd?.aimDir : null;
    if (aDir) aim.showAttack(kit.attackShape(), player.pos, Math.atan2(aDir.x, aDir.z));
    else aim.hideAttack();

    // зона ульты, которая действует сейчас (струя Смитаны)
    const area = player.alive ? kit.activeArea?.() : null;
    if (area) aim.showArea(area, player.pos, player.facing);
    else aim.hideArea();

    if (kit.ultAim === 'drag' && input.ultAim?.active && player.alive) {
      const p = ultPoint(player, match.world, input.ultAim.dx, input.ultAim.dy);
      aim.showUlt(kit.ultShape, player.pos, Math.atan2(p.x - player.pos.x, p.z - player.pos.z), p);
    } else aim.hideUlt();

    updateCamera(dt);
    overlay.update(dt, camera, match.fighters);

    // --- HUD: ~10 раз в секунду и только при изменениях ---
    hudAcc += dt;
    if (hudAcc > 0.1) {
      hudAcc = 0;
      const k = kit.hud();
      const res = frozen ? match.result : null;
      const hud = {
        ...k,
        ultCd: Math.ceil(k.ultCd * 10) / 10,
        special: k.combo >= 2,
        ultAim: kit.ultAim,
        dead: !player.alive,
        respawnIn: Number.isFinite(player.respawnIn) ? Math.ceil(player.respawnIn) : null,
        mode: mode.hud?.(match, player) ?? null,
        result: res && {
          win: res.winners.includes(player.team),
          place: res.places?.find((p) => p.f === player)?.place ?? null,
          reason: res.reason ?? '',
        },
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
    match,
    fighters: match.fighters,
    world: match.world,
    projectiles: match.world.projectiles.list,
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      overlay.dispose();
      sound.stopAll();
      match.dispose();
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        for (const m of [].concat(o.material ?? [])) m.dispose();
      });
      renderer.dispose();
      dom.remove();
    },
  };
}
