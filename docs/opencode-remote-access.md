# OpenCode remote access over OpenTunnel

`opencode pair --remote` prints a single-use link that travels through OpenTunnel. A browser
exchanges the link for a session cookie and lands in the web app. The visiting device needs a browser
and nothing else: no SSH client, no VPN, and no software installed on that side.

## What this is

The server runs on the host at `127.0.0.1:49374`. Pairing asks OpenTunnel for a public route to that
server and prints a link of the form `https://<route>.<host>/auth/connect/<code>`. Opening the link
in a browser trades the code for a session cookie, and the web UI then loads over the same route.

## Host steps

1. Start the server from the repo root:

   ```bash
   cd /workspace
   just scripts::serve-web
   ```

   The recipe binds `127.0.0.1:49374` and takes the password from `OPENCODE_SERVER_PASSWORD` in the
   repo-root `.env`. Without the recipe, run the long form with that variable exported:

   ```bash
   opencode serve --hostname 127.0.0.1 --port 49374
   ```

2. Print a pairing link:

   ```bash
   opencode pair --remote --yes
   ```

   `--yes` accepts exposing the server to the internet when remote access is enabled for the first
   time, and is required without an interactive terminal. The link is printed once and expires in
   minutes, so copy it before the output scrolls away.

## Device steps

1. Open the printed link in a browser:

   ```text
   https://<route>.<host>/auth/connect/<code>
   ```

2. Enter the server password when prompted.

The browser keeps the session cookie, so the same device returns to the app without another link
until that session ends.

## Security posture

- Traffic between the browser and the server is end to end encrypted.
- Access requires the server password, entered on the connect page.
- The pairing link is single-use and short-lived. Reopening the same code does not start a second
  session.
- The route is persisted, so the address is stable across restarts.
- Revoking access means rotating `OPENCODE_SERVER_PASSWORD`, which signs every session out, or
  stopping the service.
- There is one shared principal. Every visitor is the same user to the server, so per-person
  attribution is not available.

## Why not a tunnel

The earlier attempt put the web UI behind a Cloudflare quick tunnel. Cloudflare documents that quick
tunnels do not support Server-Sent Events, and this UI streams `GET /api/event` as
`text/event-stream`. Through a quick tunnel the page loads and then never updates, because turns and
event frames never arrive.

A named tunnel with a Cloudflare Access application can carry SSE, but it needs a Cloudflare-managed
domain and an Access application in front of it, and it did not work end to end in practice.

The other options were each rejected for a reason:

- ngrok: a hosted relay with its own account, its own agent on the host, and a browser interstitial on
  the free plan. It adds a third-party control point without settling the streaming question.
- Tailscale: needs the Tailscale client installed and signed in on every visiting device, which is
  the dependency this path avoids.
- SSH forwarding: needs an SSH client on the visiting device and a shell account on the host, and the
  forwarded port is reachable only from the machine holding the tunnel.
- Publishing the port: puts the server on a network interface with no relay in front, so exposure
  depends on router and firewall rules and the password is the only gate.

## Lessons learned

- Check transport compatibility before choosing a tunnel: quick tunnels do not carry SSE, and this UI
  depends on it.
- `--allowed-mail` requires cloudflared 2026.9.3 or newer, and matches whole addresses exactly and
  case-insensitively, with `*@domain` covering that exact domain only.
- A duplicate env key silently overrides the earlier one, which quietly defeated a correction.
- Ask for values only the operator can supply, such as their email address, tokens and passwords, and
  never infer them from git config.
- A loopback-bound server is unreachable from a sibling container, so the tunnel needed
  `network_mode: service:devcontainer` or a `0.0.0.0` bind.
- A quick tunnel's hostname changes on every restart.
- Nothing in that setup was verified end to end before it was handed over.

## What was verified, and what was not

Against the service on `127.0.0.1:49374` in this workspace:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:49374/
curl -sS -N -u "opencode:$OPENCODE_SERVER_PASSWORD" http://127.0.0.1:49374/api/event | head -5
```

The server answers on loopback, and the API streams SSE locally: the first command returns `200`, and
the second returns `200` with `content-type: text/event-stream` and prints event frames.

Not verified: any remote session through a relay. No browser has opened a pairing link, no relay has
carried a session, and no device has been paired from outside the loopback interface.
