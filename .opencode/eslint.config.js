import tseslint from "typescript-eslint"

export default [
  ...tseslint.configs.recommended.map((c) => ({
    ...c,
    files: ["**/*.ts", "**/*.mts"],
  })),
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
  {
    ignores: ["**/*.d.ts", "**/node_modules/", "**/tests/", "**/__mocks__/"],
  },
]
