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
  // громкость 0..1 — положение ползунка (слышимая громкость — по квадрату, см. sound.js)
  volume: 0.9,            // звуки (удары, взрывы)
  voiceVolume: 0.95,      // голоса героев
  musicVolume: 0.7,       // музыка
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
