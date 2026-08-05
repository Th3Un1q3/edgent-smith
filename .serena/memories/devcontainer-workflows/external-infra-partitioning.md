# External-Infra Partitioning (Manual vs Automatable)

**Use when:** the task needs an external account/service (Cloudflare, AWS, GitHub, etc.) that cannot be fully automated from the repo.

## Pitfalls
- Vague manual instructions ("get a token") → users fail.
- Attempting to automate dashboard steps that need interactive auth.

## Rules
1. Partition clearly: "what the repo does" (automatable) vs "what the user must click" (manual).
2. Manual steps must include: exact dashboard paths, the exact file to edit, exact variable names, and a security checklist.
3. State the environment's validation ceiling honestly — if the container runtime is unavailable, config parsing + spec review is the ceiling; never fabricate a pass; defer runtime validation to the user's machine with exact commands.
