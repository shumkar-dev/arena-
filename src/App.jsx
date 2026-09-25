import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { music } from './game/music.js';
import { rankOf, rewardFor, isRanked, botSkill } from './rating/ranks.js';
import { playerDucks, pickBotNames, applyMatch, syncPlayer } from './rating/store.js';
import DuckIcon from './ui/DuckIcon.jsx';
import NameModal from './ui/menu/NameModal.jsx';
import { goLandscape, usePortrait } from './ui/orientation.js';
import FriendPlay from './ui/menu/FriendPlay.jsx';
import UpdateBanner from './ui/UpdateBanner.jsx';
import { useUpdateAvailable } from './ui/update.js';
import { createNet } from './net/client.js';

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

  // игра с другом по сети: соединение одно на всё приложение
  const netRef = useRef(null);
  if (!netRef.current) netRef.current = createNet();
  const net = netRef.current;
  const [lobby, setLobby] = useState(null);        // комната до боя: { code, mode, you, host, slots }
  const [netGame, setNetGame] = useState(null);     // идёт сетевой бой: { modeId, you, host, roster, n }
  const [netReward, setNetReward] = useState(null); // утки за последний сетевой бой
  const [netNotice, setNetNotice] = useState('');   // связь потеряна — бой не продолжить
  const [netToast, setNetToast] = useState('');     // «игрок вышел — за него бот»
  const [versionIssue, setVersionIssue] = useState(null);   // версии игры и сервера не совпали
  const updateAvailable = useUpdateAvailable();
  const netGameRef = useRef(null);
  netGameRef.current = netGame;
  const nameRef = useRef('Игрок');
  useEffect(() => {
    let toastTimer = 0;
    const toast = (text) => { setNetToast(text); clearTimeout(toastTimer); toastTimer = setTimeout(() => setNetToast(''), 4000); };
    const offs = [
      net.on('lobby', (m) => setLobby(m)),
      net.on('start', (m) => {
        setNetGame((g) => ({ modeId: m.mode, you: m.you, host: m.host, roster: m.roster, n: (g?.n ?? 0) + 1 }));
        setNetReward(null);
        setNetNotice('');
        setView('arena-net');
      }),
      // итог решил сервер: свои утки записываем сами, утки ботов — только создатель комнаты
      // (иначе каждому боту начислили бы столько раз, сколько людей в комнате)
      net.on('end', (m) => {
        const g = netGameRef.current;
        if (!g || !m.res?.[g.you]) return;
        const entries = [{ name: nameRef.current, isPlayer: true, delta: m.res[g.you].delta }];
        if (g.you === g.host) {
          g.roster.forEach((r, i) => { if (r.bot && m.res[i]) entries.push({ name: r.name, isBot: true, delta: m.res[i].delta }); });
        }
        const { before, after } = applyMatch(entries, nameRef.current);
        setDucks(after);
        const was = rankOf(before), rank = rankOf(after);
        setNetReward({ delta: entries[0].delta, after, rank, rankUp: rank.index > was.index, rankDown: rank.index < was.index });
      }),
      net.on('left', (m) => toast(`${m.name} вышел — за него играет бот`)),
      net.on('version', (issue) => setVersionIssue(issue)),
      net.on('err', (m) => toast(m.msg)),
      net.on('close', () => { setLobby(null); setNetNotice((n) => n || 'Связь с сервером потеряна'); }),
    ];
    return () => { clearTimeout(toastTimer); offs.forEach((off) => off()); };
  }, [net]);

  const update = useCallback((patch) => setPrefs((p) => ({ ...p, ...patch })), []);
  useEffect(() => {
    savePrefs(prefs);
    sound.setVolume(prefs.volume);
    sound.setBusVolume('voice', prefs.voiceVolume);
    sound.setBusVolume('music', prefs.musicVolume);
  }, [prefs]);
  // музыка: в бою — боевая, в меню — своя (переход плавный, см. music.js)
  useEffect(() => { music.play(view.startsWith('arena') ? 'battle' : 'menu'); }, [view]);


  const playerName = prefs.playerName.trim() || 'Игрок';
  nameRef.current = playerName;
  // отправить то, что не ушло в прошлый раз, и записать себя в общую таблицу
  useEffect(() => { if (prefs.playerName.trim()) syncPlayer(playerName); }, [playerName]);
  const needName = !prefs.playerName.trim() && !view.startsWith('arena') && !params.has('autoplay');   // первый вход — спросить ник

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

  // горизонталь на весь экран: пробуем сразу при запуске (сработает в установленном
  // приложении), затем при касаниях — браузеры разрешают это только по жесту
  const portrait = usePortrait();
  useEffect(() => { goLandscape(); }, []);
  const onTouch = (e) => {
    sound.unlock();
    if (e.target.closest?.('input, textarea, .name-form')) return;   // не мешать вводу ника
    if (matchMedia('(pointer: coarse)').matches && (!document.fullscreenElement || portrait)) goLandscape();
  };

  const setMute = (v) => { sound.setMuted(v); setMuted(v); };
  const again = useCallback(() => setRound((r) => r + 1), []);
  const toMenu = useCallback(() => setView('main'), []);
  const leaveNet = useCallback(() => {
    net.leave(); setLobby(null); setNetGame(null); setNetNotice(''); setView('main');
  }, [net]);
  const netOptions = useMemo(() => netGame && ({
    quality: prefs.quality,
    net: { conn: net, modeId: netGame.modeId, roster: netGame.roster, you: netGame.you },
  }), [netGame, prefs.quality, net]);

  const play = () => { setRound((r) => r + 1); setView('arena'); };

  const audio = { prefs, onChange: update, muted };

  let body;
  if (view === 'arena-net' && netGame) {
    body = (
      <Arena key={`net-${netGame.n}`} modeId="online" heroId={netGame.roster[netGame.you].hero} options={netOptions} debug={debug}
        onExit={leaveNet} onAgain={() => setView('friend')} againLabel="В комнату" reward={netReward} notice={netNotice} toast={netToast} audio={audio} updateAvailable={updateAvailable} />
    );
  } else if (view === 'friend') {
    body = <FriendPlay net={net} lobby={lobby} heroId={prefs.heroId} playerName={playerName} ducks={ducks} onHero={(id) => update({ heroId: id })} versionIssue={versionIssue} onLeave={() => { net.leave(); setLobby(null); }} onBack={toMenu} />;
  } else if (view === 'arena') {
    body = <Arena key={`${prefs.modeId}-${prefs.heroId}-${round}`} modeId={prefs.modeId} heroId={prefs.heroId} options={options} debug={debug} onExit={toMenu} onAgain={again} onResult={onResult} audio={audio} updateAvailable={updateAvailable} />;
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
        <span className="rank-badge-ducks"><DuckIcon /> {ducks}</span>
        <span className="rank-badge-name" style={{ color: rank.color }}>{rank.name}</span>
      </button>
    );
    body = <MainMenu prefs={prefs} onPlay={play} go={setView} rankBadge={badge} />;
  }

  return (
    <div className={`game ${view.startsWith('arena') ? 'in-arena' : 'in-menu'}`} onPointerDownCapture={onTouch}>
      {body}
      <button
        className="sound-toggle"
        onClick={() => setMute(!muted)}
        aria-label={muted ? 'Включить звук' : 'Выключить звук'}
      >
        {muted ? '🔇' : '🔊'}
      </button>
      {updateAvailable && !view.startsWith('arena') && <UpdateBanner />}
      {needName && <NameModal onSave={(name) => update({ playerName: name })} />}
      <div className={`rotate-hint ${portrait ? 'show' : ''}`}>
        <div className="rotate-phone" />
        <p>Поверни телефон горизонтально</p>
        <button className="bs-btn bs-btn-gold" onClick={goLandscape}>Развернуть</button>
      </div>
    </div>
  );
}
