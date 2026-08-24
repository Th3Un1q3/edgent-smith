# dsh Provider State

Default model wired to OpenRouter: provider `openrouter`, `apiKeyEnv: OPENROUTER_API_KEY`, model `deepseek/deepseek-v4-flash` (verified current id on OpenRouter; matches dsh-native default).

The container's OPENROUTER_API_KEY has EXHAUSTED its account quota (OpenRouter 403 "Key limit exceeded"). Harness config is valid and reaches the provider authenticated; it needs a fresh key, or DEEPSEEK_API_KEY (provider `deepseek-official` stays available). GitHub Models is NOT a predefined dsh provider (would need a generic openai-completions route). turtle-ui community TUI is NOT published (github:deepseek-harness/turtle-ui -> 404) — the web UI (port 3080) is the interactive surface; no TUI ships with dsh.

Provider wiring schema: mem:tooling/deepseek-harness/settings-schema.

Restart smoke test (verified 2026-08-22): with config restored and volume writable, `dsh --profile headless "..."` boots, resolves the credential, and reaches OpenRouter authenticated — the ONLY failure is the external account quota (403 "Key limit exceeded"), so config-side is PASS. Post-restart checks: mem:tooling/deepseek-harness/rebuild-survivability.