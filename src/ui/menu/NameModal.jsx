import React from 'react';
import NameInput, { NAME_MIN, NAME_MAX } from '../NameInput.jsx';

// Первый вход: придумать ник. Он виден над героем в бою и в таблице рейтинга.
export default function NameModal({ onSave }) {
  return (
    <div className="modal">
      <div className="bs-panel modal-box">
        <h2 className="bs-title modal-title">Придумай ник</h2>
        <p className="modal-hint">Его увидят над твоим героем и в рейтинге. От {NAME_MIN} до {NAME_MAX} символов, сменить можно в настройках.</p>
        <NameInput value="" onSave={onSave} button="Готово" />
      </div>
    </div>
  );
}
