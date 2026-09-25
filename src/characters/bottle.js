import * as THREE from 'three';
import { mat, box } from '../heroes/blocks.js';

// ============================================================
// БУТЫЛКА «СУЛТАН ЧАЯ» — цель режима 2 на 2. Блочная, большая.
// Пока временная версия: автор пришлёт фото, по нему сделаем точную.
// team — чья бутылка (цвет крышки и ободка).
// ============================================================

function labelTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#1f7a3a'; g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#f2c14e'; g.fillRect(0, 10, 256, 8); g.fillRect(0, 110, 256, 8);
  g.fillStyle = '#fff4dc';
  g.font = 'bold 44px Oswald, Arial Narrow, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('СУЛТАН', 128, 48);
  g.font = 'bold 34px Oswald, Arial Narrow, sans-serif';
  g.fillStyle = '#f2c14e';
  g.fillText('ЧАЙ', 128, 88);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createBottle(team = 'blue') {
  const teamColor = team === 'blue' ? 0x3fa8ff : 0xe0342f;
  const M = {
    glass: new THREE.MeshStandardMaterial({ color: 0x8a4a12, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.88 }),
    tea:   mat(0xb8661a, 0.4),
    cap:   mat(teamColor, 0.5),
    ring:  mat(teamColor, 0.5),
    shine: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1, transparent: true, opacity: 0.35 }),
    label: new THREE.MeshStandardMaterial({ map: labelTexture(), roughness: 0.7 }),
    labelSide: mat(0x1f7a3a, 0.7),
  };

  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  // корпус: низ шире, плечи сужаются к горлышку
  body.add(box(1.3, 1.9, 1.3, M.glass, 0, 0.95, 0));
  body.add(box(1.16, 1.5, 1.16, M.tea, 0, 0.8, 0));                 // чай внутри
  body.add(box(1.1, 0.35, 1.1, M.glass, 0, 2.07, 0));               // плечи
  body.add(box(0.8, 0.3, 0.8, M.glass, 0, 2.38, 0));
  body.add(box(0.5, 0.55, 0.5, M.glass, 0, 2.8, 0));                // горлышко
  body.add(box(0.6, 0.28, 0.6, M.cap, 0, 3.2, 0));                  // крышка команды
  body.add(box(1.34, 0.12, 1.34, M.ring, 0, 0.06, 0));              // ободок команды у дна
  // этикетка на все четыре стороны (верх и низ — просто зелёные)
  const label = new THREE.Mesh(new THREE.BoxGeometry(1.34, 0.72, 1.34), [M.label, M.label, M.labelSide, M.labelSide, M.label, M.label]);
  label.position.y = 1.0;
  label.castShadow = true;
  body.add(label);
  // блик на стекле
  body.add(box(0.12, 1.4, 0.02, M.shine, -0.4, 1.05, 0.67));

  // лёгкое покачивание — живая цель
  const animate = ({ t }) => { body.rotation.z = Math.sin(t * 1.1 + (team === 'blue' ? 0 : 1)) * 0.01; };

  return { root, animate };
}
