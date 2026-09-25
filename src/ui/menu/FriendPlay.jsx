import React, { useEffect, useState } from 'react';
import TopBar from './TopBar.jsx';
import { heroById } from '../../heroes/index.js';

// «Играть с другом» — 1 на 1 по сети: создать комнату (показать код) или войти по коду.
// Когда оба в комнате, сервер присылает start — его ловит App и открывает бой.
export default function FriendPlay({ net, heroId, playerName, onBack }) {
  const [stage, setStage] = useState('choose');   // choose | creating | waiting | join | joining
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const hero = heroById(heroId);

  useEffect(() => {
    const offs = [
      net.on('room', (m) => { setCode(m.code); setStage('waiting'); }),
      net.on('err', (m) => { setError(m.msg); setStage((s) => (s === 'joining' ? 'join' : 'choose')); }),
      net.on('close', () => { setError('Нет связи с сервером. Проверь интернет и попробуй ещё раз.'); setStage('choose'); }),
    ];
    return () => offs.forEach((off) => off());
  }, [net]);

  const create = () => { setError(''); setStage('creating'); net.create(playerName, heroId); };
  const join = (e) => {
    e?.preventDefault();
    if (code.length !== 4) return;
    setError('');
    setStage('joining');
    net.join(code, playerName, heroId);
  };
  const back = () => {
    if (stage === 'waiting' || stage === 'creating') net.leave();
    if (stage === 'choose') onBack();
    else { setStage('choose'); setCode(''); }
  };

  return (
    <div className="menu">
      <TopBar title="Играть с другом" onBack={back} />
      <div className="friend">
        <div className="friend-hero">Ты: <b>{playerName}</b> · {hero.name}</div>

        {stage === 'choose' && (
          <div className="friend-choose">
            <button className="bs-card friend-card" onClick={create}>
              <span className="friend-icon">🏠</span>
              <span className="mode-pick-name">Создать комнату</span>
              <span className="mode-pick-about">Получишь код из 4 символов — отправь его другу.</span>
            </button>
            <button className="bs-card friend-card" onClick={() => { setError(''); setCode(''); setStage('join'); }}>
              <span className="friend-icon">🔑</span>
              <span className="mode-pick-name">Войти по коду</span>
              <span className="mode-pick-about">Друг уже создал комнату и прислал код.</span>
            </button>
          </div>
        )}

        {stage === 'creating' && <div className="bs-panel friend-box">Создаём комнату…</div>}

        {stage === 'waiting' && (
          <div className="bs-panel friend-box">
            <div className="friend-label">Код комнаты</div>
            <div className="friend-code">{code}</div>
            <div className="friend-wait">Ждём друга… Бой начнётся сам, как только друг введёт код.</div>
            {navigator.share && (
              <button className="bs-btn bs-btn-small" onClick={() => navigator.share({ text: `Го на арену! Код комнаты: ${code}` }).catch(() => {})}>
                Отправить код
              </button>
            )}
          </div>
        )}

        {(stage === 'join' || stage === 'joining') && (
          <form className="bs-panel friend-box" onSubmit={join}>
            <div className="friend-label">Код от друга</div>
            <input
              className="name-input friend-input" value={code} maxLength={4} autoFocus
              autoComplete="off" autoCorrect="off" autoCapitalize="characters" spellCheck={false} enterKeyHint="go"
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4))}
              placeholder="ABCD"
            />
            <button type="submit" className="bs-btn bs-btn-gold" disabled={code.length !== 4 || stage === 'joining'}>
              {stage === 'joining' ? 'Входим…' : 'Войти'}
            </button>
          </form>
        )}

        {error && <div className="friend-error">{error}</div>}
      </div>
    </div>
  );
}
