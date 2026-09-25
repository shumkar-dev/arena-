import React, { useState } from 'react';
import TopBar from './TopBar.jsx';
import BalanceTable from './BalanceTable.jsx';
import HeroStage from './HeroStage.jsx';
import { HEROES, heroById } from '../../heroes/index.js';

// Выбор героя: слева список, в центре — герой на подиуме, справа — атаки и ульта.
export default function HeroPicker({ heroId, onPick, onBack }) {
  const [viewId, setViewId] = useState(heroId);
  const [table, setTable] = useState(false);
  const hero = heroById(viewId);
  const s = hero.stats;
  return (
    <div className="menu">
      <TopBar title="Герои" onBack={onBack} right={<button className="bs-btn bs-btn-small" onClick={() => setTable(true)}>Баланс</button>} />
      {table && <BalanceTable onClose={() => setTable(false)} />}
      <div className="picker">
        <div className="picker-list">
          {HEROES.map((h) => (
            <button key={h.id} className={`picker-item ${h.id === viewId ? 'on' : ''}`} style={{ '--hero': h.color }} onClick={() => setViewId(h.id)}>
              <span className="picker-icon">{h.icons.attack}</span>
              <span className="picker-name">{h.name}</span>
              {h.id === heroId && <span className="picker-mark">★</span>}
            </button>
          ))}
        </div>

        <div className="picker-stage">
          <HeroStage heroId={viewId} />
        </div>

        <div className="picker-info bs-panel">
          <div className="info-name" style={{ color: hero.color }}>{hero.name}</div>
          <div className="info-role">{hero.role} · ❤ {s.maxHp}</div>
          <div className="info-move"><b>{hero.icons.attack} Атака</b><span>{hero.balance.attack}</span></div>
          <div className="info-move"><b>{hero.icons.special} 3-я атака</b><span>{hero.balance.special}</span></div>
          <div className="info-move"><b>⭐ Ульта</b><span>{hero.balance.ult}</span></div>
          <div className="info-about">{hero.about}</div>
          <button className="bs-btn bs-btn-gold info-pick" onClick={() => onPick(viewId)} disabled={viewId === heroId}>
            {viewId === heroId ? 'Выбран' : 'Выбрать'}
          </button>
        </div>
      </div>
    </div>
  );
}
