import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const frameworkImports = ['@nestjs/*'];
const outerLayerImports = ['**/application/**', '**/adapters/**', '**/config/**'];

export default tseslint.config(
  {
    ignores: ['**/coverage/**', '**/dist/**', '**/node_modules/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['services/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/explicit-function-return-type': ['error', { allowExpressions: true }],
      '@typescript-eslint/no-import-type-side-effects': 'error',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/services/**'],
              message: 'Không import source trực tiếp từ service khác.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['services/*/src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [...frameworkImports, ...outerLayerImports],
              message: 'Domain phải độc lập với framework và outer layer.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['services/*/src/application/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [...frameworkImports, '**/adapters/**', '**/config/**'],
              message: 'Application chỉ được phụ thuộc domain và port của chính nó.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['services/**/test/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.jest,
        ...globals.node,
      },
    },
  },
  eslintConfigPrettier,
);
