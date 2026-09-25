import { HEROES } from '../heroes/index.js';
import { randomBotName } from '../game/bot.js';

// Общее для режимов: случайные герои и имена ботов.

export const randomHeroId = () => HEROES[Math.floor(Math.random() * HEROES.length)].id;

// n разных имён для ботов
export function botNames(n) {
  const taken = [];
  for (let i = 0; i < n; i++) taken.push(randomBotName(taken));
  return taken;
}

// Счётчик убийств команды. Если боец выбыл сам (без убийцы) — очко всем остальным командам.
export function creditKill(state, victim, killer, teams) {
  if (killer && killer.team !== victim.team) state.kills[killer.team] += 1;
  else for (const t of teams) if (t !== victim.team) state.kills[t] += 1;
}
