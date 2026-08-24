# dsh Install & Version Pinning

`dsh` (DeepSeek Harness CLI) is pinned to `@deepseek-ai/dsh@0.1.1-rc.2`, installed globally via npm in the devcontainer. No stable release exists — the `latest` dist-tag equals `next` equals the rc.

## Hard requirements

- Node >= 22.19 (container runs v24.19.0; npm 11.17.0).
- npm 11's built-in allow-scripts gate blocks postinstall scripts by default (no npmrc in this container). Installs MUST pass `--allow-scripts=@deepseek-ai/dsh-subprocess-local,koffi,node-pty,@google/genai,protobufjs` or native deps (node-pty, koffi) silently break.
- arm64 prebuilds work (linux-arm64 pty.node, landlock-run addon verified).
- `dsh plugin` forwards pnpm verbs (pnpm 11.22.0 present).

Config wiring after install: mem:tooling/deepseek-harness/settings-schema.