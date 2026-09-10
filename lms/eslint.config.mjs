import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tseslint from 'typescript-eslint';

const frameworkImports = ['@nestjs/*'];
const outerLayerImports = ['**/application/**', '**/adapters/**', '**/config/**'];
const workspaceRoot = path.dirname(fileURLToPath(import.meta.url));
const servicesRoot = path.join(workspaceRoot, 'services');
const sharedWorkspacePackages = new Set(['contracts', 'observability', 'testing']);

const noCrossServiceImportsRule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Cấm service import source hoặc package của service khác.',
    },
    schema: [],
    messages: {
      crossServiceImport: 'Không import trực tiếp từ service khác: {{source}}.',
    },
  },
  create(context) {
    const fileName = context.filename;
    const relativeFileName = path.relative(servicesRoot, fileName);

    if (relativeFileName.startsWith('..') || path.isAbsolute(relativeFileName)) {
      return {};
    }

    const [currentService] = relativeFileName.split(path.sep);

    function reportIfCrossService(node) {
      const source = node.source?.value;

      if (typeof source !== 'string') {
        return;
      }

      if (source.startsWith('.')) {
        const importedPath = path.resolve(path.dirname(fileName), source);
        const relativeImportedPath = path.relative(servicesRoot, importedPath);

        if (!relativeImportedPath.startsWith('..') && !path.isAbsolute(relativeImportedPath)) {
          const [targetService] = relativeImportedPath.split(path.sep);

          if (targetService !== currentService) {
            context.report({ node, messageId: 'crossServiceImport', data: { source } });
          }
        }

        return;
      }

      const workspacePackage = /^@aiops-lms\/([^/]+)/u.exec(source)?.[1];

      if (
        workspacePackage &&
        workspacePackage !== currentService &&
        !sharedWorkspacePackages.has(workspacePackage)
      ) {
        context.report({ node, messageId: 'crossServiceImport', data: { source } });
      }
    }

    return {
      ExportAllDeclaration: reportIfCrossService,
      ExportNamedDeclaration: reportIfCrossService,
      ImportDeclaration: reportIfCrossService,
    };
  },
};

export default tseslint.config(
  {
    ignores: ['**/coverage/**', '**/dist/**', '**/node_modules/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['services/**/*.ts'],
    plugins: {
      architecture: {
        rules: {
          'no-cross-service-imports': noCrossServiceImportsRule,
        },
      },
    },
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/explicit-function-return-type': ['error', { allowExpressions: true }],
      '@typescript-eslint/no-import-type-side-effects': 'error',
      'architecture/no-cross-service-imports': 'error',
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
