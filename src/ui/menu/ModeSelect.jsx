import React from 'react';
import TopBar from './TopBar.jsx';
import { MODES } from '../../modes/index.js';

// Выбор режима — карточки режимов (собираются сами из src/modes).
export default function ModeSelect({ modeId, onPick, onBack }) {
  return (
    <div className="menu">
      <TopBar title="Выбор режима" onBack={onBack} />
      <div className="card-row">
        {MODES.map((m) => (
          <button key={m.id} className={`bs-card mode-pick ${m.id === modeId ? 'on' : ''}`} onClick={() => onPick(m.id)}>
            <span className="mode-pick-icon">{m.icon}</span>
            <span className="mode-pick-name">{m.name}</span>
            {m.title && m.title !== m.name && <span className="mode-pick-title">{m.title}</span>}
            <span className="mode-pick-about">{m.about}</span>
            {m.id === modeId && <span className="card-check">✔</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
