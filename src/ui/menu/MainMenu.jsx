import React from 'react';
import HeroStage from './HeroStage.jsx';
import { heroById } from '../../heroes/index.js';
import { modeById } from '../../modes/index.js';
import DuckIcon from '../DuckIcon.jsx';

// Главный экран: герой на подиуме, «Играть», режим, герои, рейтинг, настройки.
export default function MainMenu({ prefs, onPlay, go, rankBadge }) {
  const hero = heroById(prefs.heroId);
  const mode = modeById(prefs.modeId);
  return (
    <div className="menu menu-main">
      <div className="menu-side menu-left">
        <div className="logo">
          <span className="logo-top">Всадники</span>
          <span className="logo-bottom">Арены</span>
        </div>
        {rankBadge}
        <button className="bs-btn menu-wide" onClick={() => go('heroes')}>🦸 Герои</button>
        <button className="bs-btn menu-wide" onClick={() => go('rating')}><DuckIcon /> Рейтинг</button>
        <button className="bs-btn menu-wide" onClick={() => go('settings')}>⚙️ Настройки</button>
      </div>

      <div className="menu-center">
        <HeroStage heroId={hero.id} />
        <button className="hero-name-plate" onClick={() => go('heroes')}>
          <span className="plate-role">{hero.role}</span>
          <span className="plate-name">{hero.name}</span>
        </button>
      </div>

      <div className="menu-side menu-right">
        <button className="mode-card" onClick={() => go('modes')}>
          <span className="mode-card-label">Режим</span>
          <span className="mode-card-icon">{mode.icon}</span>
          <span className="mode-card-name">{mode.name}</span>
          <span className="mode-card-change">Сменить ▸</span>
        </button>
        <button className="bs-btn bs-btn-gold play-btn" onClick={onPlay}>Играть</button>
      </div>
    </div>
  );
}
