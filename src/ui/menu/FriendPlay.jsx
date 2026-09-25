import React, { useEffect, useState } from 'react';
import TopBar from './TopBar.jsx';
import { heroById, HEROES } from '../../heroes/index.js';
import { modeById } from '../../modes/index.js';
import { ONLINE_MODES, teamOfSlot } from '../../net/protocol.js';
import { VersionNotice } from '../UpdateBanner.jsx';

// «Играть с другом» — комнаты по коду. Сначала лобби, режим потом:
//  • без комнаты: «Создать комнату» или войти по коду;
//  • в комнате (lobby с сервера): код, места игроков с их героями, выбор своего героя,
//    у создателя — выбор режима и «Старт». Места и боты подстраиваются под режим,
//    в 2 на 2 можно перейти в другую команду. После боя все возвращаются сюда же.
// Когда бой начнётся, сервер пришлёт start — его ловит App и открывает арену.
// versionIssue — версии игры и сервера не совпали: вместо непонятной ошибки — «Обнови игру»
export default function FriendPlay({ net, lobby, heroId, playerName, ducks, onHero, versionIssue, onLeave, onBack }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const hero = heroById(heroId);

  useEffect(() => {
    const offs = [
      net.on('lobby', () => { setBusy(false); setError(''); }),
      net.on('err', (m) => { setBusy(false); setError(m.code === 'version' ? '' : m.msg); }),
      net.on('close', () => { setBusy(false); setError('Нет связи с сервером. Проверь интернет и попробуй ещё раз.'); }),
    ];
    return () => offs.forEach((off) => off());
  }, [net]);

  const create = () => { setError(''); setBusy(true); net.create(playerName, heroId, ducks); };
  const join = (e) => {
    e?.preventDefault();
    if (code.length !== 4) return;
    setError('');
    setBusy(true);
    net.join(code, playerName, heroId, ducks);
  };

  if (lobby && !versionIssue) return <Lobby net={net} lobby={lobby} error={error} onHero={onHero} onLeave={onLeave} />;
  if (versionIssue) {
    return (
      <div className="menu">
        <TopBar title="Играть с другом" onBack={lobby ? onLeave : onBack} />
        <div className="friend"><VersionNotice issue={versionIssue} /></div>
      </div>
    );
  }

  return (
    <div className="menu">
      <TopBar title="Играть с другом" onBack={onBack} />
      <div className="friend">
        <div className="friend-hero">Ты: <b>{playerName}</b> · {hero.name}</div>
        <div className="friend-choose">
          <div className="bs-panel friend-box">
            <div className="friend-label">Новая комната</div>
            <button className="bs-btn bs-btn-gold friend-create-btn" disabled={busy} onClick={create}>
              {busy ? 'Минутку…' : 'Создать комнату'}
            </button>
            <div className="friend-hint">Получишь код из 4 символов — отправь его друзьям. Режим выберешь в комнате.</div>
          </div>
          <form className="bs-panel friend-box" onSubmit={join}>
            <div className="friend-label">Войти по коду</div>
            <input
              className="name-input friend-input" value={code} maxLength={4}
              autoComplete="off" autoCorrect="off" autoCapitalize="characters" spellCheck={false} enterKeyHint="go"
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4))}
              placeholder="ABCD"
            />
            <button type="submit" className="bs-btn bs-btn-gold" disabled={code.length !== 4 || busy}>Войти</button>
          </form>
        </div>
        {error && <div className="friend-error">{error}</div>}
      </div>
    </div>
  );
}

// ---------- комната до боя (и между боями) ----------
function Lobby({ net, lobby, error, onHero, onLeave }) {
  const mode = modeById(lobby.mode);
  const isHost = lobby.you === lobby.host;
  const hostName = lobby.slots[lobby.host]?.name ?? 'создатель';
  const myHero = lobby.slots[lobby.you]?.hero;
  const people = lobby.slots.filter(Boolean).length;

  const pickHero = (id) => {
    if (id === myHero) return;
    net.hero(id);
    onHero?.(id);      // запомнить и для обычной игры
  };

  const slot = (p, i) => (
    <div key={i} className={`lobby-slot ${p ? '' : 'empty'} ${i === lobby.you ? 'me' : ''}`}
      style={p ? { '--hero': heroById(p.hero).color } : undefined}>
      {p ? (
        <>
          <span className="lobby-name">{i === lobby.host && <span title="Создатель">👑 </span>}{p.name}{i === lobby.you && ' (ты)'}</span>
          <span className="lobby-hero">{heroById(p.hero).icons?.attack} {heroById(p.hero).name}</span>
        </>
      ) : (
        <span className="lobby-name">🤖 бот</span>
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
      <TopBar title="Комната" onBack={onLeave} />
      <div className="lobby">
        <div className="bs-panel lobby-side">
          <div className="lobby-code-row">
            <span className="friend-label">Код</span>
            <span className="lobby-code">{lobby.code}</span>
            {navigator.share && (
              <button className="bs-btn bs-btn-small" onClick={() => navigator.share({ text: `Го на арену! Код комнаты: ${lobby.code}` }).catch(() => {})}>
                Отправить
              </button>
            )}
          </div>

          <div className="friend-label">Режим</div>
          {isHost ? (
            <div className="lobby-modes">
              {ONLINE_MODES.map((id) => {
                const m = modeById(id);
                const tooMany = people > (m.slots ?? 2);
                return (
                  <button key={id} className={`lobby-chip ${id === lobby.mode ? 'on' : ''}`} disabled={tooMany}
                    title={tooMany ? 'Игроков больше, чем мест' : ''} onClick={() => net.mode(id)}>
                    {m.icon} {m.name}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="lobby-mode-name">{mode.icon} {mode.name}</div>
          )}

          <div className="friend-label">Твой герой</div>
          <div className="lobby-heroes">
            {HEROES.map((h) => (
              <button key={h.id} className={`lobby-chip hero-chip ${h.id === myHero ? 'on' : ''}`} style={{ '--hero': h.color }}
                onClick={() => pickHero(h.id)}>
                {h.icons?.attack} {h.name}
              </button>
            ))}
          </div>
        </div>

        <div className="bs-panel lobby-players">
          {lobby.mode === 'teams' ? (
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
