import React from 'react';
import { HEROES } from '../../heroes/index.js';

// Таблица баланса всех героев — собирается из папок героев.
export default function BalanceTable({ onClose }) {
  return (
    <div className="balance" onClick={onClose}>
      <div className="balance-box" onClick={(e) => e.stopPropagation()}>
        <button className="balance-close" onClick={onClose} aria-label="Закрыть">✕</button>
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
  );
}
