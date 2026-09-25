import { createSmitana } from './model.js';
import { createSmitanaKit, SMITANA as S } from './kit.js';

// СМИТАНА — описание героя: всё, что нужно выбору героя, ботам и таблице баланса.
export default {
  id: 'smitana',
  order: 2,
  name: 'Смитана',
  role: 'Средняя дистанция',
  about: 'Стреляет сметаной, третий выстрел замедляет на 3 с. Ульта — сметанамёт: струя конусом 3 с.',
  color: '#f4f2ea',
  icons: { attack: '🥛', special: '🐌' },
  stats: S,
  createModel: createSmitana,
  createKit: createSmitanaKit,
  balance: {
    attack: `сметана ${S.shotDamage}, дальность ${S.shotRange}`,
    special: `${S.shotDamage} + замедление ${Math.round((1 - S.slowMul) * 100)}% на ${S.slowTime} с`,
    ult: `сметанамёт ${S.ultDuration} с: ${S.sprayDamage} всем в конусе каждые ${S.sprayTick} с`,
  },
  bot: {
    range: S.shotRange - 0.3,
    keep: 5.2,
    projectileSpeed: S.shotSpeed,
    ult: { range: S.sprayReach + 0.6, stream: true },   // струю держит на враге всё время ульты
  },
};
