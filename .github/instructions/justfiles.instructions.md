---
description: Best practices for writing justfiles to ensure maintainability, clarity, and consistency across projects.
applyTo: "justfile,**/justfile"
---

# Best Practices for just tasks

Use `justfile` as the canonical source for project commands, not as a place for ad hoc shell scripts.

## 1. Configure execution explicitly
- Set a well-defined shell:
  ```just
  set shell := ["bash", "-euo", "pipefail", "-c"]
  ```
- Set a working directory if recipes should run from a specific project folder:
  ```just
  set working-directory := "src"
  ```
- Load environment from `.env` files if your project depends on local config:
  ```just
  set dotenv-load
  set dotenv-required
  ```

## 2. Keep recipes small and composable
- Prefer focused recipes like `test`, `lint`, `build`, `format`, and `release`.
- Avoid adding too much logic in a single recipe.
- Compose recipes by calling other recipes instead of duplicating work.

## 3. Use variables instead of repeating values
- Declare shared values once:
  ```just
  SOURCE_DIR := "src"
  PYTHON := "python"
  ```
- Reuse them in recipes and commands.
- Use `env_var_or_default("NAME", "default")` for environment-driven values.

## 4. Export only what is needed
- Use `set export` when many variables should be available in recipe commands.
- Or export individual variables explicitly:
  ```just
  export RUST_BACKTRACE := "1"
  ```
- Keep credential/secrets handling explicit and documented.

## 5. Justfile syntax reference
- Recipes use a colon after the name, followed by indented shell commands:
  ```just
  build:
    cargo build --release
  ```
- Pass parameters with defaults using `$` names:
  ```just
  serve $PORT="8080":
    ./server --port $PORT
  ```
- Use variadic parameters for multiple args:
  ```just
  backup +files:
    scp {{files}} user@server:/backup/
  ```
- Configure Just behavior with `set` directives:
  ```just
  set shell := ["bash", "-euo", "pipefail", "-c"]
  set dotenv-load
  set export
  set working-directory := "src"
  ```
- Comments start with `#` and appear in `just --list` output.
- Invoke recipes with `just <recipe>` or `just <recipe> arg`.

## Quiet recipes and suppressing command echo

- By default, `just` prints each command it will run to standard error. When a script captures
  `just`'s output (for example, to parse JSON), those echoed commands can corrupt the capture.
- Preferred ways to suppress command echoing:
  - Prefix individual recipe lines with `@` to avoid echoing that line:
    ```just
    my-task:
      @echo "This line is not printed before execution"
      ls -la
    ```
  - Make an entire recipe quiet by prefixing the recipe name with `@`:
    ```just
    @my-quiet-task:
      echo "Only lines beginning with @ are echoed"
      @echo "This echo will be shown"
    ```
  - Use `set quiet` to make all recipes quiet by default and `[no-quiet]` to opt out for specific recipes.
  - Shebang-style recipes (those beginning with `#!`) are quiet by default.
- Do not depend on a non-standard or environment-specific `--quiet`/`-q` flag; changing the justfile is the
  reliable approach.
- For CI or scripts that capture structured output (JSON), prefer either:
  - calling the underlying script directly (for example, `bash scripts/baseline_status.sh`) or
  - making the `just` recipe quiet (example below).
- Example (make `baseline-status` quiet):
  ```just
  baseline-status baseline_id:
    @bash scripts/baseline_status.sh "{{baseline_id}}"
  ```
- Defensive parsing: always validate the captured output (for example, with `jq`), and fail fast on
  parse errors to avoid silent misbehavior.

## 6. Parameterize recipes cleanly
- Define recipe parameters for configurable behavior:
  ```just
  serve $PORT="8080":
    ./server --port $PORT
  ```
- Parameter values can be exported to the environment if the underlying command expects them.

 - Example: keep the recipe simple by forwarding wildcard flags to the Python runner and declare a prior dependency for model setup.

   ```just
   pull-ollama-model:
     bash scripts/pull_ollama_model.sh

   run-experiment prompt *ARGS: pull-ollama-model
     python scripts/experiment.py run \
       --prompt '{{prompt}}' \
       {{ ARGS }}
   ```

   Invoke with a required prompt and optional flags:
   ```bash
   just run-experiment "My prompt"
   just run-experiment "My prompt" --baseline-id local
   just run-experiment "My prompt" --baseline-id local --followup-limit 2 --agent implement
   ```

   This is a simpler interface because only prompt is required.


   This avoids `--set` and keeps the common case very simple.

## 6. Document intent and requirements
- Add comments explaining why a recipe exists, which shell settings are chosen, and what env files are loaded.
- Document required tools or environment variables for project contributors.

## 7. Keep cross-platform assumptions isolated
- If you need platform-specific behavior, isolate it behind separate recipes or conditional logic.
- Prefer a consistent Unix-style shell in the repo, and document when Windows support is not expected.

## 8. Prefer `just` over shell boilerplate in CI and docs
- Use `just lint`, `just test`, and `just build` in docs so contributors have a single entrypoint.
- Avoid mixing shell commands with `just` commands in the same workflow unless necessary.

## 9. Fail early and loudly
- Configure shell strict mode to prevent hidden command failures.
- Use explicit commands rather than relying on shell fallback behavior.

## 10. Keep `justfile` readable
- Use comments, clear recipe names, and short recipe bodies.
- Avoid embedding large scripts directly; move complex logic to dedicated shell/Python scripts if needed.
- Remember that each recipe line is executed in a separate shell invocation, so variable assignments do not persist across multiple lines unless you wrap them in a single shell command or use a script.

## Syntax cheatsheet

### Simple `justfile`

```just
#!/usr/bin/env just --justfile

# hello is the recipe name
hello:
  echo "Hello World!"
```

**Note:** avoid using reserved names like `import`, `export`, or `alias` as recipe names.

### Default recipe

The first recipe is the default when no recipe is specified.

```just
default: lint build test
```

Or explicitly mark a recipe as default:

```just
[default]
hello:
  echo hello
```

### Aliases

```just
alias t := test
alias c := check
```

### Common settings

```just
set shell := ["bash", "-euo", "pipefail", "-c"]
set dotenv-required
set dotenv-load := true
set positional-arguments := true
```

Example:

```just
serv:
  echo "$DATABASE_ADDRESS from .env"

foo:
  echo $0
  echo $1
```

### Strings

Use double quotes for escaping:

```just
string-with-tab := "\t"
string-with-newline := "\n"
escapes := '\t\n\r\"\\'
shell-expanded-path := x'~/\${FOO}/\${BAR}'
message := f'hello {{name}}'
```

For multiline strings:

```just
x := '''
  foo
  bar
'''
```

### Running `just`

```bash
just hello param1
just --list
just --summary
just --show test
just --choose
just --completions zsh
```

### GitHub Actions

Use a pinned setup step for `just`:

```yaml
- uses: extractions/setup-just@v1
  with:
    just-version: 1.45.0
```

### IDE integration

- VS Code: `https://marketplace.visualstudio.com/items?itemName=skellock.just`
- JetBrains: `https://plugins.jetbrains.com/plugin/18658-just`

`PROJECT_DIR` is available in JetBrains IDEs.

### `just` module/import

```just
mod bar
import 'foo/bar.just'
```

Run imported recipes with the unstable command syntax:

```bash
just --unstable bar::hello
```

### Recipe parameters

```just
filter PATTERN:
  echo "{{PATTERN}}"

email address='master@example.com':
  echo "{{address}}"
```

Validation parameters:

```just
[arg('n', pattern='\\d+')]
double n:
  echo $(({{n}} * 2))
```

Expression parameters:

```just
test triple=(arch() + "-unknown-unknown"):
  ./test "{{triple}}"
```

Variadic parameters:

```just
backup +FILES:
  scp {{FILES}} me@example.com
```

Zero-or-more variadic parameters:

```just
commit MESSAGE *FLAGS:
  git commit {{FLAGS}} -m "{{MESSAGE}}"
```

> Tip: quote parameters when possible for better syntax highlighting.

### Recipe parameter environment passthrough

```just
hello $name:
  echo $name
```

### Recipe dependencies and ordering

Use recipe dependencies to compose work:

```just
default: (build "main")

build target:
  @echo 'Building {{target}}...'
```

Run another recipe in a recipe body:

```just
b:
  echo 'B start!'
  just a
  echo 'B end!'
```

### Command annotations

- `@` quiets a single command
- `-` ignores failure for that command
- `!` inverts exit status (shell feature)

```just
hello:
  @echo "command will not be echoed"
  -echo "ignore none-zero exit status and continue"

@hello2:
  echo "command will not be echoed"

hello3:
  ! git branch | grep '* master'
```

### Using other languages

Shebang-style recipes are supported:

```just
bash-test:
  #!/usr/bin/env bash
  set -euxo pipefail
  hello='Yo'
  echo "$hello from bash!"
```

Language-specific scripts can also be configured with metadata such as `script(...)` and `extension(...)`.

### Private recipes

Recipes that start with `_` are hidden from `just --list`.

```just
test: _test-helper
  ./bin/test

_test-helper:
  ./bin/super-secret-test-helper-stuff
```

### Recipes as shell aliases

```bash
for recipe in `just -f ~/.justfile --summary`; do
  alias $recipe="just -f ~/.justfile -d. $recipe"
done
```

### Python virtualenv support

```just
venv:
  [ -d .venv ] || uv venv

run: venv
  uv run python main.py
```

### Variables

```just
version := "0.2.7"
tardir := "awesomesauce-" + version
tarball := tardir + ".tar.gz"
path := "a" / "b"

var1 := '' && 'goodbye'
var2 := 'hello' && 'goodbye'
var3 := '' || 'goodbye'
var4 := 'hello' || 'goodbye'
```

Use variables in recipes:

```just
test:
  echo "{{version}}"
```

Override variables from the command line:

```bash
just --set version 1.1.0
```

### Environment variables for commands

```just
export RUST_BACKTRACE := "1"

test:
  cargo test
```

### Backticks and command substitution

Backticks capture command output in expressions:

```just
JAVA_HOME := `jbang jdk home 11`

stuff := ```
  foo="hello"
  echo $foo world
```

done BRANCH=`git rev-parse --abbrev-ref HEAD`:
  git checkout master

sloc:
  @echo "`wc -l *.c` lines of code"
```

> Backticks work anywhere: strings, variables, or params.

### Just functions

```just
hello name:
  echo "{{os()}}"
  echo "{{uppercase(name)}}"
```

Common function categories:
- System information
- Environment variables
- Justfile and Justfile directory
- String manipulation
- Path manipulation

### Conditional expressions

Use `if`, `for`, and `while` in shell commands or in Just expressions.

```just
fo := if "hi" =~ 'h.+' { "match" } else { "mismatch" }

test:
  if true; then echo 'True!'; fi
  for file in `ls .`; do echo $file; done
  while `server-is-dead`; do ping -c 1 server; done

foo bar:
  echo '{{ if bar == "bar" { "hello" } else { "bye" } }}'
```

### Important attention points

- Each recipe command runs in a separate shell.
- If one command fails, `just` exits and later commands are not run.
- Use `&&` or explicit shell control to preserve multi-line logic.

```just
change-working-dir:
  cd bar && pwd
  if true; then \
    echo 'True!'; \
  fi
```

- `justfile` is case-insensitive (`Justfile`, `JUSTFILE`, etc.).
- It can also be named `.justfile`.
- You can call a recipe from a subdirectory using the normal shell path.

```bash
~/app1/target$ just build
```
