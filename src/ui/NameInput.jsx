import React, { useState } from 'react';

export const NAME_MIN = 2;
export const NAME_MAX = 16;
export const cleanName = (s) => s.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);

// Поле ника с кнопкой «Сохранить» (Enter на клавиатуре — тоже сохранить).
export default function NameInput({ value, onSave, button = 'Сохранить', autoFocus = false }) {
  const [draft, setDraft] = useState(value);
  const [saved, setSaved] = useState(false);
  const name = cleanName(draft);
  const ok = name.length >= NAME_MIN;
  const save = (e) => {
    e?.preventDefault();
    if (!ok) return;
    onSave(name);
    setSaved(true);
    document.activeElement?.blur?.();   // спрятать клавиатуру
  };
  return (
    <form className="name-form" onSubmit={save}>
      <input
        className="name-input" type="text" inputMode="text" enterKeyHint="done"
        autoComplete="nickname" autoCorrect="off" autoCapitalize="off" spellCheck={false}
        maxLength={NAME_MAX} placeholder="Твой ник" value={draft} autoFocus={autoFocus}
        onChange={(e) => { setDraft(e.target.value); setSaved(false); }}
      />
      <button type="submit" className="bs-btn bs-btn-small bs-btn-gold name-save" disabled={!ok}>
        {saved && name === value ? '✓' : button}
      </button>
    </form>
  );
}
