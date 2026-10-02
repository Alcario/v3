import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    // Los tests que tocan Mongo comparten un servidor en memoria por archivo:
    // sin aislamiento por archivo se pisarían entre sí.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
      // `server.js` es el arranque del proceso: se verifica a mano (criterios 3 a 6
      // de la validación final), no con cobertura.
      exclude: ['src/server.js'],
      reporter: ['text', 'lcov'],
    },
  },
});
