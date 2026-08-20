# session_parts.py CLI Resilience Gotchas

`session_parts.py` exposes four flows: conversation, parts, info, summary. Quirk: a subcommand `--help` exits 2 unless `--session-file-json` comes first.

## Crash vectors (discovered by validators, observed output)

- info: `.info.time.updated = "bogus"` does NOT crash (isinstance guard -> duration=unknown); `1e400` DOES (inf -> human_duration ValueError) - a working crash vector for the fail-safe.
- summary: `.messages = {}` does NOT crash (`or []` guard); `.messages = {"x":1}` DOES (AttributeError).

Lesson: adversarial input testing separates guarded from unguarded paths. Related: mem:testing/python/adversarial-tests-after-implementation.