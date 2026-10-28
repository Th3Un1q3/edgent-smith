---
id: cases/opencode/remote-access-lessons
type: cases
L0: "Remote access to the local opencode web UI: opencode pair --remote through OpenTunnel works; Cloudflare quick tunnels break SSE; loopback binds hide the server from sibling containers."
hotness: 0.7
ttl: 90d
version: 1
freshness: 2026-10-27
directory: cases/opencode
provenance: mem:architecture/adr/ADR-020-serving-opencode-web-locally-with-tunneling
---

# Remote access to the local opencode web UI

scope: cases — one failure plus its fix (tunnel path abandoned, pairing path adopted). The exposure decision itself is the ADR; this memory carries the operating lessons.

## Failure — Cloudflare tunnel path

A quick tunnel against the loopback server loads the page but never updates: quick tunnels document no Server-Sent Events support, while the UI streams `GET /api/event` as `text/event-stream`. A named tunnel plus a Cloudflare Access application does carry SSE but needs a Cloudflare-managed domain, and it did not work end to end. ngrok, Tailscale serve/funnel, SSH forwarding, and publishing the port were each rejected for a stated reason.

## Fix — `opencode pair --remote`

`opencode pair --remote` prints a single-use `https://<route>.<host>/auth/connect/<code>` link through OpenTunnel. A browser opens the link, exchanges it for a session cookie, and lands in the app; no SSH, VPN, or client install. The server stays on loopback with `OPENCODE_SERVER_PASSWORD` read from the untracked root env file (the value is never recorded here). The route persists in the service config, so the address survives restarts while the code does not.

## Operating facts

- `--allowed-mail` needs cloudflared >= 2026.9.3 and matches whole addresses exactly, case-insensitively; `*@domain` matches that exact domain only, not its subdomains.
- A loopback-bound server is unreachable from a sibling container: use a shared network namespace (`network_mode: service:devcontainer`) or bind 0.0.0.0.
- A quick tunnel's hostname changes on every restart, so links and allow-lists break with it.
- The tunnel daemon was run as a compose sidecar under its own profile.

## Sources

Source: mem:architecture/adr/ADR-020-serving-opencode-web-locally-with-tunneling (decision + rejected alternatives), installed CLI help v2.2.0, Cloudflare SSE documentation, operator statements 2026-10-25.