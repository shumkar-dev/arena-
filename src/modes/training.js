import { ARENA } from '../game/arena.js';
import { createFighter } from '../game/fighter.js';
import { createDummy } from '../characters/dummy.js';
import { heroById } from '../heroes/index.js';

// ============================================================
// ТРЕНИРОВКА — неподвижный манекен, без счёта и без конца.
// Попробовать приёмы героя и прицел.
// ============================================================

export default {
  id: 'training',
  order: 90,
  name: 'Тренировка',
  title: 'Тренировка',
  about: 'Манекен, который не отвечает. Попробуй приёмы и прицел.',
  icon: '🎯',
  map: 'road',

  setup(match, { heroId, playerName }) {
    match.addHero(heroId, {
      name: playerName ?? heroById(heroId).name, team: 'blue', control: 'local', side: 'self',
      spawn: { x: 0, z: ARENA.halfL - 3, facing: Math.PI },
    });
    match.addObject(createFighter({
      name: 'Манекен', team: 'red', model: createDummy(), maxHp: 4000,
      spawn: { x: -2.2, z: 7.5, facing: 0 }, radius: 0.55, headY: 2.75, side: 'enemy',
    }));
  },

  hud() { return { score: null, goal: 'Тренировка' }; },
};
