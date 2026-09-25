import * as THREE from 'three';
import { pointBlocked } from './arena.js';

// ============================================================
// ОБЩЕЕ ДЛЯ ПРИЁМОВ: поиск целей, серия атак, снаряды.
// ============================================================

export const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// враги — кого выбирать целью (прохожие-нейтралы не враги: в них не целятся)
export const enemiesOf = (me, world) => world.fighters.filter((f) => f !== me && f.alive && f.team !== me.team && !f.neutral);

// кого задевает удар или взрыв — враги и прохожие (они живое укрытие)
export const hittablesOf = (me, world) => world.fighters.filter((f) => f !== me && f.alive && f.team !== me.team);

export const dist2d = (a, b) => Math.hypot(b.pos.x - a.pos.x, b.pos.z - a.pos.z);

export function nearestEnemy(me, world, maxDist = Infinity) {
  let best = null, bestD = maxDist;
  for (const e of enemiesOf(me, world)) {
    const d = dist2d(me, e);
    if (d < bestD) { best = e; bestD = d; }
  }
  return best;
}

export const faceTowards = (me, x, z) => { me.facing = Math.atan2(x - me.pos.x, z - me.pos.z); };

// навести атаку: по направлению с кнопки, а без него — в ближайшего врага в радиусе autoAim
export function aimAttack(me, world, dir, autoAim) {
  if (dir) { me.facing = Math.atan2(dir.x, dir.z); return; }
  const tgt = nearestEnemy(me, world, autoAim);
  if (tgt) faceTowards(me, tgt.pos.x, tgt.pos.z);
}

// враги в конусе перед бойцом: reach — досягаемость сверх радиусов обоих
export function enemiesInCone(me, world, reach, arc) {
  const out = [];
  for (const e of hittablesOf(me, world)) {
    const dx = e.pos.x - me.pos.x, dz = e.pos.z - me.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > me.radius + e.radius + reach) continue;
    if (d > 0.01 && Math.abs(wrapAngle(Math.atan2(dx, dz) - me.facing)) > arc) continue;
    out.push({ e, d });
  }
  return out.sort((a, b) => a.d - b.d).map((o) => o.e);
}

// нет ли укрытия на отрезке между точками — струя и лучи через стены не проходят
export function lineClear(x1, z1, x2, z2) {
  const d = Math.hypot(x2 - x1, z2 - z1);
  const n = Math.max(1, Math.ceil(d / 0.3));
  for (let i = 1; i < n; i++) {
    const t = i / n;
    if (pointBlocked(x1 + (x2 - x1) * t, z1 + (z2 - z1) * t, 0)) return false;
  }
  return true;
}

// враги в круге (x, z, r) — для взрывов и вращений
export function enemiesInRadius(me, world, x, z, r) {
  return hittablesOf(me, world).filter((e) => Math.hypot(e.pos.x - x, e.pos.z - z) <= r + e.radius);
}

/**
 * Серия атак: нажатие ставится в очередь, пока идёт прошлая атака;
 * каждое попадание продвигает серию, долгая пауза без атак сбрасывает её
 * (промах не сбрасывает — иначе против уворачивающегося врага третьей атаки не дождаться).
 * Третья атака (combo === 2) — особая.
 */
export function createChain({ reset = 2.2, queueTime = 0.35 } = {}) {
  const c = { combo: 0, idle: 0, cd: 0, queued: 0, dir: null };
  return {
    get combo() { return c.combo; },
    get special() { return c.combo >= 2; },
    // направление последнего нажатия: { x, z } или null — автоприцел
    get dir() { return c.dir; },
    press(dir = null) { c.queued = queueTime; c.dir = dir; },
    // вызывать каждый кадр; вернёт true, когда пора начать атаку
    tick(dt, free) {
      c.cd = Math.max(0, c.cd - dt);
      if (free) {
        c.idle += dt;
        if (c.idle > reset) c.combo = 0;
      }
      if (c.queued <= 0) return false;
      if (free && c.cd <= 0) { c.queued = 0; c.idle = 0; return true; }
      c.queued = Math.max(0, c.queued - dt);
      return false;
    },
    startCooldown(t) { c.cd = t; },
    hit() { c.combo = Math.min(2, c.combo + 1); },
    // особая атака потрачена
    consume() { c.combo = 0; },
    clear() { c.combo = 0; c.queued = 0; c.idle = 0; },
  };
}

// ---------------- СНАРЯДЫ ----------------
// Летят по земле на высоте y, упираются в укрытия, попадают во врагов владельца.

const tmpDir = new THREE.Vector2();

export function createProjectiles(scene) {
  const list = [];

  return {
    list,
    /**
     * opts: { owner, x, z, y, dirX, dirZ, speed, range, radius, mesh,
     *         onHit(target, p), onEnd(p) — промах: упёрся в стену или долетел }
     */
    spawn(opts) {
      tmpDir.set(opts.dirX, opts.dirZ).normalize();
      const p = {
        ...opts,
        x: opts.x, z: opts.z, y: opts.y ?? 1.3,
        vx: tmpDir.x * opts.speed, vz: tmpDir.y * opts.speed,
        travelled: 0, dead: false, age: 0,
      };
      if (p.mesh) {
        p.mesh.position.set(p.x, p.y, p.z);
        p.mesh.rotation.y = Math.atan2(p.vx, p.vz);
        scene.add(p.mesh);
      }
      list.push(p);
      return p;
    },

    update(dt, world) {
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        // несколько подшагов, чтобы быстрый снаряд не проскочил врага
        const steps = Math.max(1, Math.ceil((p.speed * dt) / 0.3));
        const sdt = dt / steps;
        for (let s = 0; s < steps && !p.dead; s++) {
          p.x += p.vx * sdt;
          p.z += p.vz * sdt;
          p.travelled += p.speed * sdt;
          for (const e of world.fighters) {
            if (e === p.owner || !e.alive || e.team === p.owner.team) continue;
            if (Math.hypot(e.pos.x - p.x, e.pos.z - p.z) <= e.radius + p.radius) {
              p.dead = true;
              p.onHit?.(e, p);
              break;
            }
          }
          if (!p.dead && (pointBlocked(p.x, p.z, p.radius * 0.5) || p.travelled >= p.range)) {
            p.dead = true;
            p.onEnd?.(p);
          }
        }
        p.age += dt;
        if (p.mesh) {
          p.mesh.position.set(p.x, p.y, p.z);
          p.spin && (p.mesh.rotation.x += dt * p.spin);
        }
        if (p.dead) {
          if (p.mesh) scene.remove(p.mesh);
          list.splice(i, 1);
        }
      }
    },

    clear() {
      for (const p of list) if (p.mesh) scene.remove(p.mesh);
      list.length = 0;
    },
  };
}
