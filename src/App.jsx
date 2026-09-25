import React, { useCallback, useMemo, useState } from 'react';
import { HEROES } from './heroes/index.js';
import { MODES } from './modes/index.js';
import Arena from './ui/Arena.jsx';
import HeroSelect from './ui/HeroSelect.jsx';
import { sound } from './game/sound.js';

const params = new URLSearchParams(location.search);
// Отладка и автотесты:
//   ?mode=duel — режим (duel, training…);    ?hero=izyum — сразу на арену этим героем
//   ?bot=shaba — каким героем играет бот;    ?dummy — то же, что ?mode=training
//   ?autoplay — за игрока тоже играет бот;   ?fast=4 — ускорить симуляцию в 4 раза
//   ?debug — матч в консоли: window.__game
const knownHero = (id) => (HEROES.some((h) => h.id === id) ? id : null);
const knownMode = (id) => (MODES.some((m) => m.id === id) ? id : null);
const startHero = knownHero(params.get('hero'));
const startMode = params.has('dummy') ? 'training' : knownMode(params.get('mode')) ?? MODES[0].id;
const debug = params.has('debug');

export default function App() {
  const [modeId, setModeId] = useState(startMode);
  const [heroId, setHeroId] = useState(startHero);
  const [inArena, setInArena] = useState(!!startHero);
  const [round, setRound] = useState(0);        // «Ещё раз» — новый матч с теми же героем и режимом
  const [muted, setMuted] = useState(sound.muted);

  const options = useMemo(() => ({
    botHeroId: knownHero(params.get('bot')),
    autoplay: params.has('autoplay'),
    fast: Math.max(1, Math.min(20, Number(params.get('fast')) || 1)),
  }), []);

  // по первому касанию: разрешить звук, а на телефоне — полный экран и горизонталь
  const onFirstTouch = () => {
    sound.unlock();
    const el = document.documentElement;
    if (document.fullscreenElement || !el.requestFullscreen) return;
    el.requestFullscreen({ navigationUI: 'hide' })
      .then(() => screen.orientation?.lock?.('landscape'))
      .catch(() => {});
  };

  const start = (id) => { setHeroId(id); setInArena(true); setRound((r) => r + 1); };
  const again = useCallback(() => setRound((r) => r + 1), []);
  const exit = useCallback(() => setInArena(false), []);

  return (
    <div className="game" onPointerDownCapture={onFirstTouch}>
      {inArena
        ? <Arena key={`${modeId}-${heroId}-${round}`} modeId={modeId} heroId={heroId} options={options} debug={debug} onExit={exit} onAgain={again} />
        : <HeroSelect modeId={modeId} onMode={setModeId} onPick={start} />}
      <button
        className="sound-toggle"
        onClick={() => { sound.setMuted(!muted); setMuted(!muted); }}
        aria-label={muted ? 'Включить звук' : 'Выключить звук'}
      >
        {muted ? '🔇' : '🔊'}
      </button>
      <div className="rotate-hint">
        <div className="rotate-phone" />
        <p>Поверни телефон горизонтально</p>
      </div>
    </div>
  );
}
