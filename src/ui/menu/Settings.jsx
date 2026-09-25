import React from 'react';
import TopBar from './TopBar.jsx';
import NameInput from '../NameInput.jsx';

// Настройки: звук, громкость, ник, качество графики.
export default function Settings({ prefs, muted, onMuted, onChange, onBack }) {
  return (
    <div className="menu">
      <TopBar title="Настройки" onBack={onBack} />
      <div className="settings bs-panel">
        <label className="set-row">
          <span>Звук</span>
          <button className={`toggle ${muted ? '' : 'on'}`} onClick={() => onMuted(!muted)}>{muted ? 'Выкл' : 'Вкл'}</button>
        </label>
        <label className="set-row">
          <span>Громкость</span>
          <input type="range" min="0" max="1" step="0.05" value={prefs.volume} disabled={muted}
            onChange={(e) => onChange({ volume: Number(e.target.value) })} />
        </label>
        <div className="set-row">
          <span>Ник</span>
          <NameInput value={prefs.playerName} onSave={(name) => onChange({ playerName: name })} />
        </div>
        <label className="set-row">
          <span>Графика</span>
          <span className="seg">
            <button className={prefs.quality === 'high' ? 'on' : ''} onClick={() => onChange({ quality: 'high' })}>Красиво</button>
            <button className={prefs.quality === 'low' ? 'on' : ''} onClick={() => onChange({ quality: 'low' })}>Быстро</button>
          </span>
        </label>
        <p className="set-hint">«Быстро» — без теней и с меньшей чёткостью, для слабых телефонов.</p>
      </div>
    </div>
  );
}
