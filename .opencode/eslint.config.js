import unicorn from "eslint-plugin-unicorn"
import tseslint from "typescript-eslint"

export default [
  ...tseslint.configs.recommended.map((c) => ({
    ...c,
    files: ["**/*.ts", "**/*.mts"],
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
    ignores: ["**/*.d.ts", "**/node_modules/", "**/tests/", "**/__mocks__/"],
  },
]
