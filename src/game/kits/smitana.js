import * as THREE from 'three';
import { createChain, nearestEnemy, faceTowards, enemiesInRadius } from '../combat.js';

// ============================================================
// ПРИЁМЫ СМИТАНЫ
// Атака — сметана, средняя дальность. Третья — сметана, которая замедляет на 3 с.
// Ульта — крутится на мотоцикле 5 с и бьёт всех вокруг.
// ============================================================

export const SMITANA = {
  maxHp: 4000,
  speed: 5.5,
  shotDamage: 480,
  shotRange: 7.5,
  shotSpeed: 15,
  shotRadius: 0.35,
  throwTime: 0.3,
  releaseAt: 0.45,
  attackCooldown: 0.5,
  autoAim: 8,
  slowMul: 0.55,         // скорость замедленного врага
  slowTime: 3,
  ultDuration: 5,
  ultCooldown: 20,
  spinRadius: 2.4,
  spinTick: 0.5,
  spinDamage: 260,
  spinSpeedMul: 1.15,
};

const creamMat = new THREE.MeshStandardMaterial({ color: 0xfaf8f0, roughness: 0.35 });
const creamGeo = new THREE.BoxGeometry(1, 1, 1);

function creamBlob(size) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(creamGeo, creamMat));
  const top = new THREE.Mesh(creamGeo, creamMat);
  top.scale.setScalar(0.6);
  top.position.set(0.15, 0.45, -0.1);
  g.add(top);
  g.scale.setScalar(size);
  g.traverse((o) => { o.castShadow = true; });
  return g;
}

export function createSmitanaKit(me) {
  const T = SMITANA;
  const chain = createChain();
  const s = {
    throwT: -1, side: 1, released: false, special: false,
    ultT: 0, ultCd: 0, tickT: 0,
  };

  const fire = (world) => {
    const special = s.special;
    const fx = Math.sin(me.facing), fz = Math.cos(me.facing);
    const rx = Math.cos(me.facing), rz = -Math.sin(me.facing);
    world.projectiles.spawn({
      owner: me,
      x: me.pos.x + fx * 0.6 + rx * 0.45 * s.side,
      z: me.pos.z + fz * 0.6 + rz * 0.45 * s.side,
      y: 1.7,
      dirX: fx, dirZ: fz,
      speed: T.shotSpeed,
      range: T.shotRange,
      radius: special ? T.shotRadius * 1.4 : T.shotRadius,
      mesh: creamBlob(special ? 0.42 : 0.3),
      spin: 6,
      onHit(target, p) {
        world.damage(target, T.shotDamage, me, 'hit');
        world.fx.splat(p.x, p.z, special ? 1.1 : 0.6);
        if (special) target.addEffect('slow', T.slowTime, { mul: T.slowMul });
        else chain.hit();
      },
      onEnd(p) {
        world.fx.splat(p.x, p.z, 0.5);
        if (!special) chain.miss();
      },
    });
    if (special) chain.consume();
  };

  return {
    ultAim: 'tap',
    get busy() { return false; },
    get speedMul() { return s.ultT > 0 ? T.spinSpeedMul : 1; },

    attack() { chain.press(); },

    ult() {
      if (!me.canAct() || s.ultCd > 0) return;
      s.ultT = T.ultDuration;
      s.ultCd = T.ultCooldown;
      s.tickT = 0;
      s.throwT = -1;
    },

    update(dt, world) {
      s.ultCd = Math.max(0, s.ultCd - dt);
      s.ultT = Math.max(0, s.ultT - dt);
      if (!me.alive) { s.ultT = 0; s.throwT = -1; chain.clear(); return; }

      // на мотоцикле не стреляет — только крутится
      const free = s.throwT < 0 && s.ultT <= 0 && me.canAct();
      if (chain.tick(dt, free)) {
        const tgt = nearestEnemy(me, world, T.autoAim);
        if (tgt) faceTowards(me, tgt.pos.x, tgt.pos.z);
        s.throwT = 0;
        s.released = false;
        s.special = chain.special;
        s.side = -s.side;
        chain.startCooldown(T.attackCooldown);
      }

      if (s.throwT >= 0) {
        s.throwT += dt / T.throwTime;
        if (!s.released && s.throwT >= T.releaseAt) { s.released = true; fire(world); }
        if (s.throwT >= 1) s.throwT = -1;
      }

      if (s.ultT > 0) {
        s.tickT -= dt;
        if (s.tickT <= 0) {
          s.tickT += T.spinTick;
          for (const e of enemiesInRadius(me, world, me.pos.x, me.pos.z, T.spinRadius)) {
            world.damage(e, T.spinDamage, me, 'hit');
          }
        }
      }
    },

    pose() {
      return {
        spin: s.ultT > 0,
        throw: s.throwT >= 0 ? Math.min(1, s.throwT) : null,
        throwSide: s.side,
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

    // круг, который бьёт вращение, — движок рисует его под героем
    get aura() { return s.ultT > 0 ? T.spinRadius : 0; },
  };
}
