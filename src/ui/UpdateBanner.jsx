import React from 'react';
import { applyUpdate } from './update.js';

// Плашка «Доступно обновление»: в меню и на экране итога боя (в бою не мешает).
export default function UpdateBanner({ className = '' }) {
  return (
    <div className={`update-banner ${className}`}>
      <span>Доступно обновление</span>
      <button className="bs-btn bs-btn-small bs-btn-gold" onClick={applyUpdate}>Обновить</button>
    </div>
  );
}

// Версии игры и сервера мультиплеера не совпали.
export function VersionNotice({ issue }) {
  if (issue === 'client') {
    return (
      <div className="bs-panel version-notice">
        <div className="version-title">Обнови игру</div>
        <div className="friend-hint">Сервер уже на новой версии, а у тебя — старая. Обновление займёт пару секунд.</div>
        <button className="bs-btn bs-btn-gold" onClick={applyUpdate}>Обновить</button>
      </div>
    );
  }
  return (
    <div className="bs-panel version-notice">
      <div className="version-title">Сервер обновляется</div>
      <div className="friend-hint">Версия сервера игры ещё старая. Попробуй через пару минут.</div>
    </div>
  );
}
