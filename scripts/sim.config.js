import { defineConfig } from 'vite';

// Сборка прогона дуэлей без картинки (scripts/sim.js) — как сервер: код боя и three.js в один файл.
export default defineConfig({
  publicDir: false,
  build: {
    ssr: 'scripts/sim.js',
    outDir: 'scripts/dist',
    emptyOutDir: true,
    target: 'node20',
    rollupOptions: { output: { entryFileNames: 'sim.js' } },
  },
  ssr: { noExternal: ['three'] },
});
