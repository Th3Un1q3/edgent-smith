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
        { argsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-empty-interface": ["error", { allowSingleExtends: true }],
      "@typescript-eslint/no-non-null-assertion": "warn",
      "@typescript-eslint/explicit-function-return-type": "off",
      "unicorn/filename-case": [
        'error',
        {
          case: 'kebabCase',
        },
      ],
      // reduce/.concat() valid patterns here for array merging (instruction-indexer)
      "unicorn/no-array-reduce": "off",

      // Bun Glob.scan() on for-await header is the idiomatic pattern
      "unicorn/no-unreadable-for-of-expression": "off",
    },
  },

  {
    ignores: ["**/*.d.ts", "**/node_modules/", "**/__mocks__/"],
  },

  {
    files: ['tests/**'], // or any other pattern
    plugins: {
      vitest,
    },
    rules: {
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
