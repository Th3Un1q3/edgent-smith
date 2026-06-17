---
description: "Automatically generates and performs a conventional commit based on all local changes (staged and unstaged)."
agent: build
---


# Command: /cc

## Description

Automatically generates and performs a conventional commit based on all local changes (staged and unstaged).

## Context

To understand the intent of the current changes, analyze the following:

### Recent History

Recent git commits:
!`git log -n 10 --pretty=format:"%s"`

### Current Changes

Current repository status:
!`git status -u`

Staged changes:
!`git diff --staged`

Unstaged changes:
!`git diff`

## Workflow
1. **Analyze Intent**:
   - Based on the outputs above, identify the primary intent of the changes (e.g., new feature, bug fix, refactor, documentation, chore).
   - Group changes into logical categories.

2. **Propose Commit**:
   - Present a summary of the identified changes.
   - Propose a conventional commit message in the format `type(scope): description`.
   - Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `build`, `ci`, `break`.
   - If multiple intents are detected, ask the user to pick the primary one or suggest a multi-part commit.

3. **Execute Commit**:
   - Once the user confirms the message:
     - Run `git add .`
     - Run `git commit -m "{Proposed Message}"`

## Standards
- **Conventional Commits**: Use types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `build`, `ci`, `break`.
- **Intent-Oriented**: The message should describe *why* the change was made, not just *what* was changed.
- **MVI**: Keep the summary brief and scannable.

## Example Output
```
Changes detected:
- Modified auth.py to include JWT verification
- Updated README.md with new auth instructions
- Fixed bug in login route

Proposed Commit: 
feat(auth): implement JWT verification and update docs

> [perform add and commit]
```

## Example of commit massages:

```
# Bad
chore(config): update git permissions to ask

# Good
chore(opencode): allow agent to execute git commands with confirmation
```