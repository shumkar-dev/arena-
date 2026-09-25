import React, { useRef, useState } from 'react';

// Фиксированный джойстик в левом нижнем углу, как в Brawl Stars.
// Касание в любом месте левой части экрана управляет им, но сам круг не двигается.
const RADIUS = 58;

export default function Joystick({ input }) {
  const baseRef = useRef(null);
  const pid = useRef(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(false);

  const update = (e) => {
    const r = baseRef.current.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy);
    if (d > RADIUS) { dx *= RADIUS / d; dy *= RADIUS / d; }
    setKnob({ x: dx, y: dy });
    input.moveX = dx / RADIUS;
    input.moveY = dy / RADIUS;
  };

  const onDown = (e) => {
    if (pid.current !== null) return;
    pid.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    setActive(true);
    update(e);
  };
  const onMove = (e) => {
    if (e.pointerId === pid.current) update(e);
  };
  const onUp = (e) => {
    if (e.pointerId !== pid.current) return;
    pid.current = null;
    setActive(false);
    setKnob({ x: 0, y: 0 });
    input.moveX = 0;
    input.moveY = 0;
  };

  return (
    <div
      className="joy-zone"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <div ref={baseRef} className={`joy-base ${active ? 'active' : ''}`}>
        <div className="joy-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
      </div>
    </div>
  );
}
