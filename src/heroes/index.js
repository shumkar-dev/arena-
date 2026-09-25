// ============================================================
// СПИСОК ГЕРОЕВ — собирается сам: каждая папка src/heroes/<id>/ с файлом
// index.js — это герой. Новый герой сразу появляется в выборе героя,
// у ботов и в таблице баланса (npm run balance). Как добавить — в README.
// ============================================================

const REQUIRED = ['id', 'name', 'role', 'about', 'color', 'icons', 'stats', 'createModel', 'createKit', 'balance', 'bot'];

const modules = import.meta.glob('./*/index.js', { eager: true });

export const HEROES = Object.entries(modules)
  .map(([path, m]) => {
    const hero = m.default;
    const missing = REQUIRED.filter((k) => hero?.[k] == null);
    if (missing.length) throw new Error(`Герой ${path}: не хватает полей ${missing.join(', ')}`);
    return { stride: 1.65, order: 99, ...hero };
  })
  .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

export const heroById = (id) => HEROES.find((h) => h.id === id) ?? HEROES[0];
