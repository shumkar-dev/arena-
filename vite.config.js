import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// игра публикуется на https://shumkar-dev.github.io/arena/
export default defineConfig({
  base: '/arena/',
  plugins: [react()],
  build: { chunkSizeWarningLimit: 900 }, // three.js сам по себе ~600 КБ
});
