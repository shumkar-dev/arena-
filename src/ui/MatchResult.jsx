import React from 'react';

// Итог матча: «Победа» / «Поражение» (или место), счёт, кнопки «Ещё раз» и «В меню».
export default function MatchResult({ result, onAgain, onExit }) {
  const title = result.win ? 'Победа' : result.place && result.place > 2 ? `${result.place} место` : 'Поражение';
  return (
    <div className={`result ${result.win ? 'win' : 'lose'}`}>
      <div className="result-box">
        <div className="result-title">{title}</div>
        {result.reason && <div className="result-reason">{result.reason}</div>}
        {result.extra}
        <div className="result-buttons">
          <button className="btn-big btn-gold" onClick={onAgain}>Ещё раз</button>
          <button className="btn-big" onClick={onExit}>В меню</button>
        </div>
      </div>
    </div>
  );
}
