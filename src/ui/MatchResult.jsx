import React from 'react';
import DuckIcon from './DuckIcon.jsx';

// Итог матча: «Победа» / «Поражение» (или место), счёт, утки, кнопки «Ещё раз» и «В меню».
// reward: { delta, after, rank, rankUp, rankDown } — от рейтинга (в тренировке нет)
export default function MatchResult({ result, reward, waiting, onAgain, onExit }) {
  const title = result.win ? 'Победа' : result.showPlace && result.place ? `${result.place} место` : 'Поражение';
  return (
    <div className={`result ${result.win ? 'win' : 'lose'}`}>
      <div className="result-box">
        <div className="result-title">{title}</div>
        {result.reason && <div className="result-reason">{result.reason}</div>}
        {reward && (
          <div className="result-reward">
            <span className={`reward-delta ${reward.delta > 0 ? 'up' : reward.delta < 0 ? 'down' : ''}`}>
              <DuckIcon /> {reward.delta > 0 ? `+${reward.delta}` : reward.delta}
            </span>
            <span className="reward-total">{reward.after} · <b style={{ color: reward.rank.color }}>{reward.rank.name}</b></span>
            {reward.rankUp && <span className="reward-rank">Новое звание: {reward.rank.name}!</span>}
            {reward.rankDown && <span className="reward-rank down">Звание понижено: {reward.rank.name}</span>}
          </div>
        )}
        <div className="result-buttons">
          <button className="btn-big btn-gold" onClick={onAgain} disabled={waiting}>{waiting ? 'Ждём соперника…' : 'Ещё раз'}</button>
          <button className="btn-big" onClick={onExit}>В меню</button>
        </div>
      </div>
    </div>
  );
}
