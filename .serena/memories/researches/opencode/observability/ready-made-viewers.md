# Ready-Made Session Viewers

cc-sessions-viewer (github.com/jerrywu001/cc-sessions-viewer, ~296 stars, active) — Tauri desktop app with prebuilt binaries (v0.3.19: deb/AppImage/rpm/dmg/exe/msi). Reads opencode.db directly (read-only; WAL-safe concurrent reads OK). Lists sessions; shows tool params (state.input pretty-printed), outputs (30-line truncation), reasoning, diffs, per-turn model/token/cost. Does NOT show provider payloads.

npm alternative: @virmont/opencode-viewer (browse OpenCode sessions, messages, and tool calls from the SQLite database). Langfuse can ingest raw OTLP but shows only what is instrumented — metadata-only for opencode.

Related: `mem:researches/opencode/observability/tool-payloads-in-sqlite-export`.