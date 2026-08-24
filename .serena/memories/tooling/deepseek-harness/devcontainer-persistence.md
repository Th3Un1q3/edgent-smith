# dsh Devcontainer Persistence

Mirrors the opencode_data pattern: named volume `dsh_data:/home/vscode/.dsh` added to .devcontainer/docker-compose.yml. setup-dev.sh installs dsh with a VERSION-CHECKED guard (`dsh --version` comparison — NOT plain `command -v`; the existing @github/copilot block has the command -v bug and never reinstalls) plus dynamic `export PATH="$(npm prefix -g)/bin:$PATH"` (npm global bin is NOT in containerEnv PATH). devcontainer.json forwardPorts 3080 ("dsh Web UI"). postCreateCommand runs only on create/rebuild, not every up.

Rebuild-proofing (2026-08-22): a FRESH dsh_data volume mounts root:root 755 -> vscode cannot write -> every dsh op fails EACCES mkdir ~/.dsh/profiles/node_modules. setup-dev.sh now chowns ~/.dsh to $(id -u):$(id -g) before the install guard. Config is config-as-code: templates .devcontainer/dsh/settings.yaml + cordis.patch.yml restored on rebuild via cp -u (newer-file wins; user edits in ~/.dsh survive). Verify with `test -w ~/.dsh` + `dsh --profile web --dump-config` (14 plugins disabled:false annotated patched by web-app + home cordis.patch.yml; sandbox-policy.config.mode workspace-write).

Superseded (2026-08-24): the named volume and the cp -u restore are REPLACED by a workdir bind mount — .devcontainer/docker-compose.yml now mounts `../.dsh:/home/vscode/.dsh`, so the harness home IS repo `.dsh/` (tracked config, gitignored state, no restore step). See mem:tooling/deepseek-harness/config-as-code for the current pattern; the chown guard in setup-dev.sh remains as a mount-point safety net.

General dev-container change-management process: mem:devcontainer-workflows/about.

Granular lessons: mem:tooling/deepseek-harness/volume-ownership, mem:tooling/deepseek-harness/config-as-code, mem:tooling/deepseek-harness/rebuild-survivability, mem:tooling/deepseek-harness/idempotent-install-pattern.