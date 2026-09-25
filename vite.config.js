import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' — сборка работает и на GitHub Pages (/arena-/), и позже в Telegram Mini App
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { chunkSizeWarningLimit: 900 }, // three.js сам по себе ~600 КБ
});
