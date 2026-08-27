// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/build/**',
      'apps/ios/**',
      '**/*.generated.ts',
      // Deno, not Node: jsr:/https: imports and no tsconfig, so the
      // type-aware rules have no project to resolve them against.
      'packages/db/supabase/functions/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // node:test's describe/it return promises that the runner owns. They
    // are deliberately not awaited.
    files: ['**/tests/**/*.ts', '**/*.test.ts'],
    rules: {
      // supabase-js narrows its result types from the generated Database
      // type. Until `pnpm db:types` replaces the placeholder, nullability
      // of `data` flips back and forth, and these tests assert runtime
      // behaviour anyway, not types.
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      // Test doubles stand in for async APIs without doing async work,
      // and a no-op is often exactly the behaviour under test — a sleep
      // that does not sleep, a handler that does nothing.
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      // Stubs receive fetch's `string | URL | Request` but are only ever
      // handed strings.
      '@typescript-eslint/no-base-to-string': 'off',
      '@typescript-eslint/no-floating-promises': [
        'error',
        {
          allowForKnownSafeCalls: [
            {
              from: 'package',
              package: 'node:test',
              name: ['describe', 'it', 'test', 'before', 'after', 'beforeEach', 'afterEach'],
            },
          ],
        },
      ],
    },
  },
  {
    // M0 0.2 / Fallstrick: der Service-Role-Key gehoert nie in den
    // Web-Workspace. Nur packages/pipeline kennt ihn.
    files: ['apps/web/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "Identifier[name='SUPABASE_SERVICE_ROLE_KEY']",
          message: 'Service-Role-Key gehoert ausschliesslich in packages/pipeline (siehe M0 0.2).',
        },
        {
          selector: 'Literal[value=/service_role/]',
          message: 'Service-Role-Key gehoert ausschliesslich in packages/pipeline (siehe M0 0.2).',
        },
      ],
    },
  },
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    ...tseslint.configs.disableTypeChecked,
  },
);
