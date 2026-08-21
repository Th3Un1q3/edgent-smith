import unicorn from "eslint-plugin-unicorn"
import tseslint from "typescript-eslint"
import vitest from "@vitest/eslint-plugin"
import stylistic from "@stylistic/eslint-plugin"

const allFiles = ["**/plugins/**/*.ts", "**/helpers/**/*.ts", "**/types/**/*.ts"]
const PLUGIN_TESTS = '**/plugins/tests/**/*.ts'
const TOP_LEVEL_TESTS = '**/tests/*.test.ts'
const TEST_FILES = [PLUGIN_TESTS, TOP_LEVEL_TESTS]
const PLUGIN_ROOT = "**/plugins/*.ts"

// Custom rule: plugin root files (plugins/*.ts, NOT helpers/ tests/ types/) must only
// export Plugin-typed values. Exporting unrelated constants/variables from a plugin
// entry file breaks plugin loading (see the FIXME historically present in afk-enforcer.ts).
const pluginExportGuard = {
  rules: {
    "no-non-plugin-export": {
      meta: {
        type: "problem",
        docs: {
          description:
            "Plugin root files must only export Plugin-typed values. Move unrelated constants to helpers/.",
        },
        messages: {
          nonPluginExport:
            "Plugin files must only export Plugin-typed values. Move unrelated constants/variables (e.g. '{{ name }}') to a helpers/ module.",
        },
        schema: [],
      },
      create(ctx) {
        return {
          ExportNamedDeclaration(node) {
            const declaration = node.declaration
            if (!declaration || declaration.type !== "VariableDeclaration") return
            for (const decl of declaration.declarations) {
              if (decl.id.type !== "Identifier") continue
              const annotation = decl.id.typeAnnotation
              const isPluginAnnotated =
                annotation?.type === "TSTypeAnnotation" &&
                annotation.typeAnnotation.type === "TSTypeReference" &&
                annotation.typeAnnotation.typeName.type === "Identifier" &&
                annotation.typeAnnotation.typeName.name === "Plugin"
              const init = decl.init
              const isFunction =
                init != null &&
                (init.type === "ArrowFunctionExpression" || init.type === "FunctionExpression")
              if (!isPluginAnnotated && !isFunction) {
                ctx.report({
                  node: decl,
                  messageId: "nonPluginExport",
                  data: { name: decl.id.name },
                })
              }
            }
          },
        }
      },
    },
  },
}

export default [
  ...tseslint.configs.recommended.map((c) => ({
    ...c,
    files: ["**/*.ts"],
  })),
  // Unicorn flat config — recommended only (all preset too aggressive for this codebase)
  {
    ...unicorn.configs["flat/recommended"],
    files: allFiles
  },
  {
    ...stylistic.configs.recommended,
    files: allFiles
  },
  {
    files: allFiles,
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-empty-object-type": ["error", { allowInterfaces: "with-single-extends" }],
      // Disallow all console methods — use @plugins/helpers/logger instead
      "no-console": "error",

      // reduce/.concat() valid patterns here for array merging (instruction-indexer)
      "unicorn/no-array-reduce": "off",

      // .sort() with spread copy is safe and idiomatic
      "unicorn/no-array-sort": "off",

      // Bun Glob.scan() on for-await header is the idiomatic pattern
      "unicorn/no-unreadable-for-of-expression": "off",
    },
  },

  {
    ignores: ["**/*.d.ts", "**/node_modules/", "**/__mocks__/"],
  },
  {
    files: allFiles,
    // Inline rule to forbid eslint-disable comments (eslint-plugin-eslint-comments incompatible with ESLint 10)
    plugins: {
      "ban-disable": {
        rules: {
          "no-eslint-disable": {
            meta: { type: "problem", messages: { noDisable: "eslint-disable comments are forbidden. Fix the underlying issue or update the ESLint config." } },
            create(ctx) {
              return {
                Program(node) {
                  for (const c of ctx.sourceCode.getAllComments()) {
                    if (/^\s*eslint-disable/.test(c.value)) ctx.report({ node, loc: c.loc, messageId: "noDisable" })
                  }
                }
              }
            }
          }
        }
      }
    },
    rules: { "ban-disable/no-eslint-disable": "error" },
  },
  {
    // Plugin root files (direct children of a plugins/ dir) must only export
    // Plugin-typed values. helpers/, tests/, and types/ are exempt.
    files: [PLUGIN_ROOT],
    plugins: { "plugin-export-guard": pluginExportGuard },
    rules: { "plugin-export-guard/no-non-plugin-export": "error" },
  },
  {
    files: allFiles,
    rules: {
      "@typescript-eslint/no-non-null-assertion": "error",
    },
  },
  {
    files: ["**/plugins/tests/__utils/**/*.ts", "**/plugins/tests/helpers/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    files: [PLUGIN_TESTS],
    plugins: {
      vitest,
    },
    rules: {
      "@typescript-eslint/no-non-null-assertion": "warn",
      "max-lines": ["error", { "max": 650, "skipBlankLines": true, "skipComments": true }],
      "unicorn/consistent-function-scoping": "off",
      "unicorn/no-null": "off",
      ...vitest.configs.recommended.rules, // you can also use vitest.configs.all.rules to enable all rules
      'vitest/expect-expect': ['error', { assertFunctionNames: ['expect', 'expectTypeOf'] }],
      'vitest/max-nested-describe': ['error', { max: 3 }], // you can also modify rules' behavior using option like this
    },
  },

  // Test file style rules: arrow functions, no abbreviations, one var per line
  {
    files: [TOP_LEVEL_TESTS],
    plugins: {
      '@stylistic': stylistic,
    },
    rules: {
      'unicorn/consistent-function-style': ['error', { default: 'arrow-function', namedFunctions: 'arrow-function', namedExports: 'arrow-function' }],
      'unicorn/name-replacements': ['error', {
        allowList: {
          e: true, i: true, n: true, fn: true, idx: true,
          len: true, msg: true, res: true, val: true, acc: true, arr: true,
        },
      }],
      '@stylistic/one-var-declaration-per-line': 'error',
      '@stylistic/padding-line-between-statements': ['error',
        // Allow same-type sequences (no blank required)
        { blankLine: 'any', prev: 'import', next: 'import' },
        { blankLine: 'any', prev: 'const', next: 'const' },
        { blankLine: 'any', prev: 'expression', next: 'expression' },
        // Blank after last import (before any non-import)
        { blankLine: 'always', prev: 'import', next: '*' },
        // Blank between const and other types
        { blankLine: 'always', prev: 'const', next: 'expression' },
        { blankLine: 'always', prev: 'const', next: 'function' },
        { blankLine: 'always', prev: 'expression', next: 'const' },
        { blankLine: 'always', prev: 'function', next: 'const' },
        // Blank before function declarations
        { blankLine: 'always', prev: '*', next: 'function' },
      ],
    },
  },

  {
    files: [PLUGIN_TESTS],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        { patterns: ['../*', './*'] },
      ],
    },
  },

  // Cyclomatic complexity — uniform max 8 across plugin source and tests.
  // Source: plugin root files + helpers/ + types/ + config/ (everything under
  // plugins/ except tests/). Tests (incl. test helpers under plugins/tests/)
  // are held to the same limit. Fix complexity rather than release it.
  {
    files: [
      PLUGIN_ROOT,
      '**/plugins/helpers/**/*.ts',
      '**/plugins/types/**/*.ts',
      '**/plugins/config/**/*.ts',
      '**/helpers/**/*.ts',
      '**/types/**/*.ts',
      ...TEST_FILES,
    ],
    rules: {
      complexity: ['error', { max: 8 }],
    },
  },
]
