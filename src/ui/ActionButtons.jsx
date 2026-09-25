import React, { useRef, useState } from 'react';

// Правая сторона: атака и ульта.
// На атаке — три точки серии: после двух попаданий третья атака особая.
// Ульта показывает перезарядку кольцом и секундами.
// Прицельная ульта (Гаргашмель): зажать кнопку и оттянуть — на земле виден круг,
// отпустить — удар в эту точку. Короткое касание бьёт в ближайшего врага.
const DRAG_RADIUS = 90;

export default function ActionButtons({ input, hud, icons }) {
  const press = (key) => (e) => {
    e.preventDefault();
    input[key] = true;
  };
  const ready = hud.ultCd <= 0;
  const deg = Math.round((1 - hud.ultFrac) * 360);
  const special = hud.special;

  // ---- прицельная ульта ----
  const aim = useRef(null);   // { id, x, y } — где нажали
  const [knob, setKnob] = useState(null);

  const vec = (e) => {
    let dx = e.clientX - aim.current.x, dy = e.clientY - aim.current.y;
    const d = Math.hypot(dx, dy);
    if (d > DRAG_RADIUS) { dx *= DRAG_RADIUS / d; dy *= DRAG_RADIUS / d; }
    return { dx, dy };
  };
  const aimDown = (e) => {
    e.preventDefault();
    if (!ready || aim.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    aim.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    input.ultAim = { active: true, dx: 0, dy: 0 };
    setKnob({ dx: 0, dy: 0 });
  };
  const aimMove = (e) => {
    if (!aim.current || e.pointerId !== aim.current.id) return;
    const v = vec(e);
    input.ultAim = { active: true, dx: v.dx / DRAG_RADIUS, dy: v.dy / DRAG_RADIUS };
    setKnob(v);
  };
  const aimUp = (e) => {
    if (!aim.current || e.pointerId !== aim.current.id) return;
    const v = vec(e);
    aim.current = null;
    input.ultAim = { active: false, dx: 0, dy: 0 };
    input.ultFire = { dx: v.dx / DRAG_RADIUS, dy: v.dy / DRAG_RADIUS };
    setKnob(null);
  };
  const aimCancel = (e) => {
    if (!aim.current || e.pointerId !== aim.current.id) return;
    aim.current = null;
    input.ultAim = { active: false, dx: 0, dy: 0 };
    setKnob(null);
  };

  const ultHandlers = hud.ultAim === 'drag'
    ? { onPointerDown: aimDown, onPointerMove: aimMove, onPointerUp: aimUp, onPointerCancel: aimCancel }
    : { onPointerDown: press('ult') };

  return (
    <div className={`actions ${hud.dead ? 'disabled' : ''}`}>
      <button
        className={`btn-ult ${ready ? 'ready' : ''} ${hud.ultActive ? 'active' : ''} ${knob ? 'aiming' : ''}`}
        {...ultHandlers}
        style={{ '--cd': `${deg}deg` }}
        aria-label="Ульта"
      >
        <span>{ready ? 'УЛЬТА' : Math.ceil(hud.ultCd)}</span>
        {knob && <i className="ult-knob" style={{ transform: `translate(${knob.dx}px, ${knob.dy}px)` }} />}
      </button>
      <button
        className={`btn-attack ${special ? 'grab' : ''} ${hud.frenzy ? 'frenzy' : ''} ${hud.attackLocked ? 'locked' : ''}`}
        onPointerDown={press('attack')}
        aria-label={special ? 'Особая атака' : 'Атака'}
      >
        <span className="btn-attack-icon">{special ? icons.special : icons.attack}</span>
        <span className="combo">
          {[0, 1, 2].map((i) => (
            <i key={i} className={i < hud.combo ? 'on' : i === 2 && special ? 'next' : ''} />
          ))}
        </span>
      </button>
    </div>
  );
}
