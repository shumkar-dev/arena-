import * as THREE from 'three';

// ============================================================
// ПРИЦЕЛ НА ЗЕМЛЕ, как в Brawl Stars: пока кнопка атаки или ульты оттянута,
// под героем видно, куда полетит выстрел или ударит приём.
// Формы (их отдают приёмы героев):
//   { type: 'line', length, width, endRadius? } — выстрел; endRadius — взрыв на конце
//   { type: 'cone', reach, arc }                — удар или струя сектором ±arc
//   { type: 'circle', range, radius }           — удар по точке (ульта Гаргашмеля)
// ============================================================

const Y = 0.06;

export function createAim(scene) {
  const flat = (geo, color, opacity) => {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2;
    m.renderOrder = 2;
    return m;
  };

  // полоса единичной длины вдоль +Z от начала координат
  const lineGeo = new THREE.PlaneGeometry(1, 1);
  lineGeo.translate(0, -0.5, 0);
  const ringGeo = new THREE.RingGeometry(0.9, 1, 48);
  const discGeo = new THREE.CircleGeometry(1, 40);
  // сектор с центром на +Z: после поворота плоскости угол θ смотрит в (cos θ, −sin θ)
  const sectors = new Map();
  const sectorGeo = (arc) => {
    const key = arc.toFixed(3);
    if (!sectors.has(key)) sectors.set(key, new THREE.CircleGeometry(1, 28, -Math.PI / 2 - arc, arc * 2));
    return sectors.get(key);
  };
  // яркая кромка сектора — дуга по краю досягаемости
  const edges = new Map();
  const edgeGeo = (arc) => {
    const key = arc.toFixed(3);
    if (!edges.has(key)) edges.set(key, new THREE.RingGeometry(0.93, 1, 28, 1, -Math.PI / 2 - arc, arc * 2));
    return edges.get(key);
  };

  const make = (color) => {
    const g = new THREE.Group();
    g.visible = false;
    const line = flat(lineGeo, color, 0.5);
    const cone = flat(sectorGeo(1), color, 0.45);
    const coneEdge = flat(edgeGeo(1), color, 0.95);
    const endFill = flat(discGeo, color, 0.25);
    const endRing = flat(ringGeo, color, 0.85);
    g.add(line, cone, coneEdge, endFill, endRing);
    scene.add(g);
    return { g, line, cone, coneEdge, endFill, endRing };
  };

  const attack = make(0xffffff);
  const ult = make(0xffc23a);
  const area = make(0xfffbe8);   // зона действующей ульты (струя сметаны)
  const range = flat(ringGeo, 0xffffff, 0.3);
  range.visible = false;
  scene.add(range);

  // нарисовать форму shape от точки pos в сторону angle (рад, как facing)
  const draw = (set, shape, pos, angle, point) => {
    const { g, line, cone, coneEdge, endFill, endRing } = set;
    g.visible = true;
    g.position.set(pos.x, Y, pos.z);
    g.rotation.y = angle;
    line.visible = cone.visible = coneEdge.visible = endFill.visible = endRing.visible = false;

    if (shape.type === 'line') {
      line.visible = true;
      line.scale.set(shape.width, shape.length, 1);
      if (shape.endRadius) {
        endFill.visible = endRing.visible = true;
        endFill.position.set(0, 0, shape.length);
        endRing.position.set(0, 0, shape.length);
        endFill.scale.setScalar(shape.endRadius);
        endRing.scale.setScalar(shape.endRadius);
      }
    } else if (shape.type === 'cone') {
      cone.visible = coneEdge.visible = true;
      cone.geometry = sectorGeo(shape.arc);
      coneEdge.geometry = edgeGeo(shape.arc);
      cone.scale.setScalar(shape.reach);
      coneEdge.scale.setScalar(shape.reach);
    } else if (shape.type === 'circle') {
      // круг — в мировой точке point, а не от героя
      g.position.set(point.x, Y, point.z);
      g.rotation.y = 0;
      endFill.visible = endRing.visible = true;
      endFill.position.set(0, 0, 0);
      endRing.position.set(0, 0, 0);
      endFill.scale.setScalar(shape.radius);
      endRing.scale.setScalar(shape.radius);
      range.visible = true;
      range.position.set(pos.x, Y, pos.z);
      range.scale.setScalar(shape.range);
    }
  };

  return {
    showAttack(shape, pos, angle) { draw(attack, shape, pos, angle); },
    showUlt(shape, pos, angle, point) { range.visible = false; draw(ult, shape, pos, angle, point); },
    showArea(shape, pos, angle) { draw(area, shape, pos, angle); },
    hideArea() { area.g.visible = false; },
    hideAttack() { attack.g.visible = false; },
    hideUlt() { ult.g.visible = false; range.visible = false; },
  };
}
