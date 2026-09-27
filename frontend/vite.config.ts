import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * Интерфейс сборки и запуска сервиса frontend.
 * Значения зафиксированы контрактом: docs/contracts/frontend.md (раздел «Сборка и запуск»).
 */
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: true,
    port: 4173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    target: 'es2022',
    sourcemap: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    restoreMocks: true,
    css: false,
  },
});
