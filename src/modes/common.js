import { HEROES, heroById } from '../heroes/index.js';
import { randomBotName } from '../game/bot.js';

// Общее для режимов: кто на каких местах, случайные герои и имена ботов.

export const randomHeroId = () => HEROES[Math.floor(Math.random() * HEROES.length)].id;

// n разных имён для ботов; preferred — имена, которые игра подобрала заранее
// (в рейтинге — соперники твоего уровня), недостающие добираются случайно
export function botNames(n, preferred = []) {
  const taken = [...new Set(preferred)].slice(0, n);
  while (taken.length < n) taken.push(randomBotName(taken));
  return taken;
}

// Кто на каком месте арены. В сетевой игре состав приходит готовым: opts.roster —
// [{ heroId, name, control }] по местам, opts.you — твоё место (на сервере — null).
// В обычной игре ты на месте 0, остальные места — боты.
export function rosterOf(opts, n, { botHeroId = null } = {}) {
  if (opts.roster) return { roster: opts.roster, you: opts.you ?? null };
  const names = botNames(n - 1, opts.botNames);
  const roster = [{ heroId: opts.heroId, name: opts.playerName ?? heroById(opts.heroId).name, control: 'local' }];
  for (let i = 1; i < n; i++) roster.push({ heroId: (i === 1 && botHeroId) || randomHeroId(), name: names[i - 1], control: 'bot' });
  return { roster, you: 0 };
}

// цвет кольца и полоски ХП бойца на этом устройстве: свой, союзник или враг
export const sideFor = (i, you, teamOf) => (you == null ? 'enemy' : i === you ? 'self' : teamOf(i) === teamOf(you) ? 'ally' : 'enemy');

// Счётчик убийств команды. Если боец выбыл сам (без убийцы) — очко всем остальным командам.
export function creditKill(state, victim, killer, teams) {
  if (killer && killer.team !== victim.team) state.kills[killer.team] += 1;
  else for (const t of teams) if (t !== victim.team) state.kills[t] += 1;
}
