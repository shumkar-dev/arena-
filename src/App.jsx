import React, { useEffect, useRef, useState } from 'react';
import { createGame } from './game/engine.js';
import { heroById, HEROES } from './game/heroes.js';
import Joystick from './ui/Joystick.jsx';
import ActionButtons from './ui/ActionButtons.jsx';
import HeroSelect from './ui/HeroSelect.jsx';
import { sound } from './game/sound.js';

// клавиатура — только для отладки на компьютере; H — ударить себя (проверка смерти)
const KEYS = { KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };

const params = new URLSearchParams(location.search);
// ?hero=izyum — сразу на арену (для отладки и автотестов)
const startHero = HEROES.some((h) => h.id === params.get('hero')) ? params.get('hero') : null;

export default function App() {
  const [heroId, setHeroId] = useState(startHero);
  const [muted, setMuted] = useState(sound.muted);

  // по первому касанию: разрешить звук, а на телефоне — полный экран и горизонталь
  const onFirstTouch = () => {
    sound.unlock();
    const el = document.documentElement;
    if (document.fullscreenElement || !el.requestFullscreen) return;
    el.requestFullscreen({ navigationUI: 'hide' })
      .then(() => screen.orientation?.lock?.('landscape'))
      .catch(() => {});
  };

  return (
    <div className="game" onPointerDownCapture={onFirstTouch}>
      {heroId
        ? <Arena key={heroId} heroId={heroId} onExit={() => setHeroId(null)} />
        : <HeroSelect onPick={setHeroId} />}
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

function Arena({ heroId, onExit }) {
  const hero = heroById(heroId);
  const mountRef = useRef(null);
  const input = useRef({ moveX: 0, moveY: 0, attack: false, ult: false, ultAim: null, ultFire: null }).current;
  const [hud, setHud] = useState({ ultCd: 0, ultFrac: 0, ultActive: false, combo: 0, special: false, ultAim: 'tap', dead: false, respawnIn: 0 });

  useEffect(() => {
    const game = createGame(mountRef.current, input, setHud, heroId);
    // ?debug — доступ к бойцам из консоли и автотестов
    if (params.has('debug')) window.__game = game;

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
  }, [input, heroId]);

  return (
    <>
      <div ref={mountRef} className="viewport" />
      <div className="hud-top">
        <button className="hero-tag" onClick={onExit} aria-label="Сменить героя">
          ◀ {hero.name.toUpperCase()}
        </button>
      </div>
      <Joystick input={input} />
      <ActionButtons input={input} hud={hud} icons={hero.icons} />
      {hud.dead && (
        <div className="death">
          <div className="death-title">Вне игры</div>
          <div className="death-timer">{hero.name}: возрождение через {hud.respawnIn}</div>
        </div>
      )}
    </>
  );
}
