import unicorn from "eslint-plugin-unicorn"
import tseslint from "typescript-eslint"

export default [
  ...tseslint.configs.recommended.map((c) => ({
    ...c,
    files: ["**/*.ts", "**/*.mts"],
  })),
  // Unicorn flat config — recommended only (all preset too aggressive for this codebase)
  { ...unicorn.configs["flat/recommended"], files: ["**/plugins/**/*.ts", "**/helpers/**/*.ts", "**/types/**/*.ts"] },
  // Custom rules and overrides for plugins/helpers/types (overrides presets above)
  {
    files: ["**/plugins/**/*.ts", "**/helpers/**/*.ts", "**/types/**/*.ts"],
    languageOptions: {
      parserOptions: {
        tsconfigFlag: true,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-empty-interface": ["error", { allowSingleExtends: true }],
      "@typescript-eslint/no-non-null-assertion": "warn",
      "@typescript-eslint/explicit-function-return-type": "off",
    },
  },
  // kebab-case filenames are intentional for plugins and helpers; disable unicorn/filename-case here
  {
    files: ["**/plugins/**/*.ts", "**/helpers/**/*.ts", "**/types/**/*.ts"],
    rules: {
      "unicorn/filename-case": [
        'error',
        {
          case: 'kebabCase',
        },
      ],
    },
  },

  // Disable unicorn/recommended rules that conflict with this codebase's intentional patterns:
  {
    files: ["**/plugins/**/*.ts", "**/helpers/**/*.ts", "**/types/**/*.ts"],
    rules: {
      // harness-plugin.ts is an intentional empty template/homedir placeholder
      "unicorn/no-empty-file": "off",

      // Glob.match() calls produce false positives; String.match() with groups needed elsewhere (instruction-indexer)
      "unicorn/prefer-regexp-test": "off",

      // explicit assignment preferred for readability over ||= pattern
      "unicorn/logical-assignment-operators": "off",

      // reduce/.concat() valid patterns here for array merging (instruction-indexer)
      "unicorn/no-array-reduce": "off",
      "unicorn/prefer-spread": "off",

      // `dir` is intentional shorthand for directory path in this codebase
      "unicorn/name-replacements": "off",

      // explicit null used as sentinel value consistently across session state (kv-store, todo-enforcer)
      "unicorn/no-null": "off",

      // dynamic property access on session/state objects is intentional for extensibility
      "unicorn/no-computed-property-existence-check": "off",

      // await + member chaining clearer than separate statement (todo-enforcer)
      "unicorn/no-await-expression-member": "off",

      // style preference; existing patterns valid (todo-enforcer)
      "unicorn/no-declarations-before-early-exit": "off",

      // Bun Glob.scan() on for-await header is the idiomatic pattern
      "unicorn/no-unreadable-for-of-expression": "off",
    },
  },

  {
    ignores: ["**/*.d.ts", "**/node_modules/", "**/tests/", "**/__mocks__/"],
  },
]
