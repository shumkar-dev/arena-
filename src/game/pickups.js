import { createCigarette, createMedkit } from '../characters/pickups.js';

// ============================================================
// ПОДБИРАЕМЫЕ ПРЕДМЕТЫ на карте. Герой проходит через точку — предмет срабатывает,
// через respawn секунд появляется снова.
//   cig    — сигарета-усилитель: удары больнее на CIG.time секунд
//   medkit — аптечка: восстанавливает MEDKIT.heal ХП
// Какие предметы и где лежат — решает режим (match.addPickup).
// ============================================================

export const CIG = { time: 10, mul: 1.35 };
export const MEDKIT = { heal: 1500 };

const KINDS = {
  cig: {
    model: createCigarette,
    apply(f, world) { f.addEffect('cig', CIG.time, { mul: CIG.mul }); world.say(f, '🚬 Сила!'); },
  },
  medkit: {
    model: createMedkit,
    canTake: (f) => f.hp < f.maxHp,          // полным ХП аптечку не тратим
    apply(f, world) { const h = f.heal(MEDKIT.heal); world.heal(f, h); },
  },
};

export function createPickups(scene) {
  const spots = [];

  return {
    spots,
    add(kind, x, z, respawn = 15) {
      const m = KINDS[kind].model();
      m.root.position.set(x, 0.8, z);
      scene.add(m.root);
      const spot = { kind, x, z, respawn, active: true, t: 0, model: m };
      spots.push(spot);
      return spot;
    },

    update(dt, world) {
      for (const s of spots) {
        if (!s.active) {
          s.t -= dt;
          if (s.t <= 0) s.active = true;
          continue;
        }
        const kind = KINDS[s.kind];
        for (const f of world.fighters) {
          if (!f.kit || !f.alive) continue;
          if (Math.hypot(f.pos.x - s.x, f.pos.z - s.z) > f.radius + 0.6) continue;
          if (kind.canTake && !kind.canTake(f)) continue;
          kind.apply(f, world);
          world.sfx('pickup');
          s.active = false;
          s.t = s.respawn;
          break;
        }
      }
    },

    // картинка: крутятся, пока лежат
    animate(t) {
      for (const s of spots) {
        s.model.root.visible = s.active;
        if (s.active) s.model.animate(t);
      }
    },
  };
}
