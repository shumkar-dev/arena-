import { useEffect, useState } from 'react';

// ============================================================
// ОБНОВЛЕНИЯ ИГРЫ. Версия сборки зашита в код (__APP_VERSION__, vite.config.js)
// и лежит на сайте в version.json. Игра сверяет их при запуске, раз в 5 минут
// и когда её снова открывают из фона. Новее — App показывает в меню «Доступно
// обновление» (в бою — нет: после боя, когда вернёшься в меню).
// ============================================================

export const APP_VERSION = __APP_VERSION__;
const BASE = import.meta.env.BASE_URL;
const EVERY = 5 * 60 * 1000;

export async function latestVersion() {
  const r = await fetch(`${BASE}version.json?t=${Date.now()}`, { cache: 'no-store' });
  if (!r.ok) return null;
  return (await r.json()).version ?? null;
}

/** true — на сайте вышла версия новее той, что запущена. */
export function useUpdateAvailable() {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    if (!import.meta.env.PROD) return undefined;
    const check = () => latestVersion().then((v) => { if (v && v !== APP_VERSION) setAvailable(true); }).catch(() => {});
    check();
    const timer = setInterval(check, EVERY);
    const onShow = () => { if (!document.hidden) check(); };
    document.addEventListener('visibilitychange', onShow);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onShow); };
  }, []);
  return available;
}

/**
 * Перезагрузиться на новую версию. Адрес с меткой ?u=… гарантирует, что страница
 * придёт с сайта, а не из кэша телефона (так работает и со старым service worker).
 */
export async function applyUpdate() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    await reg?.update();
  } catch { /* не страшно — страница всё равно придёт свежей */ }
  const url = new URL(location.href);
  url.searchParams.set('u', Date.now().toString(36));
  location.replace(url.toString());
}

// после обновления убрать метку из адреса
{
  const url = new URL(location.href);
  if (url.searchParams.has('u')) {
    url.searchParams.delete('u');
    history.replaceState(null, '', url.toString());
  }
}
