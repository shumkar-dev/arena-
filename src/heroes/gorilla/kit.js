import { createChain, aimAttack, faceTowards, enemiesInCone, enemiesInRadius, hittablesOf, wrapAngle } from '../../game/combat.js';

// ============================================================
// ПРИЁМЫ ГОРИЛЛЫ — танк ближнего боя.
// Атака — серия из трёх: два удара кулаком, третьим горилла хватает врага
// и швыряет его в сторону прицела (отброс на несколько метров + небольшой урон).
// После броска серия начинается заново.
// Ульта — рёв и удары в грудь: ускорение на 5 с и один прыжок в точку прицела
// (второе нажатие ульты в эти 5 с). При приземлении — урон по области,
// враги в радиусе разлетаются в стороны от центра. Не прыгнула — ускорение просто кончается.
// ============================================================

export const GORILLA = {
  maxHp: 5600,
  speed: 5.0,
  punchDamage: 650,
  punchTime: 0.36,       // длительность удара, с
  punchHitAt: 0.45,      // доля удара, когда засчитывается попадание
  punchReach: 1.2,       // досягаемость сверх радиусов обоих бойцов
  punchArc: 1.2,         // ±рад — конус перед собой
  attackCooldown: 0.42,
  autoAim: 3.6,
  throwLunge: 0.28,      // рывок к врагу перед броском, с
  throwReach: 1.3,
  throwHold: 0.22,       // держит над головой перед броском, с
  throwDamage: 400,
  throwDist: 5,          // на сколько метров отлетает враг
  throwTime: 0.4,        // сколько летит, с
  ultCooldown: 22,       // считается с рёва (5 с ускорения входят в него)
  ultDuration: 5,
  ultSpeedMul: 1.35,
  roarTime: 0.6,         // рёв и удары в грудь — стоит на месте
  jumpRange: 7,
  jumpTime: 0.55,
  jumpHeight: 2.2,
  jumpDamage: 1300,
  jumpRadius: 2.6,
  jumpKnock: 3.5,        // отброс от центра приземления, м
};

export function createGorillaKit(me) {
  const T = GORILLA;
  const chain = createChain();
  const s = {
    action: null,        // 'punch' | 'lunge' | 'hold'
    actionT: 0,
    side: 1,
    hitDone: false,
    aimAngle: 0,
    victim: null,
    roarT: 0,            // идёт рёв (с)
    ultT: 0,             // осталось ускорения (с)
    ultCd: 0,
    jumped: false,       // прыжок в этом окне уже был
    jump: null,          // { x0, z0, x1, z1, k }
  };

  const release = () => {
    const v = s.victim;
    if (v && v.grabbedBy === me) { v.grabbedBy = null; v.lift = 0; }
    s.victim = null;
  };

  // враг перед собой в конусе на дистанции броска (бутылку не схватишь)
  const findGrab = (world) => {
    let best = null, bestD = Infinity;
    for (const e of hittablesOf(me, world)) {
      if (e.isObjective || e.grabbedBy) continue;
      const dx = e.pos.x - me.pos.x, dz = e.pos.z - me.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > me.radius + e.radius + T.throwReach) continue;
      if (d > 0.01 && Math.abs(wrapAngle(Math.atan2(dx, dz) - me.facing)) > T.punchArc) continue;
      if (d < bestD) { best = e; bestD = d; }
    }
    return best;
  };

  const land = (world) => {
    const { x1: x, z1: z } = s.jump;
    s.jump = null;
    me.airborne = false;
    me.lift = 0;
    world.fx.explosion(x, z, T.jumpRadius, 0x6a5a4a);
    world.sfx('gorillaLand');
    for (const e of enemiesInRadius(me, world, x, z, T.jumpRadius)) {
      world.damage(e, T.jumpDamage, me, 'hit');
      // в стороны от центра; кто точно в центре — по взгляду гориллы
      let dx = e.pos.x - x, dz = e.pos.z - z;
      if (Math.hypot(dx, dz) < 0.1) { dx = Math.sin(me.facing); dz = Math.cos(me.facing); }
      world.knock(e, dx, dz, T.jumpKnock, 0.35);
    }
  };

  const kit = {
    ultAim: 'drag',
    ultRange: T.jumpRange,
    // прицел ульты — круг приземления
    ultShape: { type: 'circle', range: T.jumpRange, radius: T.jumpRadius },
    get lockFacing() { return s.action === 'punch' || s.action === 'lunge' ? s.aimAngle : null; },
    get busy() { return s.action === 'lunge' || s.action === 'hold' || s.roarT > 0 || !!s.jump; },
    get speedMul() { return s.ultT > 0 ? T.ultSpeedMul : 1; },

    attack(dir) { chain.press(dir); },
    // прицел атаки: короткий сектор, у броска — чуть длиннее (рывок)
    attackShape() {
      return chain.special
        ? { type: 'cone', reach: me.radius + T.throwReach + 1.2, arc: T.punchArc * 0.8 }
        : { type: 'cone', reach: me.radius + T.punchReach + 0.4, arc: T.punchArc };
    },

    // первое нажатие — рёв и ускорение; второе в эти 5 с — прыжок в точку aim
    ult(aim, world) {
      if (!me.canAct()) return;
      if (s.ultT > 0 && !s.jumped && !s.jump && aim) {
        let dx = aim.x - me.pos.x, dz = aim.z - me.pos.z;
        const d = Math.hypot(dx, dz);
        if (d > T.jumpRange) { dx *= T.jumpRange / d; dz *= T.jumpRange / d; }
        const x1 = me.pos.x + dx, z1 = me.pos.z + dz;
        if (d > 0.3) faceTowards(me, x1, z1);
        release();
        s.action = null;
        s.roarT = 0;
        s.jumped = true;
        s.jump = { x0: me.pos.x, z0: me.pos.z, x1, z1, k: 0 };
        me.airborne = true;
        world.fx.marker?.(x1, z1, T.jumpRadius, T.jumpTime);
        world.dangers?.push({ x: x1, z: z1, r: T.jumpRadius, t: T.jumpTime, team: me.team });
        world.sfx('swing');
        return;
      }
      if (s.ultCd > 0) return;
      release();
      s.action = null;
      s.ultCd = T.ultCooldown;
      s.ultT = T.ultDuration;
      s.roarT = T.roarTime;
      s.jumped = false;
      world.sfx('gorillaRoar');
    },

    update(dt, world) {
      s.ultCd = Math.max(0, s.ultCd - dt);
      s.ultT = Math.max(0, s.ultT - dt);
      s.roarT = Math.max(0, s.roarT - dt);

      if (!me.alive) {
        release();
        s.action = null; s.jump = null; s.ultT = 0; s.roarT = 0;
        me.airborne = false;
        chain.clear();
        return;
      }

      // прыжок: дуга в точку, приземление — удар по области
      if (s.jump) {
        const j = s.jump;
        j.k = Math.min(1, j.k + dt / T.jumpTime);
        me.pos.x = j.x0 + (j.x1 - j.x0) * j.k;
        me.pos.z = j.z0 + (j.z1 - j.z0) * j.k;
        me.lift = Math.sin(j.k * Math.PI) * T.jumpHeight;
        if (j.k >= 1) land(world);
        return;
      }

      const free = !s.action && s.roarT <= 0 && me.canAct();
      if (chain.tick(dt, free)) {
        aimAttack(me, world, chain.dir, T.autoAim);
        s.aimAngle = me.facing;
        s.actionT = 0;
        s.hitDone = false;
        chain.startCooldown(T.attackCooldown);
        if (chain.special) {
          s.action = 'lunge';
          world.sfx('gorillaGrunt');
        } else {
          s.action = 'punch';
          s.side = -s.side;
          world.sfx('gorillaGrunt');
        }
      }

      if (s.action === 'punch') {
        s.actionT += dt / T.punchTime;
        if (!s.hitDone && s.actionT >= T.punchHitAt) {
          s.hitDone = true;
          const hits = enemiesInCone(me, world, T.punchReach, T.punchArc);
          if (hits.length) {
            world.damage(hits[0], T.punchDamage, me, 'hit');
            world.sfx('punch');
            chain.hit();
          } else world.sfx('swing');   // промах серию не сбрасывает — только пауза
        }
        if (s.actionT >= 1) s.action = null;
      } else if (s.action === 'lunge') {
        s.actionT += dt / T.throwLunge;
        me.pos.x += Math.sin(me.facing) * 4 * dt;
        me.pos.z += Math.cos(me.facing) * 4 * dt;
        const tgt = findGrab(world);
        if (tgt) {
          s.victim = tgt;
          tgt.grabbedBy = me;
          world.sfx('grab');
          s.action = 'hold';
          s.actionT = 0;
        } else if (s.actionT >= 1) {
          s.action = null;
          chain.consume();          // промах — серия заново
        }
      } else if (s.action === 'hold') {
        const v = s.victim;
        s.actionT += dt / T.throwHold;
        if (!v || !v.alive || v.grabbedBy !== me) { release(); s.action = null; chain.consume(); return; }
        // враг поднят перед гориллой; неподвижную цель (манекен) не двигаем
        if (!v.isStatic) {
          const d = me.radius + v.radius;
          v.pos.x = me.pos.x + Math.sin(me.facing) * d;
          v.pos.z = me.pos.z + Math.cos(me.facing) * d;
          v.facing = me.facing + Math.PI;
        }
        v.lift = 0.3 + 1.1 * Math.min(1, s.actionT);
        if (s.actionT >= 1) {
          // швырок в сторону прицела
          release();
          world.damage(v, T.throwDamage, me, 'hit');
          world.knock(v, Math.sin(s.aimAngle), Math.cos(s.aimAngle), T.throwDist, T.throwTime);
          world.sfx('gorillaGrunt');
          world.sfx('throw');
          s.action = null;
          chain.consume();
        }
      }
    },

    pose() {
      const throwK = s.action === 'lunge' ? Math.min(1, s.actionT) * 0.45
        : s.action === 'hold' ? 0.45 + Math.min(1, s.actionT) * 0.55 : null;
      return {
        punch: s.action === 'punch' ? Math.min(1, s.actionT) : null,
        punchSide: s.side,
        throwK,
        roar: s.roarT > 0,
        jump: s.jump ? s.jump.k : null,
      };
    },

    hud() {
      // пока идёт ускорение и прыжок не потрачен — ульта снова готова (это прыжок)
      const jumpReady = s.ultT > 0 && !s.jumped && !s.jump;
      return {
        combo: chain.combo,
        grabbing: s.action === 'hold',
        ultCd: jumpReady ? 0 : s.ultCd,
        ultFrac: jumpReady ? 0 : s.ultCd / T.ultCooldown,
        ultActive: s.ultT > 0,
        jumpReady,
      };
    },
  };

  return kit;
}
