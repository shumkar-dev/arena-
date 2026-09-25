import { createChain, aimAttack, faceTowards, enemiesInCone, enemiesInRadius } from '../../game/combat.js';
import { createBee } from './model.js';

// ============================================================
// ПРИЁМЫ ГАРГАШМЕЛЯ
// Атака — удар щупальцем вблизи, задевает всех в конусе.
// Третья — такой же удар, после которого базовая атака на 4 с вдвое быстрее.
// Ульта — большой шмель с нарастающим жужжанием летит в выбранную точку
// и взрывается, как только долетает. Точку выбирают, зажав кнопку ульты и оттянув её.
// Пока шмель в пути, точка подсвечена — от него можно успеть убежать.
// ============================================================

export const GARGASHMEL = {
  maxHp: 4000,
  speed: 5.5,
  whipDamage: 520,
  whipReach: 1.7,        // щупальце длиннее кулака Шабы
  whipArc: 1.0,
  whipTime: 0.34,
  hitAt: 0.5,
  attackCooldown: 0.5,
  autoAim: 3.8,
  frenzyTime: 4,
  frenzyMul: 0.5,        // во сколько раз короче удар и перезарядка
  ultCooldown: 20,
  ultRange: 9,
  ultRadius: 2.6,
  ultDamage: 1800,
  castTime: 0.3,
  beeBaseTime: 0.35,     // время полёта шмеля: база + расстояние / скорость
  beeSpeed: 16,
};

export function createGargashmelKit(me) {
  const T = GARGASHMEL;
  const chain = createChain();
  const s = { whipT: -1, side: 1, hitDone: false, special: false, ultCd: 0, castT: -1, bee: null };

  const explode = (world, x, z) => {
    world.fx.explosion(x, z, T.ultRadius, 0xffc23a);
    world.sfx('explosion', { size: 1 });
    for (const e of enemiesInRadius(me, world, x, z, T.ultRadius)) world.damage(e, T.ultDamage, me, 'grab');
  };

  const speedK = () => (me.hasEffect('frenzy') ? T.frenzyMul : 1);

  return {
    ultAim: 'drag',
    ultRange: T.ultRange,
    // форма прицела ульты: круг взрыва в точке на расстоянии до ultRange
    ultShape: { type: 'circle', range: T.ultRange, radius: T.ultRadius },
    // пока идёт атака — смотрит туда, куда целился, а не по джойстику
    get lockFacing() { return s.whipT >= 0 ? s.aimAngle : null; },
    get busy() { return false; },
    get speedMul() { return 1; },

    attack(dir) { chain.press(dir); },
    // форма прицела атаки: конус перед собой
    attackShape() { return { type: 'cone', reach: me.radius + T.whipReach + 0.4, arc: T.whipArc }; },

    // aim — { x, z } точка на земле; дальше радиуса ульты не бросает
    ult(aim, world) {
      if (!me.canAct() || s.ultCd > 0 || !aim) return;
      let dx = aim.x - me.pos.x, dz = aim.z - me.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > T.ultRange) { dx *= T.ultRange / d; dz *= T.ultRange / d; }
      const x = me.pos.x + dx, z = me.pos.z + dz;
      s.ultCd = T.ultCooldown;
      s.castT = 0;
      if (d > 0.5) faceTowards(me, x, z);
      const dur = T.beeBaseTime + Math.min(d, T.ultRange) / T.beeSpeed;
      s.bee = { x, z, t: dur };
      world.fx.flight(createBee(), me.pos.x, me.pos.z, x, z, dur);
      world.fx.marker(x, z, T.ultRadius, dur);
      world.dangers?.push({ x, z, r: T.ultRadius, t: dur, team: me.team });   // боты увидят и уйдут
      world.sfx('beeFlight', { dur });
    },

    update(dt, world) {
      s.ultCd = Math.max(0, s.ultCd - dt);
      if (s.castT >= 0) { s.castT += dt / T.castTime; if (s.castT >= 1) s.castT = -1; }
      // шмель долетел — взрыв; летит, даже если Гаргашмель уже выбыл
      if (s.bee) {
        s.bee.t -= dt;
        if (s.bee.t <= 0) { explode(world, s.bee.x, s.bee.z); s.bee = null; }
      }
      if (!me.alive) { s.whipT = -1; chain.clear(); return; }

      const free = s.whipT < 0 && me.canAct();
      if (chain.tick(dt, free)) {
        aimAttack(me, world, chain.dir, T.autoAim);
        s.aimAngle = me.facing;
        s.whipT = 0;
        s.hitDone = false;
        world.sfx('whip');
        s.special = chain.special;
        s.side = -s.side;
        chain.startCooldown(T.attackCooldown * speedK());
      }

      if (s.whipT >= 0) {
        s.whipT += dt / (T.whipTime * speedK());
        if (!s.hitDone && s.whipT >= T.hitAt) {
          s.hitDone = true;
          const hits = enemiesInCone(me, world, T.whipReach, T.whipArc);
          for (const e of hits) world.damage(e, T.whipDamage, me, 'hit');
          if (hits.length) world.sfx('punch');
          if (s.special) {
            chain.consume();
            me.addEffect('frenzy', T.frenzyTime);
            world.sfx('frenzy');
          } else if (hits.length) chain.hit();
        }
        if (s.whipT >= 1) s.whipT = -1;
      }
    },

    pose() {
      return {
        whip: s.whipT >= 0 ? Math.min(1, s.whipT) : null,
        whipSide: s.side,
        frenzy: me.hasEffect('frenzy'),
        cast: s.castT >= 0 ? s.castT : null,
      };
    },

    hud() {
      return {
        combo: chain.combo,
        ultCd: s.ultCd,
        ultFrac: s.ultCd / T.ultCooldown,
        ultActive: false,
        frenzy: me.hasEffect('frenzy'),
      };
    },
  };
}
