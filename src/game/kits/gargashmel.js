import { createChain, nearestEnemy, faceTowards, enemiesInCone, enemiesInRadius } from '../combat.js';

// ============================================================
// ПРИЁМЫ ГАРГАШМЕЛЯ
// Атака — удар щупальцем вблизи, задевает всех в конусе.
// Третья — такой же удар, после которого базовая атака на 4 с вдвое быстрее.
// Ульта — большой шмель прилетает в выбранную точку и мгновенно взрывается.
// Точку выбирают, зажав кнопку ульты и оттянув её.
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
};

export function createGargashmelKit(me) {
  const T = GARGASHMEL;
  const chain = createChain();
  const s = { whipT: -1, side: 1, hitDone: false, special: false, ultCd: 0, castT: -1 };

  const speedK = () => (me.hasEffect('frenzy') ? T.frenzyMul : 1);

  return {
    ultAim: 'drag',
    ultRange: T.ultRange,
    ultRadius: T.ultRadius,
    get busy() { return false; },
    get speedMul() { return 1; },

    attack() { chain.press(); },

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
      world.fx.explosion(x, z, T.ultRadius, 0xffc23a);
      world.fx.bee(x, z);
      for (const e of enemiesInRadius(me, world, x, z, T.ultRadius)) world.damage(e, T.ultDamage, me, 'grab');
    },

    update(dt, world) {
      s.ultCd = Math.max(0, s.ultCd - dt);
      if (s.castT >= 0) { s.castT += dt / T.castTime; if (s.castT >= 1) s.castT = -1; }
      if (!me.alive) { s.whipT = -1; chain.clear(); return; }

      const free = s.whipT < 0 && me.canAct();
      if (chain.tick(dt, free)) {
        const tgt = nearestEnemy(me, world, T.autoAim);
        if (tgt) faceTowards(me, tgt.pos.x, tgt.pos.z);
        s.whipT = 0;
        s.hitDone = false;
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
          if (s.special) {
            chain.consume();
            me.addEffect('frenzy', T.frenzyTime);
          } else if (hits.length) chain.hit();
          else chain.miss();
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
