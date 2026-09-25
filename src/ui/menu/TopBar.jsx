import React from 'react';

// Верхняя полоса экранов меню: «назад», заголовок, что-нибудь справа.
export default function TopBar({ title, onBack, right }) {
  return (
    <div className="topbar">
      {onBack ? <button className="bs-btn bs-btn-small topbar-back" onClick={onBack}>◀</button> : <span className="topbar-spacer" />}
      <h1 className="bs-title topbar-title">{title}</h1>
      <div className="topbar-right">{right}</div>
    </div>
  );
}
