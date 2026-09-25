import React, { useState } from 'react';
import { HEROES } from '../heroes/index.js';
import { MODES } from '../modes/index.js';

// Простой выбор героя перед ареной. Красивое меню будет на этапе 8.
// Карточки и таблица баланса строятся из папок героев — новый герой появится здесь сам.
export default function HeroSelect({ modeId, onMode, onPick }) {
  const [showBalance, setShowBalance] = useState(false);

  return (
    <div className="select">
      <div className="select-head">
        <h1 className="select-title">Выбери бойца</h1>
        <button className="select-balance-btn" onClick={() => setShowBalance(true)}>Баланс</button>
      </div>
      <div className="select-modes">
        {MODES.map((m) => (
          <button key={m.id} className={`select-mode ${m.id === modeId ? 'on' : ''}`} onClick={() => onMode(m.id)} title={m.about}>
            {m.icon} {m.name}
          </button>
        ))}
      </div>
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
      <p className="select-hint">{MODES.find((m) => m.id === modeId)?.about}</p>

      {showBalance && (
        <div className="balance" onClick={() => setShowBalance(false)}>
          <div className="balance-box" onClick={(e) => e.stopPropagation()}>
            <button className="balance-close" onClick={() => setShowBalance(false)} aria-label="Закрыть">✕</button>
            <table>
              <thead>
                <tr><th>Герой</th><th>ХП</th><th>Атака</th><th>3-я атака</th><th>Ульта</th></tr>
              </thead>
              <tbody>
                {HEROES.map((h) => (
                  <tr key={h.id}>
                    <td style={{ color: h.color }}>{h.icons.attack} {h.name}</td>
                    <td>{h.stats.maxHp}</td>
                    <td>{h.balance.attack}</td>
                    <td>{h.balance.special}</td>
                    <td>{h.balance.ult}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p>Ульта у всех перезаряжается {HEROES[0].stats.ultCooldown} с. Третья атака — после двух попаданий.</p>
          </div>
        </div>
      )}
    </div>
  );
}
