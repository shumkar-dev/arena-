import { createShaba } from './model.js';
import { createShabaKit, SHABA as S } from './kit.js';

// ШАБА — описание героя: всё, что нужно выбору героя, ботам и таблице баланса.
export default {
  id: 'shaba',
  order: 1,
  name: 'Шаба',
  role: 'Ближний бой',
  about: 'Два удара, третьим — захват на 2 с. Ульта — чёрный баран: быстрее и сильнее.',
  color: '#e0a33a',
  icons: { attack: '✊', special: '🤼' },
  stats: S,
  createModel: createShaba,
  createKit: createShabaKit,
  balance: {
    attack: `удар ${S.punchDamage}, вблизи`,
    special: `захват ${S.grabTime} с, ${S.grabTicks} × ${S.grabTickDamage}`,
    ult: `баран ${S.ultDuration} с: +${Math.round((S.ultSpeedMul - 1) * 100)}% скорости и урона`,
  },
  // как им играет бот: дистанции от центра до центра
  bot: {
    melee: true,
    range: 1.9,           // бьёт, когда враг ближе
    keep: 1.2,            // держится на таком расстоянии
    ult: { range: 7 },    // баран — чтобы догнать
  },
};
