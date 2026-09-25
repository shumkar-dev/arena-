// ============================================================
// УТКИ И ЗВАНИЯ — строго по GDD (docs/GDD.md, «Рейтинг — утки»).
// Утки — валюта рейтинга (фигурка накачанной утки). Ниже 0 не опускаются.
// ============================================================

export const RANKS = [
  { id: 'novice',   name: 'Новичок',   from: 0,    color: '#b9b0a8' },
  { id: 'tash',     name: 'Таш',       from: 30,   color: '#9ad17a' },
  { id: 'kirpich',  name: 'Кирпич',    from: 100,  color: '#d9824a' },
  { id: 'brutal',   name: 'Брутал',    from: 320,  color: '#e0463c' },
  { id: 'mentalist', name: 'Менталист', from: 529, color: '#b56cf0' },
  { id: 'king',     name: 'Король',    from: 800,  color: '#f2c14e' },
  { id: 'emperor',  name: 'Император', from: 1400, color: '#5fe0ff' },
];

/** Звание по числу уток: { id, name, from, color, index, next } (next — следующее звание или null). */
export function rankOf(ducks) {
  let i = 0;
  while (i + 1 < RANKS.length && ducks >= RANKS[i + 1].from) i++;
  return { ...RANKS[i], index: i, next: RANKS[i + 1] ?? null };
}

export const clampDucks = (n) => Math.max(0, Math.round(n));

/**
 * Сколько уток получает участник матча.
 * r: { modeId, win, place, topKills } — итог для этого бойца.
 *   Каждый сам за себя: 1 место +10 (+5 за первое место по убийствам), 2 место +3, 3 место 0, 4 место −4
 *   1 на 1: победа +5, поражение −5
 *   2 на 2: победа +8, поражение −4
 * Тренировка и прочие режимы — 0.
 */
export function rewardFor(r) {
  if (r.modeId === 'duel') return r.win ? 5 : -5;
  if (r.modeId === 'teams') return r.win ? 8 : -4;
  if (r.modeId === 'ffa') {
    const byPlace = { 1: 10, 2: 3, 3: 0, 4: -4 };
    // по GDD бонус +5 за первое место по убийствам — в строке первого места
    return (byPlace[r.place] ?? 0) + (r.place === 1 && r.topKills ? 5 : 0);
  }
  return 0;
}

/** Режимы, где идёт рейтинг. */
export const isRanked = (modeId) => modeId === 'duel' || modeId === 'teams' || modeId === 'ffa';

/**
 * Мастерство ботов по званию игрока: чем выше звание, тем быстрее реакция,
 * точнее прицел и упреждение, чаще уклонение. Новичку — заметно слабее, Императору — максимум.
 */
export function botSkill(ducks) {
  const k = rankOf(ducks).index / (RANKS.length - 1);   // 0 — Новичок … 1 — Император
  const lerp = (a, b) => a + (b - a) * k;
  return {
    think: lerp(0.3, 0.1),
    aimError: lerp(0.2, 0.025),
    dodge: lerp(0.35, 0.95),
    lead: lerp(0.4, 1),
    hide: k > 0.1,                // Новичок: боты не прячутся
    ultDelay: lerp(0.9, 0.15),
  };
}
