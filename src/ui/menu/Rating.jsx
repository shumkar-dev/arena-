import React, { useEffect, useState } from 'react';
import TopBar from './TopBar.jsx';
import ModelStage from './ModelStage.jsx';
import { createDuck } from '../../characters/duck.js';
import { RANKS, rankOf } from '../../rating/ranks.js';
import { fetchLeaderboard, online } from '../../rating/store.js';

// Рейтинг: твоя утка и звание, лестница званий и общая таблица (игроки и боты).
export default function Rating({ ducks, playerName, onBack, onDucks }) {
  const [board, setBoard] = useState(null);
  const rank = rankOf(ducks);

  useEffect(() => {
    let alive = true;
    fetchLeaderboard(playerName).then((b) => {
      if (!alive) return;
      setBoard(b);
      const me = b.rows.find((r) => r.isMe);
      if (me) onDucks?.(me.ducks);
    });
    return () => { alive = false; };
  }, [playerName, onDucks]);

  const progress = rank.next ? (ducks - rank.from) / (rank.next.from - rank.from) : 1;
  const status = !online ? 'Таблица на этом устройстве' : board && !board.online ? 'Нет связи — таблица с устройства' : 'Общая таблица';

  return (
    <div className="menu">
      <TopBar title="Рейтинг" onBack={onBack} right={<span className="rating-status">{status}</span>} />
      <div className="rating">
        <div className="bs-panel rating-me">
          <ModelStage create={createDuck} className="duck-stage" distance={6.2} lookY={1.15} />
          <div className="rating-ducks">🦆 {ducks}</div>
          <div className="rating-rank" style={{ color: rank.color }}>{rank.name}</div>
          <div className="rank-bar"><i style={{ width: `${Math.round(progress * 100)}%`, background: rank.color }} /></div>
          <div className="rank-next">{rank.next ? `До звания «${rank.next.name}»: ${rank.next.from - ducks} 🦆` : 'Высшее звание'}</div>
        </div>

        <div className="bs-panel rating-ladder">
          {[...RANKS].reverse().map((r) => (
            <div key={r.id} className={`ladder-row ${r.id === rank.id ? 'me' : ''}`}>
              <span className="ladder-name" style={{ color: r.color }}>{r.name}</span>
              <span className="ladder-from">{r.from}+</span>
            </div>
          ))}
          <div className="ladder-rules">
            1 на 1: +5 / −5<br />
            2 на 2: +8 / −4<br />
            Сам за себя: 1 место +10 (+5, если больше всех убийств), 2 место +3, 3 место 0, 4 место −4
          </div>
        </div>

        <div className="bs-panel rating-board">
          {!board && <div className="board-loading">Загрузка…</div>}
          {board?.rows.map((r, i) => {
            const rr = rankOf(r.ducks);
            return (
              <div key={r.id} className={`board-row ${r.isMe ? 'me' : ''}`}>
                <span className="board-place">{i + 1}</span>
                <span className="board-name">{r.isBot && <span className="board-bot" title="Бот">🤖</span>}{r.name}</span>
                <span className="board-rank" style={{ color: rr.color }}>{rr.name}</span>
                <span className="board-ducks">{r.ducks} 🦆</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
