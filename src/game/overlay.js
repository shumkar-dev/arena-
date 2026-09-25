import * as THREE from 'three';

// ============================================================
// ОВЕРЛЕЙ НАД СЦЕНОЙ — HTML поверх канваса:
// полоски ХП над головами и всплывающие цифры урона.
// Позиции пересчитываются из 3D каждый кадр.
// ============================================================

const NUMBER_LIFE = 0.9;
const STATUS_ICONS = { slow: '🐌', frenzy: '⚡', cig: '🚬' };
const v = new THREE.Vector3();

export function createOverlay(mount) {
  const root = document.createElement('div');
  root.className = 'overlay';
  mount.appendChild(root);

  const bars = new Map();   // fighter.id → { el, fill, text, lastHp }
  const numbers = [];       // { el, x, y, z, age }

  const barFor = (f) => {
    let b = bars.get(f.id);
    if (!b) {
      const el = document.createElement('div');
      el.className = `hpbar ${f.side === 'self' || f.side === 'ally' ? 'ally' : f.side}`;
      el.innerHTML = `<div class="hpbar-name"><span class="hpbar-status"></span><span class="hpbar-label"></span></div><div class="hpbar-track"><div class="hpbar-fill"></div><div class="hpbar-text"></div></div>`;
      el.querySelector('.hpbar-label').textContent = f.name;
      root.appendChild(el);
      b = { el, fill: el.querySelector('.hpbar-fill'), text: el.querySelector('.hpbar-text'), status: el.querySelector('.hpbar-status'), lastHp: -1, lastStatus: '' };
      bars.set(f.id, b);
    }
    return b;
  };

  // экранные координаты точки мира; null — если за камерой
  const toScreen = (camera, x, y, z, w, h) => {
    v.set(x, y, z).project(camera);
    if (v.z > 1) return null;
    return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h };
  };

  return {
    // kind: hit | grab | taken | text
    spawnNumber(f, amount, kind) {
      const el = document.createElement('div');
      el.className = `dmg dmg-${kind}`;
      el.textContent = amount;
      root.appendChild(el);
      numbers.push({ el, x: f.pos.x + (Math.random() - 0.5) * 0.6, y: f.headY + 0.4 + f.lift, z: f.pos.z, age: 0 });
    },

    update(dt, camera, fighters) {
      const w = mount.clientWidth, h = mount.clientHeight;

      for (const f of fighters) {
        const b = barFor(f);
        const p = f.alive ? toScreen(camera, f.pos.x, f.headY + f.lift, f.pos.z, w, h) : null;
        if (!p) { b.el.style.display = 'none'; continue; }
        b.el.style.display = '';
        b.el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
        const status = Object.keys(f.effects).map((k) => STATUS_ICONS[k] ?? '').join('');
        if (status !== b.lastStatus) { b.lastStatus = status; b.status.textContent = status; }
        if (b.lastHp !== f.hp) {
          b.lastHp = f.hp;
          b.fill.style.width = `${(f.hp / f.maxHp) * 100}%`;
          b.text.textContent = f.hp;
        }
      }

      for (let i = numbers.length - 1; i >= 0; i--) {
        const n = numbers[i];
        n.age += dt;
        if (n.age >= NUMBER_LIFE) { n.el.remove(); numbers.splice(i, 1); continue; }
        const p = toScreen(camera, n.x, n.y + n.age * 1.6, n.z, w, h);
        if (!p) continue;
        const k = n.age / NUMBER_LIFE;
        const pop = n.age < 0.12 ? 1 + (1 - n.age / 0.12) * 0.6 : 1;
        n.el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) scale(${pop.toFixed(2)})`;
        n.el.style.opacity = k > 0.6 ? String(1 - (k - 0.6) / 0.4) : '1';
      }
    },

    dispose() { root.remove(); },
  };
}
