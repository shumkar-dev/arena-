// ============================================================
// ТАБЛИЦА БАЛАНСА — собирается из папок героев (src/heroes/<id>/index.js)
// и записывается в docs/BALANCE.md. Запуск: npm run balance
// Новый герой попадает в таблицу сам — ничего здесь править не нужно.
// ============================================================

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const heroesDir = path.join(root, 'src/heroes');

const heroes = [];
for (const id of fs.readdirSync(heroesDir)) {
  const file = path.join(heroesDir, id, 'index.js');
  if (!fs.existsSync(file)) continue;
  heroes.push((await import(pathToFileURL(file).href)).default);
}
heroes.sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.name.localeCompare(b.name));

const rows = heroes.map((h) =>
  `| ${h.name} | ${h.role} | ${h.stats.maxHp} | ${h.stats.speed} | ${h.balance.attack} | ${h.balance.special} | ${h.balance.ult} | ${h.stats.ultCooldown} с |`);

const md = `# Баланс героев

> Файл собирается сам: \`npm run balance\`. Числа берутся из \`src/heroes/<id>/kit.js\`,
> подписи — из поля \`balance\` в \`src/heroes/<id>/index.js\`. Руками не править.

| Герой | Роль | ХП | Скорость | Атака | 3-я атака | Ульта | Перезарядка ульты |
|---|---|---|---|---|---|---|---|
${rows.join('\n')}

Третья атака срабатывает после двух попаданий. Серию сбрасывает пауза больше 2,2 с без атак.
`;

fs.writeFileSync(path.join(root, 'docs/BALANCE.md'), md);
console.log(`docs/BALANCE.md: ${heroes.length} героев — ${heroes.map((h) => h.name).join(', ')}`);
