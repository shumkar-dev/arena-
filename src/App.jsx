import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { HEROES } from './heroes/index.js';
import { MODES } from './modes/index.js';
import Arena from './ui/Arena.jsx';
import MainMenu from './ui/menu/MainMenu.jsx';
import ModeSelect from './ui/menu/ModeSelect.jsx';
import HeroPicker from './ui/menu/HeroPicker.jsx';
import Settings from './ui/menu/Settings.jsx';
import Rating from './ui/menu/Rating.jsx';
import { loadPrefs, savePrefs } from './ui/prefs.js';
import { sound } from './game/sound.js';
import { rankOf, rewardFor, isRanked, botSkill } from './rating/ranks.js';
import { playerDucks, pickBotNames, applyMatch, flush } from './rating/store.js';

const params = new URLSearchParams(location.search);
// Отладка и автотесты:
//   ?mode=duel — режим (duel, teams, ffa, training); ?hero=izyum — сразу на арену этим героем
//   ?bot=shaba — каким героем играет бот (1 на 1);   ?dummy — то же, что ?mode=training
//   ?autoplay — за игрока тоже играет бот;           ?fast=4 — ускорить симуляцию в 4 раза
//   ?debug — матч в консоли: window.__game
const knownHero = (id) => (HEROES.some((h) => h.id === id) ? id : null);
const knownMode = (id) => (MODES.some((m) => m.id === id) ? id : null);
const urlHero = knownHero(params.get('hero'));
const urlMode = params.has('dummy') ? 'training' : knownMode(params.get('mode'));
const debug = params.has('debug');

export default function App() {
  const [prefs, setPrefs] = useState(() => {
    const p = loadPrefs();
    return {
      ...p,
      modeId: urlMode ?? knownMode(p.modeId) ?? MODES[0].id,
      heroId: urlHero ?? knownHero(p.heroId) ?? HEROES[0].id,
    };
  });
  const [view, setView] = useState(urlHero ? 'arena' : 'main');   // экран: main, modes, heroes, settings, rating, arena
  const [round, setRound] = useState(0);        // «Ещё раз» — новый матч с теми же героем и режимом
  const [muted, setMuted] = useState(sound.muted);
  const [ducks, setDucks] = useState(playerDucks);   // утки игрока (рейтинг)

  const update = useCallback((patch) => setPrefs((p) => ({ ...p, ...patch })), []);
  useEffect(() => { savePrefs(prefs); sound.setVolume(prefs.volume); }, [prefs]);
  useEffect(() => { flush(); }, []);   // отправить то, что не ушло в прошлый раз

  const playerName = prefs.playerName.trim() || 'Игрок';

  // на каждый матч: соперники твоего уровня из рейтинга и мастерство ботов по твоему званию
  // (утки берутся на момент старта — чтобы награда не пересоздавала идущий матч)
  const options = useMemo(() => {
    const d = playerDucks();
    return {
      botHeroId: knownHero(params.get('bot')),
      autoplay: params.has('autoplay'),
      fast: Math.max(1, Math.min(20, Number(params.get('fast')) || 1)),
      quality: prefs.quality,
      playerName: prefs.playerName.trim() || undefined,
      botNames: pickBotNames(3, d),
      botOptions: { skill: botSkill(d) },
    };
  }, [prefs.quality, prefs.playerName, round]);

  // итог матча → утки всем участникам (и ботам), игроку — что показать на экране итога
  const onResult = useCallback((result) => {
    if (!isRanked(result.modeId) || params.has('autoplay')) return null;
    const entries = result.participants.map((p) => ({ ...p, delta: rewardFor({ ...p, modeId: result.modeId }) }));
    const me = entries.find((e) => e.isPlayer);
    const { before, after } = applyMatch(entries, playerName);
    setDucks(after);
    const was = rankOf(before), rank = rankOf(after);
    return { delta: me?.delta ?? 0, after, rank, rankUp: rank.index > was.index, rankDown: rank.index < was.index };
  }, [playerName]);

  // по первому касанию: разрешить звук, а на телефоне — полный экран и горизонталь
  const onFirstTouch = () => {
    sound.unlock();
    const el = document.documentElement;
    if (document.fullscreenElement || !el.requestFullscreen) return;
    el.requestFullscreen({ navigationUI: 'hide' })
      .then(() => screen.orientation?.lock?.('landscape'))
      .catch(() => {});
  };

  const setMute = (v) => { sound.setMuted(v); setMuted(v); };
  const again = useCallback(() => setRound((r) => r + 1), []);
  const toMenu = useCallback(() => setView('main'), []);
  const play = () => { setRound((r) => r + 1); setView('arena'); };

  let body;
  if (view === 'arena') {
    body = <Arena key={`${prefs.modeId}-${prefs.heroId}-${round}`} modeId={prefs.modeId} heroId={prefs.heroId} options={options} debug={debug} onExit={toMenu} onAgain={again} onResult={onResult} />;
  } else if (view === 'modes') {
    body = <ModeSelect modeId={prefs.modeId} onPick={(id) => { update({ modeId: id }); setView('main'); }} onBack={toMenu} />;
  } else if (view === 'heroes') {
    body = <HeroPicker heroId={prefs.heroId} onPick={(id) => { update({ heroId: id }); setView('main'); }} onBack={toMenu} />;
  } else if (view === 'settings') {
    body = <Settings prefs={prefs} muted={muted} onMuted={setMute} onChange={update} onBack={toMenu} />;
  } else if (view === 'rating') {
    body = <Rating ducks={ducks} playerName={playerName} onBack={toMenu} onDucks={setDucks} />;
  } else {
    const rank = rankOf(ducks);
    const badge = (
      <button className="rank-badge" onClick={() => setView('rating')}>
        <span className="rank-badge-ducks">🦆 {ducks}</span>
        <span className="rank-badge-name" style={{ color: rank.color }}>{rank.name}</span>
      </button>
    );
    body = <MainMenu prefs={prefs} onPlay={play} go={setView} rankBadge={badge} />;
  }

  return (
    <div className={`game ${view === 'arena' ? 'in-arena' : 'in-menu'}`} onPointerDownCapture={onFirstTouch}>
      {body}
      <button
        className="sound-toggle"
        onClick={() => setMute(!muted)}
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
