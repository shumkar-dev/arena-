import React, { useEffect, useRef, useState } from 'react';
import { createGame } from '../game/engine.js';
import { heroById } from '../heroes/index.js';
import Joystick from './Joystick.jsx';
import ActionButtons from './ActionButtons.jsx';
import MatchResult from './MatchResult.jsx';
import VolumeSliders from './VolumeSliders.jsx';

// клавиатура — только для отладки на компьютере; H — ударить себя (проверка смерти)
const KEYS = { KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };

// Экран боя: 3D-арена, джойстик, кнопки, счёт режима, итог матча.
// reward — утки, если их считает не onResult, а сетевой итог (App); toast — короткое сообщение сверху
// audio — { prefs, onChange, muted }: ползунки громкости прямо в бою (кнопка ⚙, бой не останавливается)
export default function Arena({ modeId, heroId, options, debug, onExit, onAgain, onResult, againLabel, reward: rewardProp, notice, toast, audio, updateAvailable }) {
  const hero = heroById(heroId);
  const mountRef = useRef(null);
  const input = useRef({ moveX: 0, moveY: 0, attack: false, ult: false, ultAim: null, ultFire: null }).current;
  const [hud, setHud] = useState({ ultCd: 0, ultFrac: 0, ultActive: false, combo: 0, special: false, ultAim: 'tap', dead: false, respawnIn: 0 });
  const reported = useRef(false);
  const [reward, setReward] = useState(null);
  const [volOpen, setVolOpen] = useState(false);   // сколько уток дал матч (рейтинг)

  useEffect(() => {
    const game = createGame(mountRef.current, input, setHud, { modeId, heroId, ...options });
    // ?debug — доступ к матчу из консоли и автотестов
    if (debug) window.__game = game;

    const held = new Set();
    const sync = () => {
      let x = 0, y = 0;
      for (const k of held) { x += KEYS[k][0]; y += KEYS[k][1]; }
      input.moveX = x; input.moveY = y;
    };
    const kd = (e) => {
      if (KEYS[e.code]) { held.add(e.code); sync(); }
      else if (e.code === 'KeyJ' || e.code === 'Space') input.attack = true;
      else if (e.code === 'KeyK') input.ult = true;
      else if (e.code === 'KeyH') input.selfHit = true;   // отладка: ударить себя на 1000
    };
    const ku = (e) => { if (held.delete(e.code)) sync(); };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);

    return () => {
      game.dispose();
      if (window.__game === game) delete window.__game;
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
    };
  }, [input, heroId, modeId, options, debug]);

  // итог матча — один раз наверх: рейтинг раздаёт уток и возвращает, сколько получил игрок
  useEffect(() => {
    if (hud.result && !reported.current) { reported.current = true; setReward(onResult?.(hud.result) ?? null); }
  }, [hud.result, onResult]);

  const score = hud.mode?.score;
  return (
    <>
      <div ref={mountRef} className="viewport" />
      <div className="hud-top">
        <button className="hero-tag" onClick={onExit} aria-label="В меню">
          ◀ {hero.name.toUpperCase()}
        </button>
      </div>
      {hud.mode && (
        <div className="score">
          {score?.map((s, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="score-sep">{s.sep ?? ':'}</span>}
              {s.icon && <span className="score-icon">{s.icon}</span>}
              <span className={`score-val score-${s.side}`}>{s.value}</span>
            </React.Fragment>
          ))}
          {score?.find((s) => s.name) && <span className="score-name">{score.find((s) => s.name).name}</span>}
          {hud.mode.goal && <span className="score-goal">{hud.mode.goal}</span>}
        </div>
      )}
      <Joystick input={input} />
      <ActionButtons input={input} hud={hud} icons={hero.icons} />
      {hud.dead && !hud.result && (
        <div className="death">
          <div className="death-title">Вне игры</div>
          <div className="death-timer">
            {hud.respawnIn != null ? `${hero.name}: возрождение через ${hud.respawnIn}` : 'Смотри, кто победит'}
          </div>
        </div>
      )}
      {hud.ping != null && <div className="net-ping">📶 {hud.ping} мс</div>}
      {toast && <div className="net-toast">{toast}</div>}
      {audio && (
        <button className="vol-toggle" onClick={() => setVolOpen((v) => !v)} aria-label="Громкость">⚙️</button>
      )}
      {audio && volOpen && (
        <div className="vol-panel bs-panel">
          <div className="vol-panel-head">
            <span>Громкость</span>
            <button className="bs-btn bs-btn-small" onClick={() => setVolOpen(false)} aria-label="Закрыть">✕</button>
          </div>
          <VolumeSliders prefs={audio.prefs} onChange={audio.onChange} muted={audio.muted} heroId={heroId} />
        </div>
      )}
      {notice && (
        <div className="result lose">
          <div className="result-box">
            <div className="result-reason">{notice}</div>
            <div className="result-buttons"><button className="btn-big" onClick={onExit}>В меню</button></div>
          </div>
        </div>
      )}
      {hud.result && !notice && <MatchResult result={hud.result} reward={rewardProp ?? reward} againLabel={againLabel} updateAvailable={updateAvailable} onAgain={onAgain} onExit={onExit} />}
    </>
  );
}
