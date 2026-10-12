import eslint from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/.seo-ssr/**',
      '**/coverage/**',
      '**/node_modules/**',
      'apps/api/src/generated/**',
      'output/**',
      'test-results/**',
      'playwright-report/**',
    ],
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    ...eslint.configs.recommended,
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ['apps/web/public/**/*.js'],
    languageOptions: {
      globals: globals.browser,
    },
  },
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ['**/*.{ts,tsx}'],
  })),
  {
    files: ['**/*.{ts,tsx}'],
    ignores: ['**/*.spec.ts', '**/*.test.ts', 'apps/api/test/**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['playwright.config.ts', 'tests/e2e/*.ts'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
      globals: globals.node,
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': ['error', {
        checksVoidReturn: { attributes: false },
      }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      'react-refresh/only-export-components': ['error', {
        allowConstantExport: true,
        allowExportNames: ['useToast'],
      }],
    },
  },
  {
    files: ['**/*.spec.ts', '**/*.test.ts', 'apps/api/test/**/*.ts'],
    languageOptions: {
      globals: globals.jest,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
