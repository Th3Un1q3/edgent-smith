---
description: "Automatically generates and performs a conventional commit based on all local changes (staged and unstaged)."
agent: build
# subtask: true
return:
 - "Proceed"
---


# Command: /cc

## Description

Automatically generates and performs a conventional commit based on all local changes (staged and unstaged).

## Context

To understand the intent of the current changes, analyze: recent commits (`git log -n 10`), current diff status (`git status -u`), staged/unstaged file stats (`git diff --staged --stat`, `git diff --stat`), and any git todos (`just git_todos`).

## Workflow

1. **Analyze Intent**:
   - Based on the outputs above, identify the primary intent of the changes (e.g., new feature, bug fix, refactor, documentation, chore).
   - Group changes into logical categories.
   - Delegate tasks to fix todos if they are present in the output of `just git_todos` and are relevant to the current changes. For example, if there is a todo related to fixing a bug and the current changes include a bug fix, assign that todo to yourself and include it in the commit message.
   - Check specific files diffs if needed to clarify intent. `git diff --staged --patch-with-stat <file> | head -n 20` (skip staged flag to see unstaged changes).

2. **Determine Commit Message**:
   - Determine a conventional commit message in the format `type(scope): description`.
   - If multiple intents are detected, choose the primary one or combine into a single appropriate commit message.

3. **Execute Commit**:
   - Run `git add . && git commit -am "{Determined Message}"` to stage all changes and commit with the determined message.
   - Output the final commit message and a summary of the changes included in the commit.

## Standards

- **Conventional Commits**: Use types:
   - `feat` - for new features
   - `fix` - for bug fixes
   - `docs` - for documentation changes
   - `style` - for code style changes (formatting, missing semicolons, etc.)
   - `refactor` - for code refactoring
   - `perf` - for performance improvements
   - `test` - for adding or updating tests
   - `chore` - for maintenance tasks
   - `build` - for build-related changes
   - `ci` - for continuous integration changes
   - `break` - for breaking changes
- **Intent-Oriented**: The message should describe *why* the change was made, not just *what* was changed.
- **Scopes**: prefer using scopes, here is some examples(but not limited to):
   - `config` - for configuration changes
   - `opencode` - for changes related to the OpenCode agent itself
   - `tests` - for changes related to testing
   - `devcontainer` - for changes related to development environment setup

- **MVI**: Keep the summary brief and scannable.

## Example Output

```
Changes detected:
- Modified auth.py to include JWT verification
- Updated README.md with new auth instructions
- Fixed bug in login route

Proposed Commit: 
feat(auth): implement JWT verification and update docs
```

## Example of commit massages:

```
# Bad
chore(config): update git permissions to ask

# Good
chore(opencode): allow agent to execute git commands with confirmation
```

## Git Information

Recent git commits:

<output cmd="git log -n 10 --pretty=format:'%s'">
!`git log -n 10 --pretty=format:"%s"`
</output>

Current diff status:

<output cmd="git status -u">

!`git status -u`

</output>

Staged file stats:

<output cmd="git diff --staged --stat">

!`git diff --staged --stat`

</output>

Unstaged file stats:

<output cmd="git diff --stat">

!`git diff --stat`

</output>

Git todos:

<output cmd="just git_todos">

!`just git_todos`

</output>