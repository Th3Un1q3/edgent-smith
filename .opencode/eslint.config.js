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

// --- unicorn/consistent-boolean-name ---------------------------------------------------
// A lint rule that rejects a name is a report about the design, not about the spelling.
// Change the design or this rule's configuration; never distort a name to satisfy the rule.
//
// The accepted predicate prefixes are listed explicitly so the demand is legible instead of
// surprising.
const BOOLEAN_NAME_PREFIXES = {
  is: true,
  are: true,
  has: true,
  have: true,
  can: true,
  should: true,
  requires: true,
  was: true,
  were: true,
  did: true, // kept enabled: workflow-runner.ts has a boolean parameter named didTruncateResult
  will: true,
}

// Action-shaped names (verb + object) that change state are exempt from the naming demand: a
// boolean-returning action must not be forced into a misleading predicate name. The exemption
// lists state-changing verbs only, so a read-only name such as `readFile` stays subject to the
// rule.
const ACTION_NAME_PATTERN =
  "^(?:put|write|remove|delete|update|patch|set|save|store|insert|upsert|replace|append|add|" +
  "clear|reset|invalidate|prune|commit|flush|sync|persist)(?:[A-Z][A-Za-z0-9]*)+$"

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
      "@typescript-eslint/no-unused-vars": "error",
      "@typescript-eslint/no-empty-object-type": ["error", { allowInterfaces: "with-single-extends" }],
      // Disallow all console methods — use @plugins/helpers/runtime/logger instead
      "no-console": "error",

      // reduce/.concat() valid patterns here for array merging (instructions/indexer)
      "unicorn/no-array-reduce": "off",

      // .sort() with spread copy is safe and idiomatic
      "unicorn/no-array-sort": "off",

      // Bun Glob.scan() on for-await header is the idiomatic pattern
      "unicorn/no-unreadable-for-of-expression": "off",

      // Predicate naming: a lint rule that rejects a name is a report about the design, not
      // about the spelling — change the design or this configuration, never distort a name to
      // satisfy the rule. The accepted prefixes and the action-shaped-name exemption are
      // declared above (BOOLEAN_NAME_PREFIXES, ACTION_NAME_PATTERN).
      "unicorn/consistent-boolean-name": [
        "error",
        {
          checkVariables: "always",
          checkArguments: "always",
          checkFunctions: "always",
          checkMethods: "never",
          checkFields: "never",
          prefixes: BOOLEAN_NAME_PREFIXES,
          ignore: [ACTION_NAME_PATTERN],
        },
      ],
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
    files: [
      "**/plugins/tests/helpers/**/*.ts",
      "**/plugins/tests/instructions/**/*.ts",
      "**/plugins/tests/gates/**/*.ts",
      "**/plugins/tests/workflow/**/*.ts",
    ],
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
      "@typescript-eslint/no-non-null-assertion": "error",
      // TODO: tighten this limit from 450 to 350 lines. Work in iterations, 100 lines at a time, to avoid a massive PR that is hard to review. And to identify reusable helpers and techniques.
      "max-lines": ["error", { "max": 450, "skipBlankLines": true, "skipComments": true }],
      "unicorn/consistent-function-scoping": "off",
      "unicorn/no-null": "off",
      ...vitest.configs.recommended.rules, // you can also use vitest.configs.all.rules to enable all rules
      'vitest/expect-expect': ['error', { assertFunctionNames: ['expect', 'expectTypeOf'] }],
      'vitest/max-nested-describe': ['error', { max: 3 }], // you can also modify rules' behavior using option like this
    },
  },

  // Non-test plugin sources (root, helpers/, scope dirs, types/, config/): 350-line cap so one
  // file stays reviewable. Blank lines and comments are not counted.
  // Nesting deeper than 3 levels is an error: each added level multiplies the states a
  // reader must hold at once.
  {
    files: allFiles,
    ignores: TEST_FILES,
    rules: {
      "max-lines": ["error", { "max": 350, "skipBlankLines": true, "skipComments": true }],
      "max-depth": ["error", 3],
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
          len: true, msg: true,
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

  // Cyclomatic complexity — uniform max 3 across plugin source and tests.
  // `**/plugins/**/*.ts` matches every file under a plugins/ tree at any
  // depth, so a new plugin subdirectory is covered without editing this list.
  // Tests (incl. test helpers under plugins/tests/) are held to the same
  // limit. Fix complexity rather than release it.
  {
    files: [
      '**/plugins/**/*.ts',
      '**/helpers/**/*.ts',
      '**/types/**/*.ts',
      ...TEST_FILES,
    ],
    rules: {
      // Ceiling lowered 5 -> 4 -> 3, one step at a time, each step before/after measured with the
      // plugin lint on this tree. At max 5: 0 complexity findings. At max 4: 106 sites in 51 files
      // reported complexity 5 (91 in 39 sources, 15 in 12 tests); those were fixed, leaving 0
      // findings at max 4. At max 3: 202 sites in 85 files report complexity 4 (164 in 59 sources,
      // 38 in 26 tests, every site exactly at 4). Owning agents fix those in batches; the pin keeps
      // the ceiling from being raised back while they land. Max 3 is the target, now the ceiling.
      complexity: ['error', { max: 3 }],
    },
  },
]
