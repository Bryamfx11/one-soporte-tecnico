import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['one.db*', 'backups/', 'test/test.db*'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node }
    }
  }
];