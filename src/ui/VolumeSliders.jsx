import React from 'react';
import { sound } from '../game/sound.js';
import { voice } from '../game/voice.js';
import { heroById, HEROES } from '../heroes/index.js';

// Три ползунка громкости: звуки, голоса, музыка. Меняют громкость сразу (sound.js),
// значения сохраняет App вместе с остальными настройками. Отпустил ползунок —
// короткий пример: удар для звуков, реплика героя для голосов (музыка и так играет).
const ROWS = [
  ['volume', 'Звуки'],
  ['voiceVolume', 'Голоса'],
  ['musicVolume', 'Музыка'],
];

export default function VolumeSliders({ prefs, onChange, muted, heroId }) {
  const preview = (key) => {
    if (key === 'volume') sound.play('punch');
    else if (key === 'voiceVolume') voice.preview(heroById(heroId), HEROES);
  };
  return ROWS.map(([key, label]) => (
    <div className="set-row" key={key}>
      <span>{label}</span>
      <input
        type="range" min="0" max="1" step="0.05" value={prefs[key]} disabled={muted}
        aria-label={label}
        onChange={(e) => onChange({ [key]: Number(e.target.value) })}
        onPointerUp={() => preview(key)}
        onKeyUp={() => preview(key)}
      />
      <span className="vol-pct">{Math.round(prefs[key] * 100)}</span>
    </div>
  ));
}
