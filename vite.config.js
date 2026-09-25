import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// игра публикуется на https://shumkar-dev.github.io/arena-/

// Версия сборки: коммит на GitHub Actions, иначе время сборки. Зашивается в код
// (__APP_VERSION__) и кладётся в dist/version.json — по нему игра узнаёт, что вышла новая.
const version = (process.env.GITHUB_SHA ?? '').slice(0, 7) || `dev-${Date.now().toString(36)}`;

const versionFile = () => ({
  name: 'arena-version-file',
  apply: 'build',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version }) });
  },
});

export default defineConfig({
  base: '/arena-/',
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [react(), versionFile()],
  build: { chunkSizeWarningLimit: 900 }, // three.js сам по себе ~600 КБ
});
