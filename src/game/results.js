// ============================================================
// ИТОГ МАТЧА ПО ГЕРОЯМ — для рейтинга (уток). Общий для игры и сервера.
// Для каждого героя (в порядке match.fighters): победил ли, место, первый ли по убийствам.
// Кто ещё не выбыл, когда матч кончился, занимает свободные места по здоровью.
// ============================================================

export function matchParticipants(match, res) {
  const heroes = match.fighters.filter((f) => f.kit);
  const placeOf = new Map((res.places ?? []).map((p) => [p.f, p.place]));
  const taken = new Set(placeOf.values());
  const free = heroes.map((_, i) => i + 1).filter((p) => !taken.has(p));
  heroes.filter((f) => !placeOf.has(f)).sort((a, b) => b.hp - a.hp).forEach((f, i) => placeOf.set(f, free[i] ?? heroes.length));
  return heroes.map((f) => ({
    f,
    name: f.name,
    win: res.winners.includes(f.team),
    place: placeOf.get(f),
    topKills: f.kills > 0 && heroes.every((o) => o === f || o.kills <= f.kills),
  }));
}
