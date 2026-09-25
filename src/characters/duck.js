import * as THREE from 'three';
import { mat, box } from '../heroes/blocks.js';

// ============================================================
// НАКАЧАННАЯ УТКА — фигурка, валюта рейтинга. Временная блочная версия
// (автор пришлёт фото — переделаем). Стоит на золотой подставке и играет бицепсами.
// Смотрит в +Z, стоит на земле (y = 0). { root, animate(t) }
// ============================================================

export function createDuck() {
  const root = new THREE.Group();
  const yellow = mat(0xffd23a, 0.7);
  const yellowDark = mat(0xe8b21f, 0.7);
  const orange = mat(0xff8a1f, 0.6);
  const white = mat(0xffffff, 0.5);
  const black = mat(0x1a1a1a, 0.5);
  const red = mat(0xd8282f, 0.7);
  const gold = new THREE.MeshStandardMaterial({ color: 0xf2c14e, roughness: 0.3, metalness: 0.5 });

  // подставка
  root.add(box(1.7, 0.22, 1.3, gold, 0, 0.11, 0));
  root.add(box(1.5, 0.1, 1.1, mat(0x7a1620, 0.6), 0, 0.27, 0));

  const body = new THREE.Group();
  body.position.y = 0.32;
  root.add(body);

  // лапы
  for (const s of [-1, 1]) {
    body.add(box(0.14, 0.4, 0.14, orange, s * 0.28, 0.2, 0));
    body.add(box(0.34, 0.08, 0.42, orange, s * 0.28, 0.04, 0.1));
  }
  // корпус: широкая грудь, узкая талия, хвост
  body.add(box(0.8, 0.45, 0.7, yellow, 0, 0.62, 0));                  // живот
  body.add(box(1.25, 0.7, 0.85, yellow, 0, 1.15, 0));                 // грудь
  for (const s of [-1, 1]) body.add(box(0.5, 0.36, 0.1, yellowDark, s * 0.28, 1.2, 0.43));   // грудные мышцы
  for (let i = 0; i < 3; i++) for (const s of [-1, 1]) body.add(box(0.2, 0.12, 0.06, yellowDark, s * 0.12, 0.5 + i * 0.15, 0.36)); // пресс
  const tail = box(0.5, 0.3, 0.3, yellow, 0, 0.8, -0.5);             // хвост
  tail.rotation.x = -0.6;
  body.add(tail);

  // голова
  const head = new THREE.Group();
  head.position.y = 1.5;
  body.add(head);
  head.add(box(0.72, 0.62, 0.66, yellow, 0, 0.36, 0));
  head.add(box(0.5, 0.14, 0.42, orange, 0, 0.26, 0.5));               // клюв
  head.add(box(0.46, 0.08, 0.36, mat(0xe0701a, 0.6), 0, 0.16, 0.46));
  for (const s of [-1, 1]) {
    head.add(box(0.16, 0.16, 0.04, white, s * 0.18, 0.46, 0.34));
    head.add(box(0.08, 0.1, 0.04, black, s * 0.16, 0.44, 0.36));
    const brow = box(0.22, 0.05, 0.04, black, s * 0.18, 0.58, 0.34);   // суровые брови
    brow.rotation.z = s * -0.35;
    head.add(brow);
  }
  head.add(box(0.76, 0.12, 0.7, red, 0, 0.6, 0));                      // повязка
  const knot = box(0.1, 0.24, 0.06, red, -0.2, 0.52, -0.38);
  knot.rotation.z = 0.5;
  head.add(knot);

  // крылья-руки в позе «двойной бицепс»: плечо в сторону, предплечье вверх
  const arms = [-1, 1].map((s) => {
    const sh = new THREE.Group();
    sh.position.set(s * 0.62, 1.3, 0);
    body.add(sh);
    sh.add(box(0.55, 0.3, 0.32, yellow, s * 0.27, 0, 0));             // плечо
    const bicep = box(0.3, 0.2, 0.3, yellowDark, s * 0.3, 0.16, 0);   // бицепс
    sh.add(bicep);
    const el = new THREE.Group();
    el.position.set(s * 0.52, 0, 0);
    sh.add(el);
    el.add(box(0.28, 0.55, 0.3, yellow, 0, 0.3, 0));                  // предплечье
    el.add(box(0.34, 0.2, 0.34, yellowDark, 0, 0.62, 0));             // кончик крыла — «кулак»
    return { el, bicep };
  });

  const animate = (t) => {
    const flex = (Math.sin(t * 2.2) + 1) / 2;
    arms.forEach(({ el, bicep }, i) => {
      const s = i ? 1 : -1;
      el.rotation.z = s * (0.1 + flex * 0.4);
      bicep.scale.set(1 + flex * 0.3, 1 + flex * 0.5, 1 + flex * 0.3);
    });
    body.position.y = 0.32 + flex * 0.03;
    head.rotation.y = Math.sin(t * 0.9) * 0.15;
  };
  animate(0);
  return { root, animate };
}
