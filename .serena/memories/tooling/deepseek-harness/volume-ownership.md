# Fresh Named Volume Mounts Are root-Owned (EACCES)

A brand-new named volume (e.g. `dsh_data`) mounts root:root 755 inside the container; the `vscode` dev user gets EACCES on every operation until it is chowned. Symptom: `mkdir /home/vscode/.dsh/profiles/node_modules` fails; even `dsh --dump-config` crashes at profile bootstrap.

Fix (mirrors the opencode pattern for `/home/vscode/.local`): in setup-dev.sh run `mkdir -p /home/vscode/.dsh && sudo chown -R $(id -u):$(id -g) /home/vscode/.dsh` before the install guard.

Rule: ANY new named volume mounted into the dev user home must be chowned in setup-dev.sh. Companion config-restore fix: mem:tooling/deepseek-harness/config-as-code.