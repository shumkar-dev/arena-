import { ARENA } from '../game/arena.js';
import { createFighter } from '../game/fighter.js';
import { createBottle } from '../characters/bottle.js';
import { heroById } from '../heroes/index.js';
import { randomHeroId, botNames } from './common.js';

// ============================================================
// 2 НА 2 — «СУЛТАН ЧАЙ». Ты и бот-союзник против двух ботов.
// На базе каждой команды стоят большие бутылки «Султан чая».
// Кто первым разобьёт все бутылки врага — победил.
// На карте лежат сигареты-усилители. Аптечек нет.
// Карта — дорога с укрытиями, базы на концах.
// ============================================================

const BOTTLE_HP = 6000;
const BOTTLE_X = 1.7;                  // бутылки стоят парой по бокам от центра базы
const BOTTLE_Z = ARENA.halfL - 1.6;
const TEAMS = ['blue', 'red'];

// сигареты: по бокам от центра и у каждой базы, симметрично
const CIGS = [[-6.5, 0], [6.5, 0], [-8.5, 8.5], [8.5, -8.5]];

export default {
  id: 'teams',
  order: 2,
  name: '2 на 2',
  title: 'Султан чай',
  about: 'Ты и бот-союзник против двух ботов. Разбей бутылки «Султан чая» на базе врага первым. На карте — сигареты-усилители.',
  icon: '🍾',
  map: 'road',

  setup(match, { heroId, playerName, botNames: preferred }) {
    const names = botNames(3, preferred);
    const south = (x) => ({ x, z: ARENA.halfL - 4, facing: Math.PI });
    const north = (x) => ({ x, z: -ARENA.halfL + 4, facing: 0 });

    match.addHero(heroId, { name: playerName ?? heroById(heroId).name, team: 'blue', control: 'local', side: 'self', spawn: south(-2.5) });
    const ally = match.addHero(randomHeroId(), { name: names[0], team: 'blue', control: 'bot', side: 'ally', spawn: south(2.5) });
    ally.botRole = 'defend';   // союзник сторожит, ты нападаешь (или наоборот — как пойдёт)
    const e1 = match.addHero(randomHeroId(), { name: names[1], team: 'red', control: 'bot', side: 'enemy', spawn: north(-2.5) });
    const e2 = match.addHero(randomHeroId(), { name: names[2], team: 'red', control: 'bot', side: 'enemy', spawn: north(2.5) });
    e1.botRole = 'attack';
    e2.botRole = 'defend';

    for (const team of TEAMS) {
      const z = team === 'blue' ? BOTTLE_Z : -BOTTLE_Z;
      for (const x of [-BOTTLE_X, BOTTLE_X]) {
        const b = createFighter({
          name: 'Султан чай', team, model: createBottle(team), maxHp: BOTTLE_HP,
          spawn: { x, z, facing: team === 'blue' ? Math.PI : 0 }, radius: 0.85, headY: 3.9,
          side: team === 'blue' ? 'ally' : 'enemy', respawns: false,
        });
        b.isObjective = true;
        match.addObject(b);
      }
    }
    for (const [x, z] of CIGS) match.addPickup('cig', x, z, 15);
  },

  onDeath(match, victim) {
    if (!victim.isObjective) return;
    // бутылка разбилась: брызги чая и звон стекла
    match.world.fx.explosion(victim.pos.x, victim.pos.z, 1.8, 0xc07a2a);
    match.world.sfx('glass');
  },

  update(match) {
    const left = (team) => match.fighters.filter((f) => f.isObjective && f.team === team && f.alive).length;
    const lost = TEAMS.find((t) => left(t) === 0);
    if (!lost) return;
    const winner = TEAMS.find((t) => t !== lost);
    match.finish({
      winners: [winner],
      places: match.fighters.filter((f) => f.kit).map((f) => ({ f, place: f.team === winner ? 1 : 2 })),
      reason: `Бутылки: ${left('blue')} : ${left('red')}`,
    });
  },

  hud(match, me) {
    const hpOf = (team) => {
      const bs = match.fighters.filter((f) => f.isObjective && f.team === team);
      const sum = bs.reduce((a, b) => a + Math.max(0, b.hp), 0);
      return `${Math.ceil((sum / (bs.length * BOTTLE_HP)) * 100)}%`;
    };
    const rival = me.team === 'blue' ? 'red' : 'blue';
    return {
      score: [
        { value: hpOf(me.team), side: 'self', icon: '🍾' },
        { value: hpOf(rival), side: 'enemy', icon: '🍾', sep: '·' },
      ],
      goal: 'Разбей бутылки врага',
    };
  },
};
