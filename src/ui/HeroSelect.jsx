import React from 'react';
import { HEROES } from '../game/heroes.js';

// Простой выбор героя перед ареной. Красивое меню будет на этапе 8.
export default function HeroSelect({ onPick }) {
  return (
    <div className="select">
      <h1 className="select-title">Выбери бойца</h1>
      <div className="select-grid">
        {HEROES.map((h) => (
          <button key={h.id} className="select-card" style={{ '--hero': h.color }} onClick={() => onPick(h.id)}>
            <span className="select-icon">{h.icons.attack}</span>
            <span className="select-name">{h.name}</span>
            <span className="select-role">{h.role}</span>
            <span className="select-about">{h.about}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
