import { createShaba } from '../characters/shaba.js';
import { createSmitana } from '../characters/smitana.js';
import { createIzyum } from '../characters/izyum.js';
import { createGargashmel } from '../characters/gargashmel.js';
import { createShabaKit, SHABA } from './kits/shaba.js';
import { createSmitanaKit, SMITANA } from './kits/smitana.js';
import { createIzyumKit, IZYUM } from './kits/izyum.js';
import { createGargashmelKit, GARGASHMEL } from './kits/gargashmel.js';

// ============================================================
// ГЕРОИ — всё, что движку и интерфейсу нужно знать о персонаже.
// stride — сколько радиан шага на единицу пути (для анимации бега).
// ============================================================

export const HEROES = [
  {
    id: 'shaba',
    name: 'Шаба',
    role: 'Ближний бой',
    about: 'Два удара, третьим — захват на 2 с. Ульта — чёрный баран: быстрее и сильнее.',
    color: '#e0a33a',
    stats: SHABA,
    icons: { attack: '✊', special: '🤼' },
    stride: 1.65,
    createModel: createShaba,
    createKit: createShabaKit,
  },
  {
    id: 'smitana',
    name: 'Смитана',
    role: 'Средняя дистанция',
    about: 'Стреляет сметаной, третий выстрел замедляет на 3 с. Ульта — сметанамёт: струя конусом 3 с.',
    color: '#f4f2ea',
    stats: SMITANA,
    icons: { attack: '🥛', special: '🐌' },
    stride: 1.65,
    createModel: createSmitana,
    createKit: createSmitanaKit,
  },
  {
    id: 'izyum',
    name: 'Чёрный Изюм',
    role: 'Дальний бой',
    about: 'Парит и стреляет изюминками, третья взрывается. Ульта — спускается и 3 с молотит врага.',
    color: '#b04a8a',
    stats: IZYUM,
    icons: { attack: '🍇', special: '💥' },
    stride: 1.65,
    createModel: createIzyum,
    createKit: createIzyumKit,
  },
  {
    id: 'gargashmel',
    name: 'Гаргашмель',
    role: 'Ближний бой',
    about: 'Бьёт щупальцами, третий удар ускоряет атаку. Ульта — шмель: зажми и оттяни, чтобы выбрать точку.',
    color: '#2e9e93',
    stats: GARGASHMEL,
    icons: { attack: '🐙', special: '⚡' },
    stride: 1.65,
    createModel: createGargashmel,
    createKit: createGargashmelKit,
  },
];

export const heroById = (id) => HEROES.find((h) => h.id === id) ?? HEROES[0];
