import React, { useEffect, useState } from 'react';
import TopBar from './TopBar.jsx';
import { heroById } from '../../heroes/index.js';
import { modeById } from '../../modes/index.js';
import { ONLINE_MODES, teamOfSlot } from '../../net/protocol.js';

// «Играть с другом» — комнаты по коду.
//  • без комнаты: создать (выбрать режим) или войти по коду;
//  • в комнате (lobby с сервера): код, места игроков, выбор команды в 2 на 2,
//    у создателя — «Старт». Свободные места займут боты.
// Когда бой начнётся, сервер пришлёт start — его ловит App и открывает арену.
export default function FriendPlay({ net, lobby, heroId, playerName, ducks, onLeave, onBack }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const hero = heroById(heroId);

  useEffect(() => {
    const offs = [
      net.on('lobby', () => { setBusy(false); setError(''); }),
      net.on('err', (m) => { setBusy(false); setError(m.msg); }),
      net.on('close', () => { setBusy(false); setError('Нет связи с сервером. Проверь интернет и попробуй ещё раз.'); }),
    ];
    return () => offs.forEach((off) => off());
  }, [net]);

  const create = (modeId) => { setError(''); setBusy(true); net.create(modeId, playerName, heroId, ducks); };
  const join = (e) => {
    e?.preventDefault();
    if (code.length !== 4) return;
    setError('');
    setBusy(true);
    net.join(code, playerName, heroId, ducks);
  };

  if (lobby) return <Lobby net={net} lobby={lobby} error={error} onLeave={onLeave} />;

  return (
    <div className="menu">
      <TopBar title="Играть с другом" onBack={onBack} />
      <div className="friend">
        <div className="friend-hero">Ты: <b>{playerName}</b> · {hero.name}</div>
        <div className="friend-choose">
          <div className="bs-panel friend-box friend-create">
            <div className="friend-label">Создать комнату</div>
            <div className="friend-modes">
              {ONLINE_MODES.map((id) => {
                const m = modeById(id);
                return (
                  <button key={id} className="bs-card friend-mode" disabled={busy} onClick={() => create(id)}>
                    <span className="friend-mode-icon">{m.icon}</span>
                    <span className="mode-pick-name">{m.name}</span>
                  </button>
                );
              })}
            </div>
            <div className="friend-hint">Получишь код из 4 символов — отправь его друзьям.</div>
          </div>
          <form className="bs-panel friend-box" onSubmit={join}>
            <div className="friend-label">Войти по коду</div>
            <input
              className="name-input friend-input" value={code} maxLength={4}
              autoComplete="off" autoCorrect="off" autoCapitalize="characters" spellCheck={false} enterKeyHint="go"
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4))}
              placeholder="ABCD"
            />
            <button type="submit" className="bs-btn bs-btn-gold" disabled={code.length !== 4 || busy}>
              {busy ? 'Минутку…' : 'Войти'}
            </button>
          </form>
        </div>
        {error && <div className="friend-error">{error}</div>}
      </div>
    </div>
  );
}

// ---------- комната до боя ----------
function Lobby({ net, lobby, error, onLeave }) {
  const mode = modeById(lobby.mode);
  const isHost = lobby.you === lobby.host;
  const hostName = lobby.slots[lobby.host]?.name ?? 'создатель';
  const teams = lobby.mode === 'teams';

  const slot = (p, i) => (
    <div key={i} className={`lobby-slot ${p ? '' : 'empty'} ${i === lobby.you ? 'me' : ''}`}>
      {p ? (
        <>
          <span className="lobby-name">{i === lobby.host && <span title="Создатель">👑 </span>}{p.name}{i === lobby.you && ' (ты)'}</span>
          <span className="lobby-hero">{heroById(p.hero).name}</span>
        </>
      ) : (
        <span className="lobby-name">🤖 место для бота</span>
      )}
    </div>
  );

  const myTeam = teamOfSlot(lobby.mode, lobby.you);
  const column = (team, title) => {
    const idx = lobby.slots.map((_, i) => i).filter((i) => teamOfSlot(lobby.mode, i) === team);
    const canMove = team !== myTeam && idx.some((i) => !lobby.slots[i]);
    return (
      <div className={`lobby-team team-${team}`}>
        <div className="lobby-team-title">{title}</div>
        {idx.map((i) => slot(lobby.slots[i], i))}
        {canMove && <button className="bs-btn bs-btn-small" onClick={() => net.team(team)}>Перейти сюда</button>}
      </div>
    );
  };

  return (
    <div className="menu">
      <TopBar title={`${mode.icon} ${mode.name}`} onBack={onLeave} />
      <div className="lobby">
        <div className="bs-panel lobby-code-box">
          <div className="friend-label">Код комнаты</div>
          <div className="friend-code">{lobby.code}</div>
          {navigator.share && (
            <button className="bs-btn bs-btn-small" onClick={() => navigator.share({ text: `Го на арену! «${mode.name}», код комнаты: ${lobby.code}` }).catch(() => {})}>
              Отправить код
            </button>
          )}
        </div>
        <div className="bs-panel lobby-players">
          {teams ? (
            <div className="lobby-teams">{column('blue', 'Синие')}{column('red', 'Красные')}</div>
          ) : (
            <div className="lobby-list">{lobby.slots.map(slot)}</div>
          )}
          <div className="lobby-actions">
            {isHost
              ? <button className="bs-btn bs-btn-gold lobby-start" onClick={() => net.start()}>Старт</button>
              : <div className="friend-wait">Ждём, пока {hostName} нажмёт «Старт»…</div>}
            <div className="friend-hint">Свободные места займут боты.</div>
          </div>
          {error && <div className="friend-error">{error}</div>}
        </div>
      </div>
    </div>
  );
}
