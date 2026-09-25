// ============================================================
// ПРИЁМЫ ШАБЫ
// Атака идёт серией: удар, удар, захват. Захват держит врага 2 с и наносит урон.
// Ульта — чёрный баран: +скорость и +сила атаки на 5 с.
// ============================================================

export const SHABA = {
  maxHp: 4000,
  speed: 5.5,
  punchDamage: 600,
  punchTime: 0.32,       // длительность удара, с
  punchHitAt: 0.45,      // в какой момент удара засчитывается попадание (доля)
  punchReach: 1.1,       // досягаемость сверх радиусов обоих бойцов
  punchArc: 1.2,         // ±рад — конус перед собой
  attackCooldown: 0.38,  // минимальный интервал между нажатиями
  comboReset: 2.2,       // сбросить серию, если долго не бьёт, с
  grabLunge: 0.35,       // рывок к врагу перед захватом, с
  grabReach: 1.2,
  grabTime: 2,           // удержание, с
  grabTicks: 4,
  grabTickDamage: 300,
  grabRelease: 1.3,      // отброс после захвата
  autoAim: 3.4,          // дистанция, на которой удар сам доворачивает к врагу
  ultDuration: 5,
  ultCooldown: 20,
  ultSpeedMul: 1.5,
  ultDamageMul: 1.5,
};

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function createShabaKit(me) {
  const T = SHABA;
  const s = {
    combo: 0,          // 0, 1 — удары; 2 — следующим будет захват
    comboIdle: 0,
    cd: 0,
    action: null,      // 'punch' | 'lunge' | 'hold'
    actionT: 0,
    side: 1,
    hitDone: false,
    victim: null,
    holdT: 0,
    ticks: 0,
    ultT: 0,
    ultCd: 0,
    queued: 0,         // нажатие, сделанное во время удара, выполнится сразу после него
    dir: null,         // направление нажатия; null — автоприцел
    aimAngle: 0,       // куда направлена текущая атака
  };

  // бьёт всех, кого задел (и прохожих), а доворачивает только к врагам
  const enemies = (world) => world.fighters.filter((f) => f !== me && f.alive && f.team !== me.team);
  const foes = (world) => enemies(world).filter((f) => !f.neutral);

  const dmgMul = () => (s.ultT > 0 ? T.ultDamageMul : 1);

  // враг в конусе перед собой на дистанции удара
  const findTarget = (world, reach) => {
    let best = null, bestD = Infinity;
    for (const e of enemies(world)) {
      const dx = e.pos.x - me.pos.x, dz = e.pos.z - me.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > me.radius + e.radius + reach) continue;
      if (Math.abs(wrap(Math.atan2(dx, dz) - me.facing)) > T.punchArc) continue;
      if (d < bestD) { best = e; bestD = d; }
    }
    return best;
  };

  const autoAim = (world) => {
    let best = null, bestD = T.autoAim;
    for (const e of foes(world)) {
      const d = Math.hypot(e.pos.x - me.pos.x, e.pos.z - me.pos.z);
      if (d < bestD) { best = e; bestD = d; }
    }
    if (best) me.facing = Math.atan2(best.pos.x - me.pos.x, best.pos.z - me.pos.z);
  };

  const release = () => {
    const v = s.victim;
    if (v) {
      v.grabbedBy = null;
      v.lift = 0;
      if (v.alive && !v.isStatic) {
        v.pos.x += Math.sin(me.facing) * T.grabRelease;
        v.pos.z += Math.cos(me.facing) * T.grabRelease;
      }
    }
    s.victim = null;
    s.action = null;
  };

  const kit = {
    ultAim: 'tap',
    // пока идёт удар или рывок — смотрит туда, куда бил, а не по джойстику
    get lockFacing() { return s.action === 'punch' || s.action === 'lunge' ? s.aimAngle : null; },
    get busy() { return s.action === 'hold' || s.action === 'lunge'; },
    get speedMul() { return s.ultT > 0 ? T.ultSpeedMul : 1; },

    // dir — { x, z } с оттяжки кнопки или null — автоприцел
    attack(dir = null) {
      s.queued = 0.35;
      s.dir = dir;
    },

    // форма прицела атаки: короткий сектор перед собой, у захвата — чуть длиннее (рывок)
    attackShape() {
      return s.combo >= 2
        ? { type: 'cone', reach: me.radius + T.grabReach + 1.4, arc: T.punchArc * 0.8 }
        : { type: 'cone', reach: me.radius + T.punchReach + 0.4, arc: T.punchArc };
    },

    startAttack(world) {
      s.queued = 0;
      if (s.dir) me.facing = Math.atan2(s.dir.x, s.dir.z);
      else autoAim(world);
      s.aimAngle = me.facing;
      s.cd = T.attackCooldown;
      s.comboIdle = 0;
      s.actionT = 0;
      s.hitDone = false;
      if (s.combo < 2) {
        s.action = 'punch';
        s.side = s.combo === 0 ? 1 : -1;
      } else {
        s.action = 'lunge';
      }
    },

    ult(aim, world) {
      if (!me.canAct() || s.ultCd > 0) return;
      world?.sfx('ultShaba');
      s.ultT = T.ultDuration;
      s.ultCd = T.ultCooldown;
    },

    update(dt, world) {
      s.cd = Math.max(0, s.cd - dt);
      s.ultCd = Math.max(0, s.ultCd - dt);
      s.ultT = Math.max(0, s.ultT - dt);

      if (!me.alive) {
        if (s.victim) release();
        s.action = null; s.combo = 0; s.ultT = 0; s.queued = 0;
        return;
      }

      if (s.queued > 0) {
        if (me.canAct() && s.cd <= 0 && !s.action) kit.startAttack(world);
        else s.queued = Math.max(0, s.queued - dt);
      }

      if (!s.action) {
        s.comboIdle += dt;
        if (s.comboIdle > T.comboReset) s.combo = 0;
      }

      if (s.action === 'punch') {
        s.actionT += dt / T.punchTime;
        if (!s.hitDone && s.actionT >= T.punchHitAt) {
          s.hitDone = true;
          const tgt = findTarget(world, T.punchReach);
          if (tgt) {
            world.damage(tgt, T.punchDamage * dmgMul(), me, 'hit');
            world.sfx('punch');
            s.combo += 1;
          } else {
            world.sfx('swing');   // промах серию не сбрасывает — её сбрасывает только пауза
          }
        }
        if (s.actionT >= 1) s.action = null;
      } else if (s.action === 'lunge') {
        s.actionT += dt / T.grabLunge;
        // небольшой рывок вперёд
        me.pos.x += Math.sin(me.facing) * 4 * dt;
        me.pos.z += Math.cos(me.facing) * 4 * dt;
        const tgt = findTarget(world, T.grabReach);
        if (tgt && !tgt.grabbedBy && !tgt.isObjective) {   // бутылку не схватишь
          s.victim = tgt;
          tgt.grabbedBy = me;
          world.sfx('grab');
          s.action = 'hold';
          s.holdT = 0;
          s.ticks = 0;
          s.combo = 0;
        } else if (s.actionT >= 1) {
          s.action = null;
          s.combo = 0;
        }
      } else if (s.action === 'hold') {
        const v = s.victim;
        s.holdT += dt;
        if (!v || !v.alive || v.grabbedBy !== me) { release(); return; }
        // жертва перед Шабой, приподнята и развёрнута к нему;
        // неподвижную цель (манекен) не двигаем — Шаба держит её на месте
        me.facing = Math.atan2(v.pos.x - me.pos.x, v.pos.z - me.pos.z);
        if (!v.isStatic) {
          const d = me.radius + v.radius + 0.1;
          v.pos.x = me.pos.x + Math.sin(me.facing) * d;
          v.pos.z = me.pos.z + Math.cos(me.facing) * d;
          v.facing = me.facing + Math.PI;
        }
        v.lift = 0.45 + Math.sin(s.holdT * 22) * 0.04;
        const due = Math.min(T.grabTicks, Math.floor((s.holdT / T.grabTime) * T.grabTicks + 1e-6));
        while (s.ticks < due) {
          s.ticks += 1;
          world.damage(v, T.grabTickDamage * dmgMul(), me, 'grab');
          world.sfx('punch');
          if (!v.alive) break;
        }
        if (!v.alive || s.holdT >= T.grabTime) release();
      }
    },

    // параметры для анимации модели
    pose() {
      return {
        riding: s.ultT > 0,
        punch: s.action === 'punch' ? Math.min(1, s.actionT) : null,
        punchSide: s.side,
        grab: s.action === 'lunge' ? Math.min(1, s.actionT) * 0.33 : s.action === 'hold' ? 1 : null,
      };
    },

    hud() {
      return {
        combo: s.combo,
        grabbing: s.action === 'hold',
        ultCd: s.ultCd,
        ultFrac: s.ultCd / T.ultCooldown,
        ultActive: s.ultT > 0,
      };
    },
  };

  return kit;
}
