import React from 'react';

// Правая сторона: атака и ульта.
// На атаке — три точки серии: два удара, третьим будет захват.
// Ульта показывает перезарядку кольцом и секундами.
export default function ActionButtons({ input, hud }) {
  const press = (key) => (e) => {
    e.preventDefault();
    input[key] = true;
  };
  const ready = hud.ultCd <= 0;
  const deg = Math.round((1 - hud.ultFrac) * 360);
  const grabNext = hud.combo >= 2;

  return (
    <div className={`actions ${hud.dead ? 'disabled' : ''}`}>
      <button
        className={`btn-ult ${ready ? 'ready' : ''} ${hud.ultActive ? 'active' : ''}`}
        onPointerDown={press('ult')}
        style={{ '--cd': `${deg}deg` }}
        aria-label="Ульта"
      >
        <span>{ready ? 'УЛЬТА' : Math.ceil(hud.ultCd)}</span>
      </button>
      <button
        className={`btn-attack ${grabNext ? 'grab' : ''}`}
        onPointerDown={press('attack')}
        aria-label={grabNext ? 'Захват' : 'Атака'}
      >
        <span className="btn-attack-icon">{grabNext ? '🤼' : '✊'}</span>
        <span className="combo">
          {[0, 1, 2].map((i) => (
            <i key={i} className={i < hud.combo ? 'on' : i === 2 && grabNext ? 'next' : ''} />
          ))}
        </span>
      </button>
    </div>
  );
}
