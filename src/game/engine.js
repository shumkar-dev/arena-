import * as THREE from 'three';
import { buildArena, setMap, currentMap, ARENA } from './arena.js';
import { mapById } from '../maps/index.js';
import { createMatch } from './match.js';
import { modeById } from '../modes/index.js';
import { createLocalController, createBotController, ultPoint } from './controllers.js';
import { createOnlineMode } from '../net/protocol.js';
import { createNetSync } from '../net/sync.js';
import { matchParticipants } from './results.js';
import { createOverlay } from './overlay.js';
import { createEffects } from './effects.js';
import { createAim } from './aim.js';
import { sound } from './sound.js';
import { voice } from './voice.js';

// ============================================================
// ДВИЖОК — отображение матча: сцена, камера, прицел, полоски ХП, звук, HUD.
// Сам бой считает match.js, правила — режим (src/modes), бойцами управляют
// контроллеры (controllers.js). React-интерфейс пишет в input и читает onHud.
//
// options: { modeId, heroId, botHeroId, playerName, botNames, botOptions, autoplay, fast, quality }
//   botNames   — имена ботов (соперники из рейтинга), botOptions — { skill } мастерство ботов
//   autoplay — локальным бойцом тоже управляет бот (автотесты, прогон баланса)
//   fast     — шагов симуляции на кадр (ускоренная прокрутка для автотестов)
//   quality  — 'high' (тени, чёткость) или 'low' (для слабых телефонов)
//   net      — сетевой матч: { conn, modeId, roster, you } (src/net); бой считает сервер
// ============================================================

const CAM_OFFSET = new THREE.Vector3(0, 14.5, 9.5);
const END_DELAY = 1.4;   // сколько секунд после победы ещё видно арену, прежде чем покажется итог

export function createGame(mount, input, onHud, options = {}) {
  const net = options.net ?? null;
  const mode = net ? createOnlineMode({ modeId: net.modeId, roster: net.roster, you: net.you }) : modeById(options.modeId);
  // игрок, который начинает на северной половине (сетевой матч), смотрит на арену
  // с другой стороны — у всех «вверх» к врагу; решается после расстановки бойцов
  let flip = false, fs = 1;
  const camOffset = CAM_OFFSET.clone();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fb4c8);
  scene.fog = new THREE.Fog(0x9fb4c8, 30, 60);

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  const low = options.quality === 'low';
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, low ? 1 : 1.75));
  renderer.shadowMap.enabled = !low;
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

  setMap(mapById(mode.map));
  buildArena(scene);

  const overlay = createOverlay(mount);
  const fx = createEffects(scene);
  const aim = createAim(scene);

  // ---- матч и контроллеры ----
  const match = createMatch({ scene, fx, mode, options });
  mode.setup(match, { heroId: options.heroId, botHeroId: options.botHeroId, playerName: options.playerName, botNames: options.botNames });

  const player = match.fighters.find((f) => f.control === 'local') ?? match.fighters[0];
  if (net && player.spawn.z < 0) { flip = true; fs = -1; camOffset.setZ(-CAM_OFFSET.z); }
  const sync = net ? createNetSync({ match, player, net: net.conn }) : null;
  const controllers = new Map();
  for (const f of match.fighters) {
    if (!f.kit) continue;
    if (f.control === 'local' && sync) controllers.set(f, sync.wrapLocal(createLocalController(f, input, { flip })));
    else if (f.control === 'local' && !options.autoplay) controllers.set(f, createLocalController(f, input));
    else if (f.control === 'local' || f.control === 'bot') controllers.set(f, createBotController(f, options.botOptions));
    else if (f.control === 'remote' && sync) controllers.set(f, sync.remotes.get(f));
  }

  // ---- реплики своего героя (voice.js): старт, изредка удар, ульта, боль, убийство, смерть, победа ----
  const talk = !options.autoplay;
  const hero = player.hero;
  if (talk) voice.preload(hero);
  const vs = { started: false, attacks: 0, nextAttack: 3, lastHurt: -9, kills: player.kills, alive: true, ultCd: 0 };
  const voiceHooks = () => {
    if (!talk || match.result) return;
    const t = match.world.time;
    if (!vs.started && t > 0.6) { vs.started = true; voice.play(hero, 'start'); }
    // удар — не каждый, а примерно раз в 3–4
    if (player.cmd?.attack !== undefined && player.alive && ++vs.attacks >= vs.nextAttack) {
      vs.attacks = 0;
      vs.nextAttack = 3 + (Math.random() < 0.5 ? 0 : 1);
      voice.play(hero, 'attack');
    }
    const cd = player.kit.hud().ultCd;
    if (cd > vs.ultCd + 1) voice.play(hero, 'ult');     // перезарядка ульты началась — ульта сработала
    vs.ultCd = cd;
    if (player.kills > vs.kills) voice.play(hero, 'kill');
    vs.kills = player.kills;
    if (vs.alive && !player.alive) voice.play(hero, 'death');
    vs.alive = player.alive;
  };

  // ---- события матча → экран и звук ----
  const handleEvents = () => {
    for (const e of match.events) {
      if (e.type === 'damage') {
        overlay.spawnNumber(e.target, e.amount, e.target === player ? 'taken' : e.kind);
        if (e.target === player) {
          sound.play('hurt');
          // «больно» — не чаще раза в 4 с
          if (talk && player.alive && match.world.time - vs.lastHurt > 4) { vs.lastHurt = match.world.time; voice.play(hero, 'hurt'); }
        }
      } else if (e.type === 'heal') overlay.spawnNumber(e.target, `+${e.amount}`, 'heal');
      else if (e.type === 'say') overlay.spawnNumber(e.f, e.text, 'text');
      else if (e.type === 'sfx') sound.play(e.name, e.opts);
      else if (e.type === 'death') sound.play('death');
      else if (e.type === 'respawn') sound.play('respawn');
      else if (e.type === 'finish') {
        const win = e.result.winners.includes(player.team);
        sound.play(win ? 'victory' : 'defeat');
        if (win && talk) setTimeout(() => voice.play(hero, 'win'), 500);
      }
    }
    match.events.length = 0;
  };

  const camTarget = new THREE.Vector3();
  const updateCamera = (dt) => {
    // после смерти без возрождения камера следит за тем, кто ещё жив
    const follow = player.alive || player.respawns ? player : match.fighters.find((f) => f.kit && f.alive) ?? player;
    const tx = follow.pos.x * 0.55;
    const tz = flip
      ? Math.max(-ARENA.halfL + 4, Math.min(ARENA.halfL - 6, follow.pos.z))
      : Math.max(-ARENA.halfL + 6, Math.min(ARENA.halfL - 4, follow.pos.z));
    const k = dt < 0 ? 1 : 1 - Math.exp(-dt * 6);
    camTarget.x += (tx - camTarget.x) * k;
    camTarget.z += (tz - camTarget.z) * k;
    camera.position.copy(camTarget).add(camOffset);
    camera.lookAt(camTarget.x, 0, camTarget.z - 1.5 * fs);
    sun.position.set(camTarget.x + 8, 20, camTarget.z + 6);
    sun.target.position.set(camTarget.x, 0, camTarget.z);
  };
  updateCamera(-1);

  const clock = new THREE.Clock();
  let raf = 0, hudAcc = 0, lastHud = '';

  const step = (dt, t) => {
    if (input.selfHit && !net) { input.selfHit = false; match.world.damage(player, 1000, null, 'taken'); }

    // после конца матча ещё немного показываем арену, потом замираем
    const frozen = match.result && match.world.time - match.result.at > END_DELAY;
    if (!frozen) match.step(dt, controllers);
    sync?.afterStep(dt);
    voiceHooks();
    handleEvents();
    fx.update(dt);
    match.world.pickups.animate(t);

    // --- модели ---
    for (const f of match.fighters) {
      if (f.kit) f.model.animate({ t, stride: f.stride, moving: f.moving, ...f.kit.pose() });
      else f.model.animate?.({ t, stride: f.stride ?? 0, moving: !!f.moving, scared: f.scaredT > 0 });
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
      const p = ultPoint(player, match.world, input.ultAim.dx * fs, input.ultAim.dy * fs);
      aim.showUlt(kit.ultShape, player.pos, Math.atan2(p.x - player.pos.x, p.z - player.pos.z), p);
    } else aim.hideUlt();

    updateCamera(dt);
    // высокие кроны между камерой (она южнее) и героем — полупрозрачные
    for (const o of currentMap().occluders ?? []) {
      const p = o.group.position;
      const ahead = (p.z - player.pos.z) * fs;    // насколько крона ближе к камере, чем герой
      const hide = Math.abs(p.x - player.pos.x) < 2.2 && ahead > -0.5 && ahead < 5;
      const target = hide ? 0.3 : 1;
      for (const m of o.mats) m.opacity += (target - m.opacity) * Math.min(1, dt * 8);
    }
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
        ping: net ? net.conn.ping : null,
        result: res && {
          modeId: mode.id,
          win: res.winners.includes(player.team),
          place: res.places?.find((p) => p.f === player)?.place ?? null,
          showPlace: !!mode.showPlace,
          kills: player.kills,
          // первое место по убийствам среди героев (для награды в «каждый сам за себя»)
          topKills: player.kills > 0 && match.fighters.filter((f) => f.kit && f !== player).every((f) => f.kills <= player.kills),
          reason: res.reason ?? '',
          participants: participants(res),
        },
      };
      const key = JSON.stringify(hud);
      if (key !== lastHud) { lastHud = key; onHud?.(hud); }
    }
  };

  // все герои матча с их итогом — по нему рейтинг раздаёт уток и ботам
  const participants = (res) => matchParticipants(match, res).map(({ f, ...p }) => ({
    ...p, isPlayer: f === player, isBot: f.control === 'bot',
  }));

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
      sync?.dispose();
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
