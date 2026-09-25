// ============================================================
// РЕЖИМЫ — собираются сами: каждый файл src/modes/<id>.js с export default —
// это режим. Он появляется в выборе режима без правок в движке.
//
// Что описывает режим:
//   id, order, name, about, icon, map    — для меню; map — какая карта ('road')
//   setup(match, opts)                    — выпустить бойцов: match.addHero(...), match.addObject(...)
//                                           opts: { heroId, botHeroId, playerName }
//   update(match, dt)                     — правила каждый кадр (по желанию)
//   beforePhysics(match, dt)              — после действий бойцов, до столкновений (по желанию)
//   onDeath(match, victim, killer)        — кто-то выбыл (по желанию)
//   hud(match, me)                        — что показать вверху: { score: [...], goal }
// Конец матча: match.finish({ winners: [команды], places: [{ f, place }], reason }).
//
// Бойцы с control: 'local' управляются кнопками этого устройства, 'bot' — ботом.
// Для сетевой игры режим сможет выдать control: 'remote' — остальное не меняется.
// ============================================================

const modules = import.meta.glob('./*.js', { eager: true });

export const MODES = Object.entries(modules)
  .filter(([path]) => !path.endsWith('/index.js') && !path.endsWith('/common.js'))
  .map(([, m]) => ({ order: 99, ...m.default }))
  .sort((a, b) => a.order - b.order);

export const modeById = (id) => MODES.find((m) => m.id === id) ?? MODES[0];
