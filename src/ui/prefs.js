// ============================================================
// НАСТРОЙКИ ИГРОКА — хранятся на устройстве (localStorage):
// выбранные режим и герой, имя, громкость, качество графики.
// Если хранилище недоступно (приватный режим), всё работает с настройками по умолчанию.
// ============================================================

const KEY = 'arena.prefs';

const DEFAULTS = {
  modeId: 'duel',
  heroId: 'shaba',
  playerName: '',
  volume: 0.8,
  quality: 'high',        // 'high' — тени и чёткость, 'low' — для слабых телефонов
};

export function loadPrefs() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

export function savePrefs(prefs) {
  try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* не сохранилось — не страшно */ }
}
