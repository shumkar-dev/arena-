import React, { useRef, useState } from 'react';

// Правая сторона: атака и ульта, обе с прицелом как в Brawl Stars.
// Короткое касание — автоприцел в ближайшего врага.
// Зажать и оттянуть — на земле видна линия или сектор атаки, отпустить — удар в эту сторону.
// На атаке — три точки серии: после двух попаданий третья атака особая.
// Ульта показывает перезарядку кольцом и секундами.
const DRAG_RADIUS = 80;

// Оттягиваемая кнопка: пока палец держит её, сообщает вектор −1..1 (экранные оси).
function useDrag({ enabled, onAim, onRelease }) {
  const ptr = useRef(null);   // { id, x, y } — где нажали
  const [knob, setKnob] = useState(null);

  const vec = (e) => {
    let dx = e.clientX - ptr.current.x, dy = e.clientY - ptr.current.y;
    const d = Math.hypot(dx, dy);
    if (d > DRAG_RADIUS) { dx *= DRAG_RADIUS / d; dy *= DRAG_RADIUS / d; }
    return { dx, dy };
  };
  const end = (e, fire) => {
    if (!ptr.current || e.pointerId !== ptr.current.id) return;
    const v = vec(e);
    ptr.current = null;
    setKnob(null);
    onAim(null);
    if (fire) onRelease(v.dx / DRAG_RADIUS, v.dy / DRAG_RADIUS);
  };

  return {
    knob,
    handlers: {
      onPointerDown(e) {
        e.preventDefault();
        if (!enabled || ptr.current) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        ptr.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
        setKnob({ dx: 0, dy: 0 });
        onAim({ dx: 0, dy: 0 });
      },
      onPointerMove(e) {
        if (!ptr.current || e.pointerId !== ptr.current.id) return;
        const v = vec(e);
        setKnob(v);
        onAim({ dx: v.dx / DRAG_RADIUS, dy: v.dy / DRAG_RADIUS });
      },
      onPointerUp: (e) => end(e, true),
      onPointerCancel: (e) => end(e, false),
    },
  };
}

const Knob = ({ knob }) => knob && (
  <i className="aim-knob" style={{ transform: `translate(${knob.dx}px, ${knob.dy}px)` }} />
);

export default function ActionButtons({ input, hud, icons }) {
  const ready = hud.ultCd <= 0;
  const deg = Math.round((1 - hud.ultFrac) * 360);
  const special = hud.special;

  const attack = useDrag({
    enabled: !hud.attackLocked,
    onAim: (v) => { input.attackAim = v ? { active: true, ...v } : { active: false, dx: 0, dy: 0 }; },
    // короткое касание — автоприцел, оттяжка — в выбранную сторону (движок решает по длине вектора)
    onRelease: (dx, dy) => { input.attackFire = { dx, dy }; },
  });

  const ult = useDrag({
    enabled: ready,
    onAim: (v) => { input.ultAim = v ? { active: true, ...v } : { active: false, dx: 0, dy: 0 }; },
    onRelease: (dx, dy) => { input.ultFire = { dx, dy }; },
  });

  // ульта без прицела срабатывает сразу по касанию
  const ultTap = {
    onPointerDown(e) { e.preventDefault(); input.ult = true; },
  };

  const attackIcon = hud.steer ? '🎯' : special ? icons.special : icons.attack;

  return (
    <div className={`actions ${hud.dead ? 'disabled' : ''}`}>
      <button
        className={`btn-ult ${ready ? 'ready' : ''} ${hud.ultActive ? 'active' : ''} ${ult.knob ? 'aiming' : ''}`}
        {...(hud.ultAim === 'drag' ? ult.handlers : ultTap)}
        style={{ '--cd': `${deg}deg` }}
        aria-label="Ульта"
      >
        <span>{ready ? 'УЛЬТА' : Math.ceil(hud.ultCd)}</span>
        <Knob knob={ult.knob} />
      </button>
      <button
        className={`btn-attack ${special ? 'grab' : ''} ${hud.frenzy ? 'frenzy' : ''} ${hud.attackLocked ? 'locked' : ''} ${attack.knob ? 'aiming' : ''}`}
        {...attack.handlers}
        aria-label={special ? 'Особая атака' : 'Атака'}
      >
        <span className="btn-attack-icon">{attackIcon}</span>
        <span className="combo">
          {[0, 1, 2].map((i) => (
            <i key={i} className={i < hud.combo ? 'on' : i === 2 && special ? 'next' : ''} />
          ))}
        </span>
        <Knob knob={attack.knob} />
      </button>
    </div>
  );
}
