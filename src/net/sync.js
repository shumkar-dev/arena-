import { resolveCollisions } from '../game/arena.js';
import { createRemoteController } from '../game/controllers.js';
import { encodeCmd, applyFighterDiff, unpackFighter } from './protocol.js';

// ============================================================
// СИНХРОНИЗАЦИЯ С СЕРВЕРОМ — для сетевого матча на устройстве.
//
// Бой считает сервер. Устройство считает свою копию матча только ради картинки
// (анимации ударов, снаряды, эффекты, звуки) и подстраивает её под снимки:
//   • ХП, смерти, возрождения, статусы, захват, счёт, предметы на карте — из снимка как есть;
//   • урон на устройстве — только вспышка, цифры урона приходят с сервера;
//   • остальные (игроки, боты, прохожие) рисуются с задержкой INTERP между двумя снимками (интерполяция) —
//     плавно, даже если снимки приходят неровно;
//   • свой боец двигается сразу по джойстику (предсказание), а расхождение
//     с сервером плавно убирается (сверка по номеру команды).
//
// Трафик: снимки 15 раз в секунду и только изменения (protocol.js); команды — при изменении
// джойстика, но не чаще 20 и не реже 10 раз в секунду. Пришло несколько снимков разом
// (связь подвисла) — изменения применяются все, а рисуем по самому свежему: старые пропускаем.
// ============================================================

const INTERP = 0.15;         // на сколько секунд в прошлом рисуем остальных (снимки идут раз в 67 мс)
const SEND_MIN = 0.05;        // команды не чаще 20 раз в секунду…
const SEND_MAX = 0.1;        // …и не реже, чтобы сервер знал, какие снимки дошли
const SNAP_DIST = 2.5;       // расхождение больше — прыгаем сразу, меньше — плавно
const CORR_RATE = 10;        // скорость плавной поправки, 1/с

const lerpAngle = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;
const vecOf = (v) => (v ? { x: v[0], z: v[1] } : null);

export function createNetSync({ match, player, net }) {
  const { fighters, world } = match;
  const me = fighters.indexOf(player);

  // урон считает сервер: здесь попадание — только вспышка и отшатывание
  world.damage = (target, amount, from) => {
    if (!target.alive) return 0;
    target.flash = 1;
    target.flinch = 1;
    if (from) {
      target.hitDir.set(target.pos.x - from.pos.x, target.pos.z - from.pos.z);
      if (target.hitDir.lengthSq() < 1e-6) target.hitDir.set(0, 1);
      target.hitDir.normalize();
    }
    return 0;
  };
  world.heal = () => {};
  // предметы подбирает сервер: здесь только показываем, какие лежат (pk в снимке)
  world.pickups.update = () => {};
  for (const f of fighters) f.netClient = true;

  const remotes = new Map();
  for (const f of fighters) if (f !== player && f.kit) remotes.set(f, createRemoteController());

  const packed = [];           // состояние бойцов из снимков (компактные массивы, по изменениям)
  const buffer = [];           // снимки для интерполяции: { tm, f }
  let offset = null;           // время сервера − время устройства, с
  let seq = 0;
  const hist = [];             // предсказанные позиции своего бойца: { seq, x, z }
  const corr = { x: 0, z: 0 }; // ещё не применённая поправка

  const now = () => performance.now() / 1000;

  const applyState = (f, s) => {
    f.hp = s.hp;
    if (f.kit) f.kills = s.k ?? 0;
    f.effects = {};
    for (const k in s.e ?? {}) f.effects[k] = { ...s.e[k] };
    f.grabbedBy = s.g >= 0 ? fighters[s.g] : null;
    if (f.grabbedBy) f.lift = s.l ?? 0;

    if (s.al && !f.alive) {
      f.respawn();
      f.pos.set(s.x, 0, s.z);
      f.facing = s.fa;
      if (f === player) { hist.length = 0; corr.x = corr.z = 0; }
    } else if (!s.al && f.alive) {
      f.alive = false;
      f.hp = 0;
      f.deathT = 0;
      f.grabbedBy = null;
      f.lift = 0;
      f.effects = {};
    }
    if (!f.alive) f.respawnIn = s.rs < 0 ? Infinity : s.rs;

    const ctl = remotes.get(f);
    if (ctl && s.m) ctl.move = { moveX: s.m[0], moveZ: s.m[1], aimDir: vecOf(s.ad) };
  };

  // свой боец: сравнить позицию сервера с тем, что мы предсказали для той же команды
  const reconcile = (s, ack) => {
    if (!s.al || s.g >= 0 || !player.alive) {
      player.pos.x = s.x; player.pos.z = s.z;
      hist.length = 0; corr.x = corr.z = 0;
      return;
    }
    while (hist.length && hist[0].seq < ack) hist.shift();
    const h = hist[0];
    if (!h || h.seq !== ack) return;
    const ex = s.x - h.x, ez = s.z - h.z;
    if (Math.hypot(ex, ez) > SNAP_DIST) {
      player.pos.x += ex; player.pos.z += ez;
      for (const q of hist) { q.x += ex; q.z += ez; }
      corr.x = corr.z = 0;
    } else {
      corr.x = ex; corr.z = ez;
    }
  };

  const onSnap = ([, , tmMs, ack, deltas, ev, extra]) => {
    const tm = tmMs / 1000;
    // часы сервера: свежий снимок сразу сдвигает оценку вперёд, запоздавшие — едва-едва.
    // Так после затора рисуем по свежим данным, а не догоняем старые.
    const target = tm - now();
    offset = offset == null || target > offset ? target : offset + (target - offset) * 0.02;

    for (const d of deltas) applyFighterDiff(packed[d[0]] ??= [], d[1], d.slice(2));
    const states = fighters.map((_, i) => (packed[i] ? unpackFighter(packed[i]) : null));
    buffer.push({ tm, f: states });
    while (buffer.length > 2 && buffer[1].tm < tm - 1) buffer.shift();

    states.forEach((s, i) => { if (s) applyState(fighters[i], s); });
    if (extra?.sc) match.state.kills = { ...extra.sc };
    if (extra?.pk) world.pickups.spots.forEach((sp, i) => { sp.active = extra.pk[i] === '1'; });

    for (const e of ev) {
      const f = fighters[e[1]];
      if (!f) continue;
      if (e[0] === 'd') {
        f.flash = 1;
        if (f.walk) f.scaredT = 2.2;    // прохожий — вздрагивает и убегает (как на сервере)
        match.events.push({ type: 'damage', target: f, amount: e[2], kind: e[3] });
      }
      else if (e[0] === 'h') match.events.push({ type: 'heal', target: f, amount: e[2] });
      else if (e[0] === 'say') match.events.push({ type: 'say', f, text: e[2] });
      else if (e[0] === 'a' && f !== player) remotes.get(f)?.queue.push({ attack: e.length > 2 ? { x: Math.sin(e[2] / 100), z: Math.cos(e[2] / 100) } : null });
      else if (e[0] === 'u' && f !== player) remotes.get(f)?.queue.push({ ult: e.length > 2 ? { x: e[2] / 100, z: e[3] / 100 } : null });
    }

    if (me >= 0 && states[me]) reconcile(states[me], ack);
  };

  // итог решает сервер: победители и места героев (по порядку мест)
  const onEnd = (m) => {
    const heroes = fighters.filter((f) => f.kit);
    match.finish({
      winners: m.winners,
      reason: m.reason,
      places: (m.res ?? []).map((r, i) => ({ f: heroes[i], place: r.place })).filter((p) => p.f),
    });
  };

  const offs = [net.on('s', onSnap), net.on('end', onEnd)];

  return {
    remotes,

    /** Обёртка над кнопками: команды — на сервер, с номером. Удар и ульта — сразу,
     *  движение — когда изменилось (не чаще SEND_MIN), иначе раз в SEND_MAX. */
    wrapLocal(base) {
      let lastSent = -1, lastKey = '';
      return {
        command(dt, w) {
          const cmd = base.command(dt, w);
          const t = now();
          const key = `${Math.round(cmd.moveX * 20)},${Math.round(cmd.moveZ * 20)},${cmd.aimDir ? Math.round(Math.atan2(cmd.aimDir.x, cmd.aimDir.z) * 20) : '-'}`;
          const oneShot = cmd.attack !== undefined || cmd.ult !== undefined;
          if (oneShot || (key !== lastKey && t - lastSent >= SEND_MIN) || t - lastSent >= SEND_MAX) {
            seq += 1;
            net.send(encodeCmd(cmd, seq, net.lastSnap));
            lastSent = t;
            lastKey = key;
          }
          return cmd;
        },
      };
    },

    /** После шага матча: поправка своего бойца и соперник по снимкам. */
    afterStep(dt) {
      if (player.alive && !player.grabbedBy) {
        const k = Math.min(1, dt * CORR_RATE);
        const cx = corr.x * k, cz = corr.z * k;
        corr.x -= cx; corr.z -= cz;
        player.pos.x += cx; player.pos.z += cz;
        for (const q of hist) { q.x += cx; q.z += cz; }
        resolveCollisions(player.pos, player.radius);
        hist.push({ seq, x: player.pos.x, z: player.pos.z });
        if (hist.length > 180) hist.shift();
      }

      if (!buffer.length || offset == null) return;
      const rt = now() + offset - INTERP;
      let a = buffer[0], b = buffer[buffer.length - 1];
      for (let i = 0; i < buffer.length - 1; i++) {
        if (buffer[i].tm <= rt && buffer[i + 1].tm >= rt) { a = buffer[i]; b = buffer[i + 1]; break; }
      }
      const k = b.tm > a.tm ? Math.max(0, Math.min(1, (rt - a.tm) / (b.tm - a.tm))) : 1;
      fighters.forEach((f, i) => {
        if (f === player || !f.alive) return;
        const sa = a.f[i], sb = b.f[i];
        if (!sa || !sb) return;
        f.pos.x = sa.x + (sb.x - sa.x) * k;
        f.pos.z = sa.z + (sb.z - sa.z) * k;
        f.facing = lerpAngle(sa.fa, sb.fa, k);
      });
    },

    dispose() { for (const off of offs) off(); },
  };
}
