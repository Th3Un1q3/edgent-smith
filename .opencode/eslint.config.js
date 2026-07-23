import unicorn from "eslint-plugin-unicorn"
import tseslint from "typescript-eslint"
import vitest from "@vitest/eslint-plugin"

export default [
  ...tseslint.configs.recommended.map((c) => ({
    ...c,
    files: ["**/*.ts"],
  })),
  // Unicorn flat config — recommended only (all preset too aggressive for this codebase)
  { ...unicorn.configs["flat/recommended"], files: ["**/plugins/**/*.ts", "**/helpers/**/*.ts", "**/types/**/*.ts"] },
  {
    files: ["**/plugins/**/*.ts", "**/helpers/**/*.ts", "**/types/**/*.ts", "**/tests/**/*.test.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-empty-interface": ["error", { allowSingleExtends: true }],
      "@typescript-eslint/no-non-null-assertion": "warn",
      "@typescript-eslint/explicit-function-return-type": "off",

      // Disallow all console methods — use @plugins/helpers/logger instead
      "no-console": "error",

      "unicorn/filename-case": [
        'error',
        {
          case: 'kebabCase',
        },
      ],
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
    files: ["**/plugins/**/*.ts", "**/helpers/**/*.ts", "**/types/**/*.ts", "**/tests/**/*.test.ts", "**/tool/**/*.ts"],
    // Inline rule to forbid eslint-disable comments (eslint-plugin-eslint-comments incompatible with ESLint 10)
    plugins: { "ban-disable": { rules: {
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
    }}},
    rules: { "ban-disable/no-eslint-disable": "error" },
  },
  {
    files: ['**/plugins/tests/**/*.ts'],
    plugins: {
      vitest,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "max-lines": "off",
      "unicorn/consistent-function-scoping": "off",
      "unicorn/no-null": "off",
      ...vitest.configs.recommended.rules, // you can also use vitest.configs.all.rules to enable all rules
      'vitest/max-nested-describe': ['error', { max: 3 }], // you can also modify rules' behavior using option like this
    },
  },

  {
    files: ['**/plugins/tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        { patterns: ['../*', './*'] },
      ],
    },
  },
]
