import { useEffect, useState } from 'react';

// ============================================================
// ГОРИЗОНТАЛЬНЫЙ РЕЖИМ
// goLandscape() — полный экран + блокировка в горизонталь. Браузер разрешает это
// только по касанию (и не везде: iPhone Safari не умеет), поэтому игра пробует
// при запуске и при первом касании, а если не вышло — показывает «Поверни телефон».
// Установленное приложение (PWA) и так открывается горизонтально (manifest).
// ============================================================

export async function goLandscape() {
  const el = document.documentElement;
  try {
    if (!document.fullscreenElement && el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
  } catch { /* браузер не дал */ }
  try {
    await screen.orientation?.lock?.('landscape');
    return true;
  } catch {
    return false;
  }
}

const typing = () => {
  const a = document.activeElement;
  return !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA');
};

// Телефон держат вертикально? Считаем по ориентации экрана, а не окна: когда
// открыта клавиатура, окно становится «высоким», но телефон повёрнут как был.
function isPortrait() {
  if (!matchMedia('(pointer: coarse)').matches) return false;
  const type = screen.orientation?.type;
  if (type) return type.startsWith('portrait');
  if (typeof window.orientation === 'number') return window.orientation === 0 || window.orientation === 180;
  return window.innerHeight > window.innerWidth;
}

export function usePortrait() {
  const [portrait, setPortrait] = useState(isPortrait);
  useEffect(() => {
    const update = () => { if (!typing()) setPortrait(isPortrait()); };
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    screen.orientation?.addEventListener?.('change', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      screen.orientation?.removeEventListener?.('change', update);
    };
  }, []);
  return portrait;
}
