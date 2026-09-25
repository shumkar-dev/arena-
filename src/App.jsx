import React, { useEffect, useRef, useState } from 'react';
import { createGame } from './game/engine.js';
import Joystick from './ui/Joystick.jsx';
import ActionButtons from './ui/ActionButtons.jsx';

// клавиатура — только для отладки на компьютере; H — ударить себя (проверка смерти)
const KEYS = { KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };

export default function App() {
  const mountRef = useRef(null);
  const input = useRef({ moveX: 0, moveY: 0, attack: false, ult: false }).current;
  const [hud, setHud] = useState({ ultCd: 0, ultFrac: 0, ultActive: false, combo: 0, grabbing: false, dead: false, respawnIn: 0 });

  useEffect(() => {
    const game = createGame(mountRef.current, input, setHud);
    // ?debug — доступ к бойцам из консоли и автотестов
    if (new URLSearchParams(location.search).has('debug')) window.__game = game;

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
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
    };
  }, [input]);

  // на телефоне по первому касанию — полный экран и горизонтальная ориентация
  const goFullscreen = () => {
    const el = document.documentElement;
    if (document.fullscreenElement || !el.requestFullscreen) return;
    el.requestFullscreen({ navigationUI: 'hide' })
      .then(() => screen.orientation?.lock?.('landscape'))
      .catch(() => {});
  };

  return (
    <div className="game" onPointerDownCapture={goFullscreen}>
      <div ref={mountRef} className="viewport" />
      <div className="hud-top">
        <div className="hero-tag">ШАБА</div>
      </div>
      <Joystick input={input} />
      <ActionButtons input={input} hud={hud} />
      {hud.dead && (
        <div className="death">
          <div className="death-title">Шаба выбыл</div>
          <div className="death-timer">Возрождение через {hud.respawnIn}</div>
        </div>
      )}
      <div className="rotate-hint">
        <div className="rotate-phone" />
        <p>Поверни телефон горизонтально</p>
      </div>
    </div>
  );
}
