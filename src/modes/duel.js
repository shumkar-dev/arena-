import { ARENA } from '../game/arena.js';
import { heroById } from '../heroes/index.js';
import { randomHeroId, botNames, creditKill } from './common.js';

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

  setup(match, { heroId, botHeroId, playerName, botNames: preferred }) {
    const [botName] = botNames(1, preferred);
    match.addHero(heroId, {
      name: playerName ?? heroById(heroId).name, team: 'blue', control: 'local', side: 'self',
      spawn: { x: 0, z: ARENA.halfL - 3, facing: Math.PI },
    });
    match.addHero(botHeroId ?? randomHeroId(), {
      name: botName, team: 'red', control: 'bot', side: 'enemy',
      spawn: { x: 0, z: -ARENA.halfL + 3, facing: 0 },
    });
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
