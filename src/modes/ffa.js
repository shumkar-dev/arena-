import { currentMap } from '../game/arena.js';
import { addWalkers } from '../game/walkers.js';
import { rosterOf, sideFor } from './common.js';

// ============================================================
// КАЖДЫЙ САМ ЗА СЕБЯ. Четыре бойца, до последнего выжившего — без возрождения.
// Карта — парк с прохожими: их можно бить, они мешают и служат живым укрытием.
// Есть аптечки и сигареты.
// ============================================================

const WALKERS = 7;
const TEAMS = ['p1', 'p2', 'p3', 'p4'];

export default {
  id: 'ffa',
  order: 3,
  name: 'Каждый сам за себя',
  title: 'Парк',
  about: 'Четыре бойца в парке, побеждает последний выживший. Прохожие мешают и прикрывают. Есть аптечки и сигареты.',
  icon: '🌳',
  map: 'park',
  showPlace: true,          // в итоге показывать место, а не «Поражение»

  slots: 4,
  teamOf: (i) => TEAMS[i],

  setup(match, opts) {
    const map = currentMap();
    const { roster, you } = rosterOf(opts, 4);
    roster.forEach((r, i) => match.addHero(r.heroId, {
      name: r.name, team: TEAMS[i], control: r.control, side: sideFor(i, you, (j) => TEAMS[j]),
      spawn: map.spawns[i], respawns: false,
    }));
    // аптечки на дорожке север–юг, сигареты — на дорожке запад–восток
    match.addPickup('medkit', 0, 8.5, 18);
    match.addPickup('medkit', 0, -8.5, 18);
    match.addPickup('cig', 8.5, 0, 15);
    match.addPickup('cig', -8.5, 0, 15);

    match.state.walkers = addWalkers(match, map.walkRoutes, WALKERS);
  },

  beforePhysics(match, dt) { match.state.walkers.update(dt); },

  onDeath(match, victim) {
    if (victim.neutral) { match.state.walkers.onDeath(victim); return; }
    if (!victim.kit) return;
    const heroes = match.fighters.filter((f) => f.kit);
    const alive = heroes.filter((f) => f.alive);
    victim.place = alive.length + 1;

    // me — игрок этого устройства; на сервере его нет — там бой идёт до последнего выжившего
    const me = heroes.find((f) => f.control === 'local');
    // последний выживший — победа; выбыл ты — итог сразу (место уже известно)
    if (alive.length <= 1 || (me && victim === me)) {
      if (alive.length === 1) alive[0].place = 1;
      const winner = alive.length === 1 ? alive[0] : null;
      match.finish({
        winners: winner ? [winner.team] : [],
        places: heroes.filter((f) => f.place).map((f) => ({ f, place: f.place })),
        reason: !me ? (winner ? `Победитель: ${winner.name}` : '')
          : winner === me ? `Убийств: ${me.kills}` : `Место ${me.place ?? '—'} · убийств: ${me.kills}`,
      });
    }
  },

  hud(match, me) {
    const alive = match.fighters.filter((f) => f.kit && f.alive).length;
    return {
      score: [
        { icon: '👤', value: alive, side: 'neutral' },
        { icon: '💀', value: me.kills, side: 'self', sep: '·' },
      ],
      goal: 'Останься последним',
    };
  },
};
