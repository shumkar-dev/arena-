import * as THREE from 'three';
import { createBee } from '../characters/gargashmel.js';
import { pointBlocked } from './arena.js';

// ============================================================
// ВИЗУАЛЬНЫЕ ЭФФЕКТЫ — живут несколько десятых секунды и исчезают.
// На урон не влияют: урон считают приёмы героев.
// ============================================================

const cube = new THREE.BoxGeometry(1, 1, 1);
const ringGeo = new THREE.RingGeometry(0.85, 1, 40);

export function createEffects(scene) {
  const list = [];   // { obj, age, life, update(k, age) }

  const add = (obj, life, update) => {
    scene.add(obj);
    list.push({ obj, age: 0, life, update });
  };

  const fx = {
    // блочный взрыв: облако кубиков + кольцо по земле
    explosion(x, z, radius, color = 0xffb03a) {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true });
      const dark = new THREE.MeshBasicMaterial({ color: 0x3a2a1a, transparent: true });
      const bits = [];
      const n = Math.round(10 + radius * 6);
      for (let i = 0; i < n; i++) {
        const m = new THREE.Mesh(cube, i % 4 === 0 ? dark : mat);
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
        const r = Math.random() * radius * 0.9;
        m.userData.to = new THREE.Vector3(Math.sin(a) * r, 0.3 + Math.random() * radius * 0.8, Math.cos(a) * r);
        m.userData.s = 0.25 + Math.random() * 0.35 * radius;
        g.add(m);
        bits.push(m);
      }
      const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.05;
      g.add(ring);
      add(g, 0.55, (k) => {
        const e = 1 - (1 - k) * (1 - k);
        for (const b of bits) {
          b.position.copy(b.userData.to).multiplyScalar(e);
          b.scale.setScalar(b.userData.s * (1 - k * 0.6));
        }
        mat.opacity = dark.opacity = 1 - k;
        ring.scale.setScalar(radius * e);
        ringMat.opacity = 0.8 * (1 - k);
      });
    },

    // лужа сметаны на месте попадания
    splat(x, z, size = 0.8) {
      const mat = new THREE.MeshStandardMaterial({ color: 0xfaf8f0, roughness: 0.4, transparent: true });
      const g = new THREE.Group();
      g.position.set(x, 0.03, z);
      for (let i = 0; i < 5; i++) {
        const m = new THREE.Mesh(cube, mat);
        m.scale.set(size * (0.4 + Math.random() * 0.5), 0.04, size * (0.4 + Math.random() * 0.5));
        m.position.set((Math.random() - 0.5) * size, 0, (Math.random() - 0.5) * size);
        g.add(m);
      }
      add(g, 1.4, (k) => { mat.opacity = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4; });
    },

    // шмель летит дугой из (x0, z0) в (x1, z1) за dur секунд и в конце пикирует в землю
    beeFlight(x0, z0, x1, z1, dur) {
      const bee = createBee();
      bee.root.scale.setScalar(2.2);
      const yaw = Math.atan2(x1 - x0, z1 - z0);
      add(bee.root, dur, (k, age) => {
        bee.animate(age);
        const e = k * k * (3 - 2 * k);                    // плавный разгон и торможение
        bee.root.position.set(
          x0 + (x1 - x0) * e + Math.sin(age * 9) * 0.12,  // лёгкое рыскание
          3.2 + Math.sin(k * Math.PI) * 1.6 - k * k * 2.6, // дуга и пике к земле
          z0 + (z1 - z0) * e,
        );
        bee.root.rotation.set(0.15 + k * k * 0.9, yaw, Math.sin(age * 7) * 0.12);
      });
    },

    // пульсирующий круг на земле: сюда прилетит удар
    marker(x, z, radius, dur, color = 0xffc23a) {
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide, depthWrite: false });
      const ring = new THREE.Mesh(ringGeo, mat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, 0.07, z);
      ring.scale.setScalar(radius);
      add(ring, dur, (k, age) => { mat.opacity = 0.45 + Math.sin(age * 18) * 0.35; });
    },

    // короткая вспышка-искра на месте удара
    spark(x, y, z, color = 0xffffff) {
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true });
      const m = new THREE.Mesh(cube, mat);
      m.position.set(x, y, z);
      m.rotation.set(0.6, 0.6, 0);
      add(m, 0.18, (k) => { m.scale.setScalar(0.25 + k * 0.5); mat.opacity = 1 - k; });
    },

    // струя сметаны (ульта Смитаны): поток белых кубиков конусом.
    // Вернёт { emit(x, y, z, angle, arc, reach, dt), stop() }; частицы упираются в укрытия.
    stream() {
      const mat = new THREE.MeshStandardMaterial({ color: 0xfbfaf4, roughness: 0.35, transparent: true });
      const g = new THREE.Group();
      const parts = [];
      let acc = 0, stopped = false;
      const SPEED = 12;
      const handle = {
        emit(x, y, z, angle, arc, reach, dt) {
          acc += dt * 110;   // частиц в секунду
          while (acc >= 1) {
            acc -= 1;
            const a = angle + (Math.random() * 2 - 1) * arc * 0.85;
            const m = parts.find((p) => !p.visible) ?? (() => {
              const n = new THREE.Mesh(cube, mat);
              n.castShadow = true;
              g.add(n); parts.push(n);
              return n;
            })();
            m.visible = true;
            m.position.set(x, y, z);
            m.userData.vx = Math.sin(a) * SPEED;
            m.userData.vz = Math.cos(a) * SPEED;
            m.userData.vy = -2.2 - Math.random() * 1.5;   // струя провисает к земле
            m.userData.age = 0;
            m.userData.life = reach / SPEED;
            m.rotation.set(Math.random() * 3, Math.random() * 3, 0);
          }
        },
        stop() { stopped = true; },
      };
      add(g, Infinity, (k, age) => {
        const dt = age - (g.userData.last ?? age);
        g.userData.last = age;
        let alive = 0;
        for (const m of parts) {
          if (!m.visible) continue;
          const u = m.userData;
          u.age += dt;
          m.position.x += u.vx * dt;
          m.position.z += u.vz * dt;
          m.position.y = Math.max(0.15, m.position.y + u.vy * dt);
          const t = u.age / u.life;
          m.scale.setScalar(0.3 + t * 0.75);   // струя расширяется и густеет к концу
          if (t >= 1 || pointBlocked(m.position.x, m.position.z, 0.05)) m.visible = false;
          else alive++;
        }
        mat.opacity = 0.95;
        // закончить эффект, когда струю выключили и последние капли долетели
        if (stopped && alive === 0) g.userData.done = true;
      });
      return handle;
    },

    update(dt) {
      for (let i = list.length - 1; i >= 0; i--) {
        const e = list[i];
        e.age += dt;
        const k = Math.min(1, e.age / e.life);
        e.update(k, e.age);
        if (k >= 1 || e.obj.userData.done) {
          scene.remove(e.obj);
          e.obj.traverse((o) => {
            if (o.material) o.material.dispose();
            if (o.geometry && o.geometry !== cube && o.geometry !== ringGeo) o.geometry.dispose();
          });
          list.splice(i, 1);
        }
      }
    },
  };
  return fx;
}
