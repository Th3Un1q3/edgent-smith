Content type text/plain; charset=utf-8 cannot be simplified to markdown, but here is the raw content:
Contents of https://raw.githubusercontent.com/DavidAnson/markdownlint-cli2/main/README.md:
# markdownlint-cli2

> A fast, flexible, configuration-based command-line interface for linting
> Markdown/CommonMark files with the `markdownlint` library

[![npm version][npm-image]][npm-url]
[![License][license-image]][license-url]

## Install

As a global CLI:

```bash
npm install markdownlint-cli2 --global
```

As a development dependency of the current [Node.js][nodejs] package:

```bash
npm install markdownlint-cli2 --save-dev
```

As a [Docker][docker] container image:

```bash
docker pull davidanson/markdownlint-cli2
```

As a global CLI with [Homebrew][homebrew]:

```bash
brew install markdownlint-cli2
```

As a [GitHub Action][github-action] via
[`markdownlint-cli2-action`][markdownlint-cli2-action]:

```yaml
- name: markdownlint-cli2-action
  uses: DavidAnson/markdownlint-cli2-action@main
```

## Overview

- [`markdownlint`][markdownlint] is a library for linting [Markdown][markdown]/
  [CommonMark][commonmark] files on [Node.js][nodejs] using the
  [markdown-it][markdown-it] parser.
- [`markdownlint-cli`][markdownlint-cli] is a traditional command-line interface
  for `markdownlint`.
- [`markdownlint-cli2`][markdownlint-cli2] is a slightly unconventional
  command-line interface for `markdownlint`.
- `markdownlint-cli2` is configuration-based and prioritizes speed and
  simplicity.
- `markdownlint-cli2` supports all the features of `markdownlint-cli` (sometimes
  a little differently).
- [`vscode-markdownlint`][vscode-markdownlint] is a `markdownlint` extension for
  the [Visual Studio Code editor][vscode].
- `markdownlint-cli2` is designed to work well in conjunction with
  `vscode-markdownlint`.
- More about the [motivation for `markdownlint-cli2`][markdownlint-cli2-blog].

## Use

### Command Line

```text
markdownlint-cli2 vX.Y.Z (markdownlint vX.Y.Z)
https://github.com/DavidAnson/markdownlint-cli2

Syntax: markdownlint-cli2 glob0 [glob1] [...] [globN] [--config file] [--configPointer pointer] [--fix] [--format] [--help] [--no-globs]

Glob expressions (from the globby library):
- * matches any number of characters, but not /
- ? matches a single character, but not /
- ** matches any number of characters, including /
- {} allows for a comma-separated list of "or" expressions
- ! or # at the beginning of a pattern negate the match
- : at the beginning identifies a literal file path
- - as a glob represents standard input (stdin)

Dot-only glob:
- The command "markdownlint-cli2 ." would lint every file in the current directory tree which is probably not intended
- Instead, it is mapped to "markdownlint-cli2 *.{md,markdown}" which lints all Markdown files in the current directory
- To lint every file in the current directory tree, the command "markdownlint-cli2 **" can be used instead

Optional parameters:
- --config        specifies the path to a configuration file to define the base configuration
- --configPointer specifies a JSON Pointer to a configuration object within the --config file
- --fix           updates files to resolve fixable issues (can be overridden in configuration)
- --format        reads standard input (stdin), applies fixes, writes standard output (stdout)
- --help          writes this message to the console and exits without doing anything else
- --no-globs      ignores the "globs" property if present in the top-level options object

Configuration via:
- .markdownlint-cli2.jsonc
- .markdownlint-cli2.yaml
- .markdownlint-cli2.cjs or .markdownlint-cli2.mjs
- .markdownlint.jsonc or .markdownlint.json
- .markdownlint.yaml or .markdownlint.yml
- .markdownlint.cjs or .markdownlint.mjs

Cross-platform compatibility:
- UNIX and Windows shells expand globs according to different rules; quoting arguments is recommended
- Some Windows shells don't handle single-quoted (') arguments well; double-quote (") is recommended
- Shells that expand globs do not support negated patterns (!node_modules); quoting is required here
- Some UNIX shells parse exclamation (!) in double-quotes; hashtag (#) is recommended in these cases
- The path separator is forward slash (/) on all platforms; backslash (\) is automatically converted
- On any platform, passing the parameter "--" causes all remaining parameters to be treated literally

The most compatible syntax for cross-platform support:
$ markdownlint-cli2 "**/*.md" "#node_modules"
```

For scenarios where it is preferable to specify glob expressions in a
configuration file, the `globs` property of `.markdownlint-cli2.jsonc`, `.yaml`,
`.cjs`, or `.mjs` may be used instead of (or in addition to) passing
`glob0 ... globN` on the command-line.

As shown above, a typical command-line for `markdownlint-cli2` looks something
like:

```bash
markdownlint-cli2 "**/*.md" "#node_modules"
```

Because sharing the same configuration between "normal" and "fix" modes is
common, the `--fix` argument can be used to default the `fix` property (see
below) to `true` (though it can still be overridden by a configuration file):

```bash
markdownlint-cli2 --fix "**/*.md" 

<error>Content truncated. Call the fetch tool with a start_index of 5000 to get more content.</error>