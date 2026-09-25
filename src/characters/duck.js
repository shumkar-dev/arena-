import * as THREE from 'three';
import { box } from '../heroes/blocks.js';

// ============================================================
// УТКА-ТРОФЕЙ — валюта рейтинга. Блочная версия фигурки автора (reference/duck_*.jpg):
// накачанная жёлтая утка, руки на поясе, широкие плечи и трапеции, пресс,
// короткие толстые ноги с перепончатыми лапами, оранжевый клюв, злые чёрные глаза.
// Хвоста нет. Блестит как трофей и стоит на золотом постаменте.
// Смотрит в +Z, стоит на земле (y = 0). { root, animate(t) }
// ============================================================

const gloss = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.05, ...extra });

// брусок между двумя точками (в плоскости XY) — для рук
function segment(x1, y1, x2, y2, w, d, material, z = 0) {
  const dx = x2 - x1, dy = y2 - y1;
  const m = box(w, Math.hypot(dx, dy), d, material, (x1 + x2) / 2, (y1 + y2) / 2, z);
  m.rotation.z = Math.atan2(-dx, dy);
  return m;
}

export function createDuck() {
  const root = new THREE.Group();
  const yellow = gloss(0xffe01a, { emissive: 0x7a5a00 });
  const shade = gloss(0xf5c40a, { emissive: 0x5a3c00 });     // рельеф мышц — чуть темнее
  const beak = gloss(0xff8a1a, { emissive: 0x5a1c00 });
  const beakLow = gloss(0xe8701a);
  const black = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xe8b23a, roughness: 0.22, metalness: 0.7, emissive: 0x3a2400 });
  const plinth = new THREE.MeshStandardMaterial({ color: 0x5a1219, roughness: 0.5 });

  // ---- постамент ----
  root.add(box(1.9, 0.18, 1.5, gold, 0, 0.09, 0));
  root.add(box(1.7, 0.14, 1.3, plinth, 0, 0.25, 0));
  root.add(box(1.76, 0.04, 1.36, gold, 0, 0.34, 0));
  root.add(box(0.7, 0.1, 0.02, gold, 0, 0.25, 0.66));          // табличка

  const body = new THREE.Group();
  body.position.y = 0.36;
  root.add(body);

  // ---- ноги: короткие и толстые, лапы с тремя пальцами ----
  for (const s of [-1, 1]) {
    body.add(box(0.44, 0.1, 0.46, yellow, s * 0.3, 0.05, 0.08));
    for (const t of [-1, 0, 1]) body.add(box(0.12, 0.09, 0.14, yellow, s * 0.3 + t * 0.15, 0.045, 0.36));
    body.add(box(0.28, 0.3, 0.28, yellow, s * 0.29, 0.25, 0));        // голень
    body.add(box(0.26, 0.14, 0.12, shade, s * 0.29, 0.3, -0.14));     // икра
    body.add(box(0.38, 0.34, 0.42, yellow, s * 0.26, 0.54, 0));       // бедро
  }

  // ---- корпус: узкий таз, пресс, широкая грудь (V-силуэт) ----
  body.add(box(0.82, 0.3, 0.56, yellow, 0, 0.74, 0));               // таз
  body.add(box(0.78, 0.42, 0.6, yellow, 0, 1.02, 0));                // живот
  for (let i = 0; i < 3; i++) for (const s of [-1, 1]) {
    body.add(box(0.22, 0.11, 0.06, shade, s * 0.12, 0.88 + i * 0.14, 0.31));   // кубики пресса
  }
  body.add(box(1.22, 0.56, 0.76, yellow, 0, 1.46, 0));               // грудная клетка
  for (const s of [-1, 1]) body.add(box(0.54, 0.34, 0.12, shade, s * 0.28, 1.5, 0.41));   // грудные мышцы
  for (const s of [-1, 1]) body.add(box(0.5, 0.5, 0.1, shade, s * 0.3, 1.4, -0.41));      // широчайшие на спине
  body.add(box(0.92, 0.26, 0.6, yellow, 0, 1.82, -0.02));            // трапеции
  for (const s of [-1, 1]) {
    const trap = box(0.36, 0.2, 0.5, yellow, s * 0.52, 1.78, -0.02);
    trap.rotation.z = s * -0.45;
    body.add(trap);
  }

  // ---- руки на поясе: мощные дельты, локти в стороны, кулаки на бёдрах ----
  const delts = [];
  for (const s of [-1, 1]) {
    const delt = box(0.5, 0.48, 0.54, yellow, s * 0.8, 1.6, 0);
    body.add(delt);
    delts.push(delt);
    const sh = { x: s * 0.88, y: 1.45 }, el = { x: s * 1.14, y: 1.02 }, hand = { x: s * 0.5, y: 0.82 };
    body.add(segment(sh.x, sh.y, el.x, el.y, 0.38, 0.4, yellow));                    // плечо
    body.add(box(0.26, 0.3, 0.2, shade, s * 1.02, 1.26, 0.14));                      // бицепс
    body.add(box(0.26, 0.3, 0.2, shade, s * 1.02, 1.26, -0.14));                     // трицепс
    body.add(segment(el.x, el.y, hand.x, hand.y, 0.34, 0.36, yellow));               // предплечье
    body.add(box(0.3, 0.3, 0.32, yellow, hand.x, hand.y, 0.02));                     // кулак
  }

  // ---- голова: круглая, почти без шеи ----
  const head = new THREE.Group();
  head.position.y = 1.9;
  body.add(head);
  head.add(box(0.8, 0.66, 0.74, yellow, 0, 0.36, 0));
  head.add(box(0.62, 0.14, 0.58, yellow, 0, 0.74, 0));               // макушка — скругление
  head.add(box(0.9, 0.44, 0.6, yellow, 0, 0.32, 0));                 // щёки
  head.add(box(0.56, 0.13, 0.4, beak, 0, 0.26, 0.52));               // клюв сверху — широкий
  head.add(box(0.46, 0.08, 0.34, beakLow, 0, 0.16, 0.48));           // нижний клюв
  for (const s of [-1, 1]) {
    head.add(box(0.11, 0.13, 0.04, black, s * 0.18, 0.46, 0.38));    // глаз
    const brow = box(0.22, 0.05, 0.04, black, s * 0.17, 0.57, 0.38); // злая бровь: к клюву ниже
    brow.rotation.z = s * 0.45;
    head.add(brow);
  }

  const animate = (t) => {
    // трофей «дышит»: чуть раздувается грудь, дельты напрягаются
    const k = (Math.sin(t * 1.8) + 1) / 2;
    for (const d of delts) d.scale.set(1 + k * 0.08, 1 + k * 0.08, 1 + k * 0.08);
    head.rotation.y = Math.sin(t * 0.7) * 0.08;
  };
  animate(0);
  return { root, animate };
}

// ---- картинка утки для интерфейса (вместо эмодзи): рендерится один раз ----
let iconUrl = null;
export function duckIconUrl() {
  if (iconUrl) return iconUrl;
  try {
    const size = 128;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(size, size, false);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xfff4e0, 0x4a2a10, 1.4));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(2, 4, 5);
    scene.add(key);
    const duck = createDuck();
    duck.root.rotation.y = 0.35;
    scene.add(duck.root);
    const cam = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
    cam.position.set(0, 2.0, 7.4);
    cam.lookAt(0, 1.55, 0);
    renderer.render(scene, cam);
    iconUrl = renderer.domElement.toDataURL('image/png');
    scene.traverse((o) => { o.geometry?.dispose(); for (const m of [].concat(o.material ?? [])) m.dispose(); });
    renderer.dispose();
    renderer.forceContextLoss();
  } catch {
    iconUrl = '';
  }
  return iconUrl;
}
