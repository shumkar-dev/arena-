import * as THREE from 'three';

// ============================================================
// ГОРИЛЛА — игровая модель по процедурной модели автора (превью GorillaPreview):
// бочкообразная грудь, горб, гребень на голове, длинные руки с кулаками.
// Для телефона: без шерсти (furZones), меньше сегментов, тени — только у крупных
// частей. Цвета чуть светлее превью, чтобы на арене не сливалась в чёрное пятно.
// Модель смотрит в +Z, стоит на земле (y = 0), рост ≈ 2,6.
// ============================================================

const SCALE = 0.9;

// лёгкий шум по вершинам — убирает «идеальность» примитивов (как в превью)
function roughen(geo, amp) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = Math.sin(x * 7.3 + y * 4.1) * Math.cos(z * 6.7 - y * 3.3) + Math.sin(y * 11.2 + z * 5.5) * 0.5;
    const l = Math.sqrt(x * x + y * y + z * z) || 1;
    p.setXYZ(i, x + (x / l) * n * amp, y + (y / l) * n * amp, z + (z / l) * n * amp);
  }
  geo.computeVertexNormals();
  return geo;
}

export function createGorilla() {
  const M = {
    body: new THREE.MeshStandardMaterial({ color: 0x2c2a33, roughness: 0.95 }),
    face: new THREE.MeshStandardMaterial({ color: 0x3e3233, roughness: 0.6 }),
    silver: new THREE.MeshStandardMaterial({ color: 0x6a6a76, roughness: 1, flatShading: true }),
    eye: new THREE.MeshStandardMaterial({ color: 0x2b1a10, roughness: 0.25 }),
    glint: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  };

  // shadow — отбрасывает ли тень (только крупные части)
  const blob = (rx, ry, rz, mat, { amp = 0.03, seg = 12, shadow = true } = {}) => {
    const g = new THREE.SphereGeometry(1, seg, Math.max(6, seg - 2));
    g.scale(rx, ry, rz);
    roughen(g, amp);
    const m = new THREE.Mesh(g, mat);
    m.castShadow = shadow;
    return m;
  };
  // конечность: пивот сверху, чтобы вращать от сустава
  const limb = (rTop, rBot, len, mat) => {
    const g = new THREE.CylinderGeometry(rTop, rBot, len, 8, 1);
    g.translate(0, -len / 2, 0);
    roughen(g, 0.012);
    const m = new THREE.Mesh(g, mat);
    m.castShadow = true;
    return m;
  };
  const small = (r, mat, x, y, z) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 6, 5), mat);
    m.position.set(x, y, z);
    return m;
  };

  const root = new THREE.Group();
  const body = new THREE.Group();
  body.scale.setScalar(SCALE);
  root.add(body);

  const hips = new THREE.Group();
  const HIPS_Y = 1.32;
  hips.position.y = HIPS_Y;
  body.add(hips);

  const torso = new THREE.Group();
  hips.add(torso);

  // корпус: массивная бочкообразная грудь, узкий таз, горб
  const chest = blob(0.92, 0.78, 0.72, M.body, { amp: 0.035, seg: 14 });
  chest.position.set(0, 0.42, 0);
  chest.rotation.x = -0.16;
  torso.add(chest);
  const belly = blob(0.68, 0.58, 0.56, M.body);
  belly.position.set(0, -0.18, 0.06);
  torso.add(belly);
  const hump = blob(0.62, 0.42, 0.5, M.silver, { amp: 0.04, shadow: false });   // серебристая спина
  hump.position.set(0, 0.82, -0.28);
  torso.add(hump);
  const pelvis = blob(0.5, 0.36, 0.42, M.body, { amp: 0.025, seg: 10, shadow: false });
  pelvis.position.set(0, -0.6, 0);
  hips.add(pelvis);

  // ---------- голова ----------
  const neck = new THREE.Group();
  neck.position.set(0, 0.92, 0.06);
  torso.add(neck);
  const skull = blob(0.4, 0.42, 0.42, M.body, { amp: 0.025, seg: 12 });
  skull.position.y = 0.24;
  neck.add(skull);
  const crest = blob(0.1, 0.24, 0.36, M.body, { amp: 0, seg: 8, shadow: false });   // сагиттальный гребень
  crest.position.set(0, 0.56, -0.04);
  neck.add(crest);
  const brow = blob(0.38, 0.1, 0.16, M.face, { amp: 0, seg: 10, shadow: false });   // надбровная дуга
  brow.position.set(0, 0.26, 0.31);
  brow.rotation.x = 0.22;
  neck.add(brow);
  const muzzle = blob(0.28, 0.2, 0.24, M.face, { amp: 0.012, seg: 10, shadow: false });
  muzzle.position.set(0, 0.07, 0.32);
  neck.add(muzzle);
  const jaw = blob(0.24, 0.12, 0.2, M.face, { amp: 0.01, seg: 8, shadow: false });
  jaw.position.set(0, -0.05, 0.3);
  neck.add(jaw);
  for (const sx of [-1, 1]) {
    neck.add(small(0.035, M.eye, sx * 0.08, 0.09, 0.53));          // ноздри
    neck.add(small(0.055, M.eye, sx * 0.16, 0.25, 0.33));           // глаза
    neck.add(small(0.016, M.glint, sx * 0.175, 0.275, 0.375));
    const ear = blob(0.05, 0.09, 0.07, M.face, { amp: 0, seg: 6, shadow: false });
    ear.position.set(sx * 0.39, 0.24, 0);
    neck.add(ear);
  }

  // ---------- руки: длинные, кулаки — ходит на костяшках ----------
  const makeArm = (side) => {
    const sh = new THREE.Group();
    sh.position.set(side * 0.82, 0.72, 0);
    torso.add(sh);
    sh.add(blob(0.32, 0.3, 0.3, M.body, { amp: 0.025, seg: 10 }));   // дельта
    sh.add(limb(0.27, 0.22, 0.86, M.body));
    const el = new THREE.Group();
    el.position.y = -0.86;
    sh.add(el);
    el.add(limb(0.24, 0.2, 0.82, M.body));
    const wrist = new THREE.Group();
    wrist.position.y = -0.82;
    el.add(wrist);
    const fist = blob(0.21, 0.16, 0.24, M.face, { amp: 0.02, seg: 8 });
    fist.position.y = -0.13;
    wrist.add(fist);
    for (let k = 0; k < 4; k++) wrist.add(small(0.052, M.face, -0.12 + k * 0.08, -0.2, 0.13));
    return { sh, el, side };
  };
  const armL = makeArm(-1);
  const armR = makeArm(1);

  // ---------- ноги: короткие и толстые ----------
  const makeLeg = (side) => {
    const hp = new THREE.Group();
    hp.position.set(side * 0.34, -0.66, 0);
    hips.add(hp);
    hp.add(limb(0.31, 0.24, 0.56, M.body));
    const kn = new THREE.Group();
    kn.position.y = -0.56;
    hp.add(kn);
    kn.add(limb(0.23, 0.19, 0.48, M.body));
    const foot = blob(0.19, 0.11, 0.3, M.face, { amp: 0, seg: 8, shadow: false });
    foot.position.set(0, -0.56, 0.1);
    kn.add(foot);
    return { hp, kn, side };
  };
  const legL = makeLeg(-1);
  const legR = makeLeg(1);

  // ---------- позы ----------
  const setArm = (a, x, z, el) => { a.sh.rotation.set(x, 0, z * -a.side); a.el.rotation.x = el; };
  const setLeg = (l, x, z, kn) => { l.hp.rotation.set(x, 0, z * -l.side); l.kn.rotation.x = kn; };

  const reset = () => {
    hips.position.y = HIPS_Y;
    torso.rotation.set(0, 0, 0);
    torso.position.y = 0;
    neck.rotation.set(0, 0, 0);
    jaw.position.y = -0.05;
    jaw.scale.y = 1;
  };

  // стойка: дыхание, руки чуть вперёд, колени согнуты
  const poseIdle = (t) => {
    const br = Math.sin(t * 1.6) * 0.03;
    torso.rotation.x = 0.06 + br;
    torso.position.y = br * 0.4;
    setArm(armL, 0.28, -0.16, -0.28);
    setArm(armR, 0.28, -0.16, -0.28);
    setLeg(legL, -0.18, -0.06, 0.42);
    setLeg(legR, -0.18, -0.06, 0.42);
    neck.rotation.set(0.1 + Math.sin(t * 0.9) * 0.05, Math.sin(t * 0.55) * 0.22, 0);
  };

  // бег на костяшках: галоп, руки выносятся вперёд, ноги подтягиваются; p — фаза по пройденному пути
  const poseRun = (p) => {
    hips.position.y = 1.24 + Math.abs(Math.sin(p)) * 0.12;
    torso.rotation.x = 0.5 + Math.sin(p * 2) * 0.05;
    torso.rotation.z = Math.sin(p) * 0.07;
    setArm(armL, -0.5 + Math.sin(p) * 1.15, -0.2, -0.35 - Math.max(0, Math.sin(p)) * 0.5);
    setArm(armR, -0.5 - Math.sin(p) * 1.15, -0.2, -0.35 - Math.max(0, -Math.sin(p)) * 0.5);
    setLeg(legL, -0.5 - Math.sin(p) * 0.85, -0.08, 0.6 + Math.max(0, Math.sin(p)) * 0.85);
    setLeg(legR, -0.5 + Math.sin(p) * 0.85, -0.08, 0.6 + Math.max(0, -Math.sin(p)) * 0.85);
    neck.rotation.set(-0.28, 0, Math.sin(p) * 0.06);
  };

  // рёв и удары в грудь (ульта)
  const poseRoar = (t) => {
    const beat = Math.sin(t * 13);
    hips.position.y = 1.42;
    torso.rotation.x = -0.24;
    torso.rotation.z = Math.sin(t * 6) * 0.04;
    setArm(armL, -1.15 + beat * 0.45, -0.85, -1.65);
    setArm(armR, -1.15 - beat * 0.45, -0.85, -1.65);
    setLeg(legL, -0.12, -0.14, 0.3);
    setLeg(legR, -0.12, -0.14, 0.3);
    neck.rotation.set(-0.42, 0, 0);
    jaw.position.y = -0.14;
    jaw.scale.y = 1.5;
  };

  // удар кулаком: k 0..1, side — какой рукой
  const overlayPunch = (k, side) => {
    const a = side > 0 ? armR : armL;
    const s = Math.sin(k * Math.PI);
    a.sh.rotation.x = -1.6 * s + a.sh.rotation.x * (1 - s);
    a.sh.rotation.z = 0;
    a.el.rotation.x = -0.1 * s + a.el.rotation.x * (1 - s);
    torso.rotation.y = -0.45 * s * side;
    torso.rotation.x += 0.15 * s;
  };

  // бросок: обе руки хватают перед собой (k < 0.45), затем замах вверх и швырок в сторону
  const overlayThrow = (k) => {
    const grab = Math.min(1, k / 0.45);
    const fling = Math.max(0, (k - 0.45) / 0.55);
    const lift = Math.sin(fling * Math.PI);
    for (const a of [armL, armR]) {
      a.sh.rotation.x = -1.3 * grab - 1.2 * lift;
      a.sh.rotation.z = a.side * -0.25 * grab;
      a.el.rotation.x = -0.4 * grab;
    }
    torso.rotation.x = 0.25 * grab - 0.35 * lift;
    torso.rotation.y = 0.6 * lift;
  };

  // прыжок: руки вверх, ноги поджаты; k 0..1
  const poseJump = (k) => {
    const up = Math.sin(k * Math.PI);
    hips.position.y = HIPS_Y;
    torso.rotation.x = -0.2 + 0.7 * k;
    setArm(armL, -2.4 * up - 0.3, -0.5, -0.4);
    setArm(armR, -2.4 * up - 0.3, -0.5, -0.4);
    setLeg(legL, -0.9 * up, -0.1, 1.3 * up + 0.3);
    setLeg(legR, -0.9 * up, -0.1, 1.3 * up + 0.3);
    neck.rotation.set(-0.3, 0, 0);
  };

  const animate = ({ t, stride, moving, punch = null, punchSide = 1, throwK = null, roar = false, jump = null }) => {
    reset();
    if (jump != null) poseJump(jump);
    else if (roar) poseRoar(t);
    else if (moving) poseRun(stride);
    else poseIdle(t);
    if (jump == null && !roar) {
      if (throwK != null) overlayThrow(throwK);
      else if (punch != null) overlayPunch(punch, punchSide);
    }
  };

  animate({ t: 0, stride: 0, moving: false });
  return { root, animate };
}
