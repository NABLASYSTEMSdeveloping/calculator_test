/// <reference types="vitest" />
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';

/** Версия сборки по умолчанию (CONTRACT.md, раздел 5.2). */
const DEFAULT_APP_VERSION = '1.0.0';

/**
 * CONTRACT.md, раздел 3.2/5.2: `GET /healthz` отдаёт
 * `{"status":"ok","service":"frontend","version":<VITE_APP_VERSION>}`.
 *
 * `public/healthz.json` — значение по умолчанию для dev-режима (`vite dev` отдаёт файл как `/healthz.json`).
 * На сборке тот же файл перезаписывается в `dist/` с версией из build-time переменной окружения,
 * чтобы значение `VITE_APP_VERSION` реально влияло на пробы контейнера.
 */
function healthzPlugin(appVersion: string): Plugin {
  let outputDir = '';
  return {
    name: 'calculator-test-app:healthz-version',
    apply: 'build',
    configResolved(config) {
      outputDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const payload = { status: 'ok', service: 'frontend', version: appVersion };
      writeFileSync(resolve(outputDir, 'healthz.json'), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    },
  };
}

export default defineConfig(({ mode }) => {
  // process.cwd() — каталог frontend/ (команды запускаются из него: Makefile, Dockerfile WORKDIR).
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const appVersion = env.VITE_APP_VERSION ?? DEFAULT_APP_VERSION;

  return {
    plugins: [react(), healthzPlugin(appVersion)],
    server: {
      host: true,
      port: 5173,
    },
    preview: {
      host: true,
      port: 5173,
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
    test: {
      environment: 'jsdom',
      globals: true,
      css: false,
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      restoreMocks: true,
    },
  };
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
