import React, { useMemo } from 'react';
import { duckIconUrl } from '../characters/duck.js';

// Значок утки-трофея в тексте (вместо эмодзи). Картинка рендерится из 3D-модели один раз.
export default function DuckIcon({ className = '' }) {
  const src = useMemo(duckIconUrl, []);
  if (!src) return <span className={`duck-icon ${className}`}>🦆</span>;
  return <img className={`duck-icon ${className}`} src={src} alt="утки" draggable={false} />;
}
