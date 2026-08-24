# Reference: npm and Native Modules

Install npm-distributed tools correctly under npm 11's script gate and the nvm node layout. Use when an npm install silently skips postinstall, a native module fails to load, or a globally installed tool is missing from PATH.

## Vocabulary

- **allow-scripts gate** — npm 11's built-in default that runs no package postinstall scripts unless explicitly whitelisted.
- **prebuild** — a precompiled native binary shipped per platform+arch.
- **ABI** — the Node.js Application Binary Interface version; native modules compile against one.
- **global prefix** — the directory where `npm install -g` places packages and bins, derived from the nvm node layout.

## allow-scripts gate

npm 11 gates postinstall scripts by default (`allow-scripts=[]`); the container ships no npmrc, so the gate is active. A skipped postinstall fails silently — no install error — and native deps (node-pty, koffi, protobufjs) plus tool postinstalls (dsh-subprocess-local) break. Whitelist only the scripts the package needs:

```bash
npm install -g --allow-scripts=@deepseek-ai/dsh-subprocess-local,koffi,node-pty,@google/genai,protobufjs @deepseek-ai/dsh@0.1.1-rc.2
```

Keep the whitelist minimal; name each required script instead of `dangerously-allow-all-scripts`.

## Native deps and prebuilds

Native modules ship prebuilds per platform+arch. Verify a prebuild exists for the container platform/arch — linux-arm64 verified on OrbStack in this repo — before relying on a package; a missing prebuild forces a source build that can fail without the toolchain. Check the package's release assets or `npm view <pkg>` for prebuild metadata.

## ABI

Native modules bind to a specific Node ABI; a node FEATURE major bump breaks them. Read the running ABI with:

```bash
node -p process.versions.modules   # 137 on node 24
```

A runtime install in postCreate links against the actual node, which removes ABI drift — one reason postCreateCommand placement beats a Feature-baked node mismatch.

## Global prefix (nvm layout)

`npm install -g` installs into the nvm layout under `/usr/local/share/nvm/versions/node/v<X>/bin`. Resolve it dynamically — never hardcode the versioned path:

```bash
npm prefix -g
export PATH="$(npm prefix -g)/bin:$PATH"
```

## --location=user persistence caveat

`npm config set <key> --location=user` persists to `~/.npmrc`, which is NOT volume-backed and wipes on rebuild. Re-assert the setting in the setup script, or pass per-invocation flags.
