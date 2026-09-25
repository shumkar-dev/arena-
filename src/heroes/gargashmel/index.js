import { createGargashmel } from './model.js';
import { createGargashmelKit, GARGASHMEL as S } from './kit.js';

// ГАРГАШМЕЛЬ — описание героя: всё, что нужно выбору героя, ботам и таблице баланса.
export default {
  id: 'gargashmel',
  order: 4,
  name: 'Гаргашмель',
  role: 'Ближний бой',
  about: 'Бьёт щупальцами, третий удар ускоряет атаку. Ульта — шмель летит в точку и взрывается: зажми и оттяни, чтобы выбрать её.',
  color: '#2e9e93',
  voice: 'garga',          // файлы озвучки: public/voices/garga_<событие>.mp3
  icons: { attack: '🐙', special: '⚡' },
  stats: S,
  createModel: createGargashmel,
  createKit: createGargashmelKit,
  balance: {
    attack: `щупальце ${S.whipDamage}, вблизи, всем в конусе`,
    special: `удар + атака в ${Math.round(1 / S.frenzyMul)} раза быстрее ${S.frenzyTime} с`,
    ult: `шмель летит в точку ${S.beeBaseTime}–${(S.beeBaseTime + S.ultRange / S.beeSpeed).toFixed(1)} с, затем взрыв ${S.ultDamage} в радиусе ${S.ultRadius}, дальность ${S.ultRange}`,
  },
  bot: {
    melee: true,
    range: 2.3,
    keep: 1.5,
    // шмель летит не сразу — бот целится с упреждением на время полёта
    ult: { range: S.ultRange - 0.5, lead: (d) => S.beeBaseTime + d / S.beeSpeed },
  },
};
