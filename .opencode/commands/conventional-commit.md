---
name: cc
description: "Create a conventional commit with user approval"
---

# Conventional Commit

## Context


<output command="git status --short 2>/dev/null || echo '(no git repo or no changes)'">

!`git status --short 2>/dev/null || echo '(no git repo or no changes)'`

</output>

If the output above is empty, there are no untracked/unstaged changes. Check for staged changes:


<output command="git diff --cached --unified --stat 2>/dev/null || echo '(nothing staged)'">

!`git diff --cached --unified --stat 2>/dev/null || echo '(nothing staged)'`

</output>

## Workflow

1. **Analyze changed files**
   - Use the `bash` tool to see full diffs of what will be committed:
     ```bash
     git diff HEAD~1..HEAD 2>/dev/null || git diff --cached
     ```
   - If nothing is staged, identify modified but unstaged files.

2. **Stage all changes**
   - Use the `bash` tool to add all files (including untracked):
     ```bash
     git add .
     ```
   - Verify with: `git status --short`

3. **Propose a conventional commit message**
   - Choose the most appropriate type prefix from this list:
     | Prefix      | Use case                                  | Example                    |
     |-------------|-------------------------------------------|----------------------------|
     | `fix:`      | Bug fixes                                 | `fix: resolve null pointer`|
     | `feat:`     | New features                              | `feat: add user auth`      |
     | `refactor:` | Restructuring without behavior change     | `refactor: extract service`|
     | `docs:`     | Documentation changes                     | `docs: update API guide`   |
     | `test:`     | Test additions/modifications              | `test: add auth suite`      |
     | `chore:`    | Build, deps, CI, or maintenance           | `chore: bump version`      |
     | `style:`    | Formatting/linting (no logic change)      | `style: fix indentation`   |
     | `ci:`       | CI/CD pipeline changes                    | `ci: update workflow`      |
     | `perf:`     | Performance improvements                  | `perf: cache query result` |
   - Choose scope if applicable (e.g., `feat(auth): ...`).
   - Construct a concise, imperative message (prefix(scope): description format).

5. **Execute the commit**
   - Use the `bash` tool to run: `git commit -m "<approved-message>"`
   - Confirm success with: `git log --oneline -1`

6. **If not approved**
   - Tell the user the commit was skipped and offer to revise the message or try again.
