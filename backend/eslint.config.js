import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default [
  { ignores: ['coverage/**', 'node_modules/**'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      // El logger estructurado es el único canal de salida permitido (SECURITY.md §8).
      // La excepción es `process.stderr` en el arranque, antes de que el logger exista.
      'no-console': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-return-await': 'error',
      'require-await': 'error',
    },
  },
  {
    // Los tests pueden usar el reloj y afirmar sobre internals; no necesitan otras reglas.
    files: ['tests/**/*.js'],
    rules: { 'require-await': 'off' },
  },
  prettier,
];
