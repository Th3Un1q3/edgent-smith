tool: github/fetch
url: https://api.github.com/repos/Th3Un1q3/edgent-smith/actions/runs/33508523183/jobs
date: 2026-09-04
source: fetch
# Workflow Jobs — run 33508523183 — Th3Un1q3/edgent-smith

Run: 33508523183 workflow CI branch main conclusion failure title "feat: add environment variables for devcontainer" 2026-09-01T12:35:28Z url https://github.com/Th3Un1q3/edgent-smith/actions/runs/33508523183

Jobs:
- Prebuild DevContainer — success
- Format·Lint·Type-check·Tests·Workflow Security — failure (devcontainers/ci@v0.3)

Steps failure: devcontainers/ci@v0.3 postCreateCommand `bash .devcontainer/setup-dev.sh` exit 1

Log excerpt:
```
hardlink warning: failed to create hardlink ... (setup-dev.sh)
devcontainers/ci@v0.3: postCreateCommand failed
bash .devcontainer/setup-dev.sh exit 1
Error: Process completed with exit code 1.
```

Jobs raw compact: {"total_count":2,"jobs":[{"name":"Prebuild DevContainer","conclusion":"success"},{"name":"Format·Lint·Type-check·Tests·Workflow Security","conclusion":"failure","steps":[{"name":"Run devcontainers/ci@v0.3","conclusion":"failure"}]}]}
Source: fetch API + get_job_logs date:2026-09-04