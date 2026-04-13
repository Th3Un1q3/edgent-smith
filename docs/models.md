# Model capability matrix

This short reference lists capabilities relevant to `config.py` presets and mapping.

- `ollama:gemma4:e2b`
  - `think`: supported (enable with `think: true`) — returns reasoning trace in `response.message.thinking`.
  - Token control: supports `max_tokens` (maps to `max_output_tokens`/`num_predict` depending on endpoint).
  - Endpoints: `/v1/chat/completions`, `/v1/responses`, and `/api/generate` (options differ slightly).

- `github-copilot` (Copilot API)
  - `think`: not supported in the same way as Ollama; avoid relying on `think`.
  - Token control: supports `max_tokens` via OpenAI-compatible fields.

Notes
- The mapping from high-level keys (`max_tokens`, `think`) to provider/endpoint fields is handled in `config.py` (`map_to_provider_params`).
- When using `think`, be mindful of privacy: reasoning traces may include model internals and should be redacted before persisting or sending to telemetry.
