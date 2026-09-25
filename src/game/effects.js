import * as THREE from 'three';
import { createBee } from '../characters/gargashmel.js';

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

    // шмель пикирует в точку и лопается — взрыв уже случился, это его след
    bee(x, z) {
      const bee = createBee();
      bee.root.scale.setScalar(2.2);
      bee.root.position.set(x, 1.4, z);
      bee.root.rotation.x = 0.9;
      add(bee.root, 0.35, (k, age) => {
        bee.animate(age);
        bee.root.position.y = 1.4 - k * 1.2;
        bee.root.scale.setScalar(2.2 * (1 + k * 0.6));
        bee.root.visible = k < 0.85;
      });
    },

    // короткая вспышка-искра на месте удара
    spark(x, y, z, color = 0xffffff) {
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true });
      const m = new THREE.Mesh(cube, mat);
      m.position.set(x, y, z);
      m.rotation.set(0.6, 0.6, 0);
      add(m, 0.18, (k) => { m.scale.setScalar(0.25 + k * 0.5); mat.opacity = 1 - k; });
    },

    update(dt) {
      for (let i = list.length - 1; i >= 0; i--) {
        const e = list[i];
        e.age += dt;
        const k = Math.min(1, e.age / e.life);
        e.update(k, e.age);
        if (k >= 1) {
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
