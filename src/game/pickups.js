import * as THREE from 'three';
import { createCigarette, createMedkit } from '../characters/pickups.js';

// ============================================================
// ПОДБИРАЕМЫЕ ПРЕДМЕТЫ на карте. Герой проходит через точку — предмет срабатывает,
// через respawn секунд появляется снова.
//   cig    — сигарета-усилитель: удары больнее на CIG.time секунд
//   medkit — аптечка: восстанавливает MEDKIT.heal ХП или долю максимума (opts.healFrac)
// Какие предметы и где лежат — решает режим (match.addPickup).
// Точка видна всегда: круг на земле светится, когда предмет готов, а пока его нет —
// тусклый, и по кругу растёт дуга до появления.
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
    apply(f, world, spot) {
      const h = f.heal(spot.healFrac ? Math.round(f.maxHp * spot.healFrac) : MEDKIT.heal);
      world.heal(f, h);
    },
    glow: 0x4cff7a,
  },
};
KINDS.cig.glow = 0xffa43a;

// круг на земле под предметом: подложка, светящееся кольцо и дуга ожидания
function createSpotMark(color) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CircleGeometry(0.85, 24),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }));
  const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.85, 32), ringMat);
  const arcMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, depthWrite: false });
  const arc = new THREE.Mesh(new THREE.RingGeometry(0.72, 0.83, 32, 1, 0, Math.PI * 2), arcMat);
  for (const m of [base, ring, arc]) { m.rotation.x = -Math.PI / 2; g.add(m); }
  base.position.y = 0.02; ring.position.y = 0.03; arc.position.y = 0.04;
  let lastK = -1;
  return {
    root: g,
    // ready — предмет лежит; k — 0..1, сколько прошло до появления
    set(ready, k, t) {
      if (ready) {
        ringMat.opacity = 0.65 + Math.sin(t * 4) * 0.3;
        ringMat.color.setHex(color);
        ring.scale.setScalar(1 + Math.sin(t * 4) * 0.06);
        arc.visible = false;
      } else {
        ringMat.opacity = 0.35;
        ringMat.color.setHex(0x777777);
        ring.scale.setScalar(1);
        arc.visible = true;
        const q = Math.round(k * 32) / 32;     // геометрию дуги меняем не каждый кадр
        if (q !== lastK) {
          lastK = q;
          arc.geometry.dispose();
          arc.geometry = new THREE.RingGeometry(0.72, 0.83, 32, 1, Math.PI / 2, Math.max(0.001, q * Math.PI * 2));
        }
      }
    },
  };
}

export function createPickups(scene) {
  const spots = [];

  return {
    spots,
    // opts: { healFrac } — аптечка лечит долю максимального ХП
    add(kind, x, z, respawn = 15, opts = {}) {
      const m = KINDS[kind].model();
      m.root.position.set(x, 0.8, z);
      scene.add(m.root);
      const mark = createSpotMark(KINDS[kind].glow);
      mark.root.position.set(x, 0, z);
      scene.add(mark.root);
      const spot = { kind, x, z, respawn, active: true, t: 0, model: m, mark, goneAt: null, ...opts };
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
          kind.apply(f, world, s);
          world.sfx('pickup');
          s.active = false;
          s.t = s.respawn;
          break;
        }
      }
    },

    // картинка: крутятся, пока лежат; круг на земле — готов или сколько ждать
    // (время считаем здесь же: в сетевой игре приходит только «лежит / нет»)
    animate(t) {
      for (const s of spots) {
        s.model.root.visible = s.active;
        if (s.active) { s.model.animate(t); s.goneAt = null; }
        else s.goneAt ??= t;
        s.mark.set(s.active, s.active ? 1 : Math.min(1, (t - s.goneAt) / s.respawn), t);
      }
    },
  };
}
