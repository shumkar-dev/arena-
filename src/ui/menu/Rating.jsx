import React from 'react';
import TopBar from './TopBar.jsx';

// Рейтинг — утки и звания (этап 9).
export default function Rating({ onBack }) {
  return (
    <div className="menu">
      <TopBar title="Рейтинг" onBack={onBack} />
      <div className="bs-panel rating-soon">🦆 Утки и звания — скоро</div>
    </div>
  );
}
