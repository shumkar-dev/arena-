import React from 'react';

// Правая сторона: атака и ульта. Ульта показывает перезарядку кольцом и секундами.
export default function ActionButtons({ input, hud }) {
  const press = (key) => (e) => {
    e.preventDefault();
    input[key] = true;
  };
  const ready = hud.ultCd <= 0;
  const deg = Math.round((1 - hud.ultFrac) * 360);

  return (
    <div className="actions">
      <button
        className={`btn-ult ${ready ? 'ready' : ''} ${hud.ultActive ? 'active' : ''}`}
        onPointerDown={press('ult')}
        style={{ '--cd': `${deg}deg` }}
        aria-label="Ульта"
      >
        <span>{ready ? 'УЛЬТА' : Math.ceil(hud.ultCd)}</span>
      </button>
      <button className="btn-attack" onPointerDown={press('attack')} aria-label="Атака">
        <span>✊</span>
      </button>
    </div>
  );
}
