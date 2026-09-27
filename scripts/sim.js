import * as THREE from 'three';
import { createMatch } from '../src/game/match.js';
import { setMap } from '../src/game/arena.js';
import { mapById, MAPS } from '../src/maps/index.js';
import { createBotController } from '../src/game/controllers.js';
import { HEROES } from '../src/heroes/index.js';
import { modeById } from '../src/modes/index.js';
import { createOnlineMode } from '../src/net/protocol.js';

// ============================================================
// ПРОГОН ДУЭЛЕЙ без картинки: боты одной силы, каждый герой против каждого,
// по N боёв (места меняются через раз). Тот же код боя, что у сервера.
//   npm run sim                 — все пары, 20 боёв на пару
//   npm run sim -- gorilla 40   — только пары с гориллой, 40 боёв
//   npm run sim -- sizes        — габариты моделей
//   npm run sim -- gaps         — узкие проходы для крупного героя
// ============================================================

const [only = null, nArg] = process.argv.slice(2);
const N = Number(nArg) || 20;
const DT = 1 / 30;
const MAX_T = 240;             // бой дольше 4 минут — ничья
const noop = new Proxy(function () {}, { get: () => noop, apply: () => noop });
const SKILL = { ultDelay: 0.3 };   // средний бот

// примерить другие числа, не меняя код: SIM_SET='{"gorilla":{"punchDamage":500}}' npm run sim -- gorilla
for (const [id, over] of Object.entries(JSON.parse(process.env.SIM_SET || '{}'))) {
  Object.assign(HEROES.find((h) => h.id === id).stats, over);
}

function duel(a, b) {
  const base = modeById('duel');
  setMap(mapById(base.map));
  const roster = [{ name: 'A', hero: a, bot: true }, { name: 'B', hero: b, bot: true }];
  const mode = createOnlineMode({ modeId: 'duel', roster });
  const m = createMatch({ scene: new THREE.Group(), fx: noop, mode });
  mode.setup(m, {});
  const heroes = m.fighters.filter((f) => f.kit);
  const ctl = new Map(heroes.map((f) => [f, createBotController(f, { skill: SKILL })]));
  while (!m.result && m.world.time < MAX_T) { m.step(DT, ctl); m.events.length = 0; }
  const w = m.result?.winners?.[0];
  return { win: w == null ? 0.5 : w === heroes[0].team ? 1 : 0, t: m.world.time };
}

// npm run sim -- sizes — габариты моделей героев (высота, ширина) и радиус хитбокса
if (only === 'sizes') {
  for (const h of HEROES) {
    const b = new THREE.Box3().setFromObject(h.createModel().root);
    const sz = b.getSize(new THREE.Vector3());
    console.log(`${h.id.padEnd(11)} высота ${sz.y.toFixed(2)}  ширина ${sz.x.toFixed(2)}  глубина ${sz.z.toFixed(2)}  радиус ${h.radius ?? 0.5}`);
  }
  process.exit(0);
}

// npm run sim -- gaps — проходы на картах, куда обычный герой пролезает, а крупный (горилла) — нет
if (only === 'gaps') {
  const big = Math.max(...HEROES.map((h) => h.radius ?? 0.5));
  for (const map of MAPS) {
    const { halfW, halfL } = map.size;
    const walls = [
      { minX: -halfW - 9, maxX: -halfW, minZ: -99, maxZ: 99 }, { minX: halfW, maxX: halfW + 9, minZ: -99, maxZ: 99 },
      { minX: -99, maxX: 99, minZ: -halfL - 9, maxZ: -halfL }, { minX: -99, maxX: 99, minZ: halfL, maxZ: halfL + 9 },
    ];
    const all = [...map.obstacles, ...walls];
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i], b = all[j];
        const gx = Math.max(0, a.minX - b.maxX, b.minX - a.maxX), gz = Math.max(0, a.minZ - b.maxZ, b.minZ - a.maxZ);
        const g = Math.hypot(gx, gz);
        if (g >= 1.0 && g < big * 2) console.log(`${map.id}: проход ${g.toFixed(2)} м между ${a.kind ?? 'стеной'} (${a.x ?? ''}, ${a.z ?? ''}) и ${b.kind ?? 'стеной'} (${b.x ?? ''}, ${b.z ?? ''})`);
      }
    }
  }
  console.log(`радиус крупнейшего героя ${big}, нужен проход ≥ ${(big * 2).toFixed(2)} м`);
  process.exit(0);
}

const ids = HEROES.map((h) => h.id);
const pairs = [];
for (let i = 0; i < ids.length; i++) {
  for (let j = i + 1; j < ids.length; j++) {
    const [a, b] = ids[j] === only ? [ids[j], ids[i]] : [ids[i], ids[j]];
    if (!only || a === only) pairs.push([a, b]);
  }
}
for (const [a, b] of pairs) {
  let wins = 0, time = 0;
  for (let i = 0; i < N; i++) {
    const r = i % 2 ? duel(b, a) : duel(a, b);
    wins += i % 2 ? 1 - r.win : r.win;
    time += r.t;
  }
  console.log(`${a.padEnd(11)} vs ${b.padEnd(11)} ${String(Math.round((wins / N) * 100)).padStart(3)}%   бой ~${Math.round(time / N)} с`);
}
