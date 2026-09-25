import React, { useRef, useState } from 'react';

// Плавающий джойстик: появляется там, где палец коснулся левой части экрана.
const RADIUS = 58;

export default function Joystick({ input }) {
  const zone = useRef(null);
  const pid = useRef(null);
  const [base, setBase] = useState(null);   // {x, y} центр в координатах зоны
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const local = (e) => {
    const r = zone.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const update = (p, b) => {
    let dx = p.x - b.x, dy = p.y - b.y;
    const d = Math.hypot(dx, dy);
    if (d > RADIUS) { dx *= RADIUS / d; dy *= RADIUS / d; }
    setKnob({ x: dx, y: dy });
    input.moveX = dx / RADIUS;
    input.moveY = dy / RADIUS;
  };

  const onDown = (e) => {
    if (pid.current !== null) return;
    pid.current = e.pointerId;
    zone.current.setPointerCapture(e.pointerId);
    const p = local(e);
    setBase(p);
    update(p, p);
  };
  const onMove = (e) => {
    if (e.pointerId !== pid.current || !base) return;
    update(local(e), base);
  };
  const onUp = (e) => {
    if (e.pointerId !== pid.current) return;
    pid.current = null;
    setBase(null);
    setKnob({ x: 0, y: 0 });
    input.moveX = 0;
    input.moveY = 0;
  };

  return (
    <div
      ref={zone}
      className="joy-zone"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      {base ? (
        <div className="joy-base" style={{ left: base.x, top: base.y }}>
          <div className="joy-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
        </div>
      ) : (
        <div className="joy-base joy-idle">
          <div className="joy-knob" />
        </div>
      )}
    </div>
  );
}
