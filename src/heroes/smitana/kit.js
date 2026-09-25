import * as THREE from 'three';
import { createChain, aimAttack, enemiesInCone, lineClear } from '../../game/combat.js';

// ============================================================
// ПРИЁМЫ СМИТАНЫ
// Атака — сметана, средняя дальность. Третья — сметана, которая замедляет на 3 с.
// Ульта — сметанамёт: 3 с густая струя конусом перед собой, урон всем в конусе
// каждые 0,3 с. Можно двигаться; струя смотрит туда же, куда Смитана, а оттяжкой
// кнопки атаки её можно развернуть. Укрытия струю гасят.
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
  ultDuration: 3,
  ultCooldown: 20,
  sprayReach: 4.6,       // досягаемость струи сверх радиусов
  sprayArc: 0.42,        // ±рад — ширина конуса
  sprayTick: 0.3,
  sprayDamage: 220,
  sprayMoveMul: 0.8,     // со сметанамётом в руках бежит чуть медленнее
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
    ultT: 0, ultCd: 0, tickT: 0, stream: null,
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
        world.sfx(special ? 'boing' : 'splat');
        if (special) target.addEffect('slow', T.slowTime, { mul: T.slowMul });
        else chain.hit();
      },
      onEnd(p) {
        world.fx.splat(p.x, p.z, 0.5);
        world.sfx('splat');
      },
    });
    if (special) chain.consume();
  };

  const stopStream = () => { s.stream?.stop(); s.stream = null; };

  const kit = {
    ultAim: 'drag',
    ultRange: T.sprayReach,
    ultAutoRange: 8,       // короткое касание ульты разворачивает струю к врагу в этом радиусе
    // форма прицела ульты: конус струи в выбранную сторону
    ultShape: { type: 'cone', reach: me.radius + T.sprayReach, arc: T.sprayArc },
    // пока идёт атака — смотрит туда, куда целился, а не по джойстику
    get lockFacing() { return s.throwT >= 0 ? s.aimAngle : null; },
    get busy() { return false; },
    get speedMul() { return s.ultT > 0 ? T.sprayMoveMul : 1; },

    attack(dir) {
      // во время ульты кнопка атаки только разворачивает струю
      if (s.ultT > 0) { if (dir) me.facing = Math.atan2(dir.x, dir.z); return; }
      chain.press(dir);
    },
    // форма прицела атаки: линия полёта сметаны; во время ульты — конус струи
    attackShape() {
      if (s.ultT > 0) return kit.ultShape;
      return { type: 'line', length: T.shotRange, width: (chain.special ? T.shotRadius * 1.4 : T.shotRadius) * 2 };
    },
    // пока бьёт струя — её конус виден на земле
    activeArea() { return s.ultT > 0 ? kit.ultShape : null; },

    // aim — { x, z } точка на земле; нужна только сторона струи
    ult(aim, world) {
      if (!me.canAct() || s.ultCd > 0) return;
      if (aim) me.facing = Math.atan2(aim.x - me.pos.x, aim.z - me.pos.z);
      s.ultT = T.ultDuration;
      s.ultCd = T.ultCooldown;
      s.tickT = 0;
      s.throwT = -1;
      chain.clear();
      stopStream();
      s.stream = world.fx.stream();
      world.sfx('sprayStart');
    },

    update(dt, world) {
      s.ultCd = Math.max(0, s.ultCd - dt);
      s.ultT = Math.max(0, s.ultT - dt);
      if (!me.alive) { s.ultT = 0; s.throwT = -1; chain.clear(); }
      if (s.ultT <= 0 && s.stream) { stopStream(); world.sfx('sprayStop'); }
      if (!me.alive) return;

      const free = s.throwT < 0 && s.ultT <= 0 && me.canAct();
      if (chain.tick(dt, free)) {
        aimAttack(me, world, chain.dir, T.autoAim);
        s.aimAngle = me.facing;
        s.throwT = 0;
        s.released = false;
        s.special = chain.special;
        s.side = -s.side;
        chain.startCooldown(T.attackCooldown);
      }

      if (s.throwT >= 0) {
        s.throwT += dt / T.throwTime;
        if (!s.released && s.throwT >= T.releaseAt) { s.released = true; fire(world); world.sfx('throw'); }
        if (s.throwT >= 1) s.throwT = -1;
      }

      if (s.ultT > 0) {
        // струя из ладоней, по направлению взгляда
        const fx = Math.sin(me.facing), fz = Math.cos(me.facing);
        const nx = me.pos.x + fx * 0.95, nz = me.pos.z + fz * 0.95;
        s.stream.emit(nx, 2.0, nz, me.facing, T.sprayArc, me.radius + T.sprayReach, dt);
        s.tickT -= dt;
        if (s.tickT <= 0) {
          s.tickT += T.sprayTick;
          for (const e of enemiesInCone(me, world, T.sprayReach, T.sprayArc)) {
            if (lineClear(me.pos.x, me.pos.z, e.pos.x, e.pos.z)) world.damage(e, T.sprayDamage, me, 'hit');
          }
        }
      }
    },

    pose() {
      return {
        spray: s.ultT > 0,
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
        steer: s.ultT > 0,
      };
    },
  };
  return kit;
}
