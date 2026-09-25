import * as THREE from 'three';
import { createChain, aimAttack, nearestEnemy, faceTowards, enemiesInRadius, dist2d } from '../../game/combat.js';

// ============================================================
// ПРИЁМЫ ЧЁРНОГО ИЗЮМА
// Атака — изюминки на дальнюю дистанцию. Третья — изюминка с мини-взрывом.
// Ульта — спускается на землю и 3 с быстро и мощно бьёт одного врага рядом,
// потом снова парит.
// ============================================================

export const IZYUM = {
  maxHp: 4000,
  speed: 5.5,
  shotDamage: 380,
  shotRange: 10.5,
  shotSpeed: 20,
  shotRadius: 0.3,
  shotTime: 0.26,
  releaseAt: 0.4,
  attackCooldown: 0.5,
  autoAim: 11,
  blastDamage: 700,
  blastRadius: 1.9,
  ultDuration: 3,
  ultCooldown: 20,
  ultSearch: 6.5,         // на каком расстоянии ульта находит врага
  dashSpeed: 14,
  punchReach: 0.8,
  punchEvery: 0.28,
  punchDamage: 250,
};

const raisinMat = new THREE.MeshStandardMaterial({ color: 0x3a2030, roughness: 0.8, emissive: 0x2a0f22, emissiveIntensity: 0.6 });
const raisinGeo = new THREE.BoxGeometry(1, 1, 1);

function raisin(size) {
  const m = new THREE.Mesh(raisinGeo, raisinMat);
  m.scale.set(size, size * 0.8, size * 1.1);
  m.castShadow = true;
  return m;
}

export function createIzyumKit(me) {
  const T = IZYUM;
  const chain = createChain();
  const s = {
    shotT: -1, side: 1, released: false, special: false,
    ultT: 0, ultCd: 0, target: null, punchT: 0, punchAnim: -1, punchSide: 1,
  };

  const fire = (world) => {
    const special = s.special;
    const fx = Math.sin(me.facing), fz = Math.cos(me.facing);
    const rx = Math.cos(me.facing), rz = -Math.sin(me.facing);
    const blast = (x, z) => {
      world.fx.explosion(x, z, T.blastRadius, 0xb04a8a);
      world.sfx('explosion', { size: 0.45 });
      for (const e of enemiesInRadius(me, world, x, z, T.blastRadius)) world.damage(e, T.blastDamage, me, 'grab');
    };
    world.projectiles.spawn({
      owner: me,
      x: me.pos.x + fx * 0.6 + rx * 0.45 * s.side,
      z: me.pos.z + fz * 0.6 + rz * 0.45 * s.side,
      y: 1.8,
      dirX: fx, dirZ: fz,
      speed: T.shotSpeed,
      range: T.shotRange,
      radius: T.shotRadius,
      mesh: raisin(special ? 0.34 : 0.2),
      spin: special ? 10 : 0,
      onHit(target, p) {
        if (special) blast(p.x, p.z);
        else { world.damage(target, T.shotDamage, me, 'hit'); world.fx.spark(p.x, 1.8, p.z, 0xb04a8a); world.sfx('impact'); chain.hit(); }
      },
      onEnd(p) {
        if (special) blast(p.x, p.z);
      },
    });
    if (special) chain.consume();
  };

  return {
    ultAim: 'tap',
    // пока идёт атака — смотрит туда, куда целился, а не по джойстику
    get lockFacing() { return s.shotT >= 0 ? s.aimAngle : null; },
    get busy() { return s.ultT > 0; },   // в ульте движением управляет сам приём
    get speedMul() { return 1; },

    attack(dir) { chain.press(dir); },
    // форма прицела атаки: линия выстрела; у третьей — круг взрыва на конце
    attackShape() {
      return { type: 'line', length: T.shotRange, width: T.shotRadius * 2, endRadius: chain.special ? T.blastRadius : 0 };
    },


    ult(aim, world) {
      if (!me.canAct() || s.ultCd > 0) return;
      const tgt = nearestEnemy(me, world, T.ultSearch);
      if (!tgt) { world.say(me, 'Нет цели'); world.sfx('noTarget'); return; }   // без цели ульта не тратится
      world.sfx('ultIzyum');
      s.target = tgt;
      s.ultT = T.ultDuration;
      s.ultCd = T.ultCooldown;
      s.punchT = 0;
      s.shotT = -1;
    },

    update(dt, world) {
      s.ultCd = Math.max(0, s.ultCd - dt);
      if (!me.alive) { s.ultT = 0; s.shotT = -1; s.target = null; chain.clear(); return; }

      if (s.ultT > 0) {
        s.ultT = Math.max(0, s.ultT - dt);
        if (!s.target || !s.target.alive) s.target = nearestEnemy(me, world, T.ultSearch);
        const tgt = s.target;
        if (tgt && s.ultT > 0) {
          faceTowards(me, tgt.pos.x, tgt.pos.z);
          const d = dist2d(me, tgt), reach = me.radius + tgt.radius + T.punchReach;
          if (d > reach) {
            // рывок к цели
            const step = Math.min(T.dashSpeed * dt, d - reach * 0.9);
            me.pos.x += ((tgt.pos.x - me.pos.x) / d) * step;
            me.pos.z += ((tgt.pos.z - me.pos.z) / d) * step;
            s.moving = true;
          } else {
            s.moving = false;
            s.punchT -= dt;
            if (s.punchT <= 0) {
              s.punchT += T.punchEvery;
              s.punchAnim = 0;
              s.punchSide = -s.punchSide;
              world.damage(tgt, T.punchDamage, me, 'grab');
              world.sfx('punch');
            }
          }
        } else s.moving = false;
        if (s.ultT <= 0) s.target = null;
      }
      if (s.punchAnim >= 0) {
        s.punchAnim += dt / (T.punchEvery * 0.9);
        if (s.punchAnim >= 1) s.punchAnim = -1;
      }

      const free = s.shotT < 0 && s.ultT <= 0 && me.canAct();
      if (chain.tick(dt, free)) {
        aimAttack(me, world, chain.dir, T.autoAim);
        s.aimAngle = me.facing;
        s.shotT = 0;
        s.released = false;
        s.special = chain.special;
        s.side = -s.side;
        chain.startCooldown(T.attackCooldown);
      }
      if (s.shotT >= 0) {
        s.shotT += dt / T.shotTime;
        if (!s.released && s.shotT >= T.releaseAt) { s.released = true; fire(world); world.sfx('shot'); }
        if (s.shotT >= 1) s.shotT = -1;
      }
    },

    // в ульте анимация бега идёт от рывка, а не от джойстика
    get forcedMoving() { return s.ultT > 0 ? !!s.moving : null; },

    pose() {
      return {
        grounded: s.ultT > 0,
        shot: s.shotT >= 0 ? Math.min(1, s.shotT) : null,
        shotSide: s.side,
        punch: s.punchAnim >= 0 ? s.punchAnim : null,
        punchSide: s.punchSide,
      };
    },

    hud() {
      return {
        combo: chain.combo,
        ultCd: s.ultCd,
        ultFrac: s.ultCd / T.ultCooldown,
        ultActive: s.ultT > 0,
        attackLocked: s.ultT > 0,
      };
    },
  };
}
