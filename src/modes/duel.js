import { ARENA } from '../game/arena.js';
import { rosterOf, sideFor, creditKill } from './common.js';

// ============================================================
// 1 НА 1 — ДУЭЛЬ. Бой до 3 убийств, без аптечек и усилителей.
// Карта — дорога с укрытиями.
// ============================================================

const KILLS_TO_WIN = 3;
const TEAMS = ['blue', 'red'];

export default {
  id: 'duel',
  order: 1,
  name: '1 на 1',
  title: 'Дуэль',
  about: `Бой до ${KILLS_TO_WIN} убийств. Без аптечек и усилителей — чистая драка.`,
  icon: '⚔️',
  map: 'road',

  slots: 2,
  teamOf: (i) => TEAMS[i],

  // место 0 — синие на юге, место 1 — красные на севере
  setup(match, opts) {
    const { roster, you } = rosterOf(opts, 2, { botHeroId: opts.botHeroId });
    const spawns = [{ x: 0, z: ARENA.halfL - 3, facing: Math.PI }, { x: 0, z: -ARENA.halfL + 3, facing: 0 }];
    roster.forEach((r, i) => match.addHero(r.heroId, {
      name: r.name, team: TEAMS[i], control: r.control, side: sideFor(i, you, (j) => TEAMS[j]), spawn: spawns[i],
    }));
    match.state = { kills: { blue: 0, red: 0 } };
  },

  onDeath(match, victim, killer) {
    const { kills } = match.state;
    creditKill(match.state, victim, killer, TEAMS);
    const winner = TEAMS.find((t) => kills[t] >= KILLS_TO_WIN);
    if (winner) {
      match.finish({
        winners: [winner],
        places: match.fighters.map((f) => ({ f, place: f.team === winner ? 1 : 2 })),
        reason: `${kills.blue} : ${kills.red}`,
      });
    }
  },

  hud(match, me) {
    const rival = match.fighters.find((f) => f.team !== me.team);
    return {
      score: [
        { value: match.state.kills[me.team], side: 'self' },
        { value: match.state.kills[rival.team], side: 'enemy', name: `${rival.name} · ${rival.hero.name}` },
      ],
      goal: `До ${KILLS_TO_WIN} убийств`,
    };
  },
};
