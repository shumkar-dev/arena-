import { createIzyum } from './model.js';
import { createIzyumKit, IZYUM as S } from './kit.js';

// ЧЁРНЫЙ ИЗЮМ — описание героя: всё, что нужно выбору героя, ботам и таблице баланса.
export default {
  id: 'izyum',
  order: 3,
  name: 'Чёрный Изюм',
  role: 'Дальний бой',
  about: 'Парит и стреляет изюминками, третья взрывается. Ульта — спускается и 3 с молотит врага.',
  color: '#b04a8a',
  icons: { attack: '🍇', special: '💥' },
  stats: S,
  createModel: createIzyum,
  createKit: createIzyumKit,
  balance: {
    attack: `изюминка ${S.shotDamage}, дальность ${S.shotRange}`,
    special: `взрыв ${S.blastDamage} в радиусе ${S.blastRadius}`,
    ult: `${S.ultDuration} с на земле: рывок к врагу в радиусе ${S.ultSearch} и удары по ${S.punchDamage} каждые ${S.punchEvery} с`,
  },
  bot: {
    range: S.shotRange - 0.4,
    keep: 7.5,
    projectileSpeed: S.shotSpeed,
    ult: { range: S.ultSearch - 0.3 },
  },
};
