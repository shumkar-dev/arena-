import { defineConfig } from 'vite';

// Сборка игрового сервера в один файл server/dist/index.js:
// код боя (src/game, src/heroes, src/modes…) и three.js — внутрь, ws — отдельным пакетом.
export default defineConfig({
  publicDir: false,
  build: {
    ssr: 'server/index.js',
    outDir: 'server/dist',
    emptyOutDir: true,
    target: 'node20',
    rollupOptions: { output: { entryFileNames: 'index.js' } },
  },
  ssr: { noExternal: ['three'], external: ['ws'] },
});
