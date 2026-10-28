---
id: ADR-020
title: Serving the opencode web UI locally with tunneling
status: accepted
date: 2026-10-25
scope: opencode-web-access — local server binding, password source, DevContainer forwarding, and remote reachability for the opencode web UI
L0: "ADR-020: opencode web on loopback, env-file password; remote reach is opencode pair --remote via OpenTunnel, stable route, one shared password; Cloudflare quick and named tunnels built and rolled back; ngrok, SSH, Tailscale, 0.0.0.0 rejected."
---

# ADR-020: Serving the opencode web UI locally with tunneling

## Context

- The web UI is useful only if the operator can reach it from a remote network, including devices that can open nothing but a browser: no SSH client, no VPN or overlay client, no agent install.
- The server half is fixed: `opencode serve --hostname 127.0.0.1 --port 49374`, with the password supplied from the untracked root `.env`. The endpoint stays on loopback and is never published on the host.
- Pairing surface (binary v2.2.0): `opencode pair --help` prints "one-time links to connect a browser or app"; `--remote` pairs "through the OpenTunnel remote address, enabling remote access if needed (exposes the server to the internet)"; `--yes` accepts exposing the server "when --remote enables remote access for the first time (required without an interactive terminal)"; `--remote` cannot be combined with `--url`; pairing requires the background service.
- Link shape and lifetime: `https://<8-hex-route>.<profile-host>/auth/connect/<code>`, served through OpenTunnel, a blind TLS tunnel. The route is persisted in the service config, so the address is stable across restarts. The code is single-use and short-lived, documented elsewhere as 5 minutes. The binary states: "Traffic is end-to-end encrypted, and access requires your server password."
- Device flow: a browser opens the link, receives a session cookie, and is redirected to the web app. No SSH, no VPN, no client install.
- Why the tunnel path closed: Cloudflare states "Quick Tunnels do not support Server-Sent Events (SSE).", while the UI streams over `GET /api/event` as `text/event-stream`; a named tunnel carries SSE but needs a Cloudflare-managed domain plus an Access application, and in practice the operator could not get the session working end to end. The sidecar, its compose profile, the forwarded port, and its env keys were removed in the rollback.
- Labels: (binary v2.2.0) = read from the installed CLI help; (documentation) = a vendor or operator statement not exercised here; UNVERIFIED = no source beyond the one named.
- Shape: `mem:architecture/adr-rules`; skeleton `mem:architecture/adr-template`.

## Criteria

Chosen for an exposure and reachability decision, where the dominant risk is who can reach an agent holding provider keys and repository write access, and which of those visitors can be cut off again. Each criterion names a quantity on which the rejected paths differ from the selected one, so the set separates any pair that clears the filters below; the filters leave a single option, and only that option carries a score. Scale is -2..+2, unweighted, total range -8..+8.

- Prerequisites the operator must already hold — -2 (a domain, a paid plan, or a new vendor account before the first useful request) to +2 (nothing beyond the machine, the installed binary, and the password already in the untracked env file); this decision turns on an asset the operator did not hold, a Cloudflare-managed domain with an Access application, and that absence is what makes the prerequisite measurable rather than assumed.
- Operational surface that must stay running — -2 (a component built, configured, debugged, and maintained outside the product: sidecar, compose profile, token, dashboard resource) to +2 (the server and its background service only, both product-managed); the tunnel work was built and then rolled back, so the dominant cost was the component, not the request path.
- Address stability across restarts — -2 (the address changes on every restart and earlier links die) to +2 (the same address survives restarts and can be bookmarked); the path is entered repeatedly from several devices, so redistributing an address is routine work, not an edge case.
- Credential granularity — -2 (one shared password, no per-device identity, no per-user revocation) to +2 (each visitor holds a distinct credential revocable alone); the path reaches an agent with provider keys and repository write access, so the blast radius of a lost device is the security question.

Why this set: prerequisites, operational surface, address stability, and credential granularity are the four quantities the operator actually weighed when the tunnel path failed. Dropped and why: event-stream coverage became a pass/fail requirement (N3), because one documented sentence settles it for the whole quick-tunnel class; browser-only reach restates N1; implementation ease and code maintainability, because this decision adds no repository code; cash cost, because no candidate charges cash except the domain, measured under prerequisites.

## Options considered

#### Option A: opencode pair --remote (selected)
Pros:
- A browser-only visitor works: open the link, receive a session cookie, land in the web app (N1).
- Nothing to acquire and nothing to run beyond the product: no domain, no vendor account, no sidecar; the path ships in the binary and uses the background service (N5, N6).
- The route is persisted, so the address is stable across restarts, and the link is single-use and short-lived.
- The server command and loopback bind are untouched.
Cons:
- One shared password in front: no per-visitor identity and no per-user revocation (credential granularity at -2).
- Traffic passes a third-party relay (OpenTunnel), encrypted end to end by the product's own description.
- The background service must be running, or no link is issued.
- `--remote` exposes the server to the internet and `--yes` is required without an interactive terminal.
- No flow was exercised from a remote device by the authoring agent (see `## Consequences`).

#### Option B: Cloudflare quick tunnel with an email PIN gate (built, then rolled back)
Pros:
- No account and no domain are needed to start, and a visitor needs only a browser.
- The email one-time PIN sits in front of the UI rather than only the shared password.
Cons:
- "Quick Tunnels do not support Server-Sent Events (SSE).", while the UI's live updates ride `GET /api/event` as `text/event-stream`, so the page loads and then goes stale.
- The hostname changes on every restart.
- Delivery needs a cloudflared sidecar and its own compose profile, i.e. a component built and maintained outside the product.
Filtered out on N3 and N6.

#### Option C: Cloudflare named tunnel behind Access (built, then rolled back)
Pros:
- Carries SSE: proxied traffic is unbuffered when the origin sends `Content-Type: text/event-stream`.
- Access revokes one visitor by policy edit, and the hostname survives restarts.
Cons:
- Requires a Cloudflare-managed domain and an Access application before the first useful request.
- Needs the cloudflared sidecar, a token, and a dashboard resource to keep working.
- In practice the operator could not get the session working end to end.
Filtered out on N5 and N6.

#### Option D: ngrok with OAuth identity
Pros:
- Edge OAuth puts an identity in front of the UI and leaves the loopback bind alone.
- No server change: the agent dials out.
Cons:
- Another third-party relay, with an account, an authtoken, and an agent to install, for no advantage over the built-in path.
- The free plan meters traffic identities and online endpoints, and the OAuth flag is documented as deprecated.
Filtered out on N5 and N6.

#### Option E: SSH local forward
Pros:
- The loopback bind stays, no new listener opens, and the address is stable.
- Nothing new on the host beyond an SSH daemon.
Cons:
- Every visiting device needs an SSH client and key material.
- Unusable from a phone or a locked-down browser-only workstation.
Filtered out on N1.

#### Option F: Tailscale serve or funnel
Pros:
- `serve` keeps the server private to the tailnet; `funnel` is reachable from a plain browser.
- No change to the server command.
Cons:
- `serve` requires the Tailscale client on the visiting device.
- `funnel` is public, with the shared password as the only barrier, and it admits anyone who finds the name.
- An overlay account and daemon on the host, for the same reach as the built-in path.
Filtered out on N1 (serve), N4 (funnel), N5 and N6.

#### Option G: Bind 0.0.0.0 and publish the port
Pros:
- Smallest local change; any host on the attached network reaches the UI.
- No third party in the path.
Cons:
- Exposes the host to every network it joins and needs router forwarding for anything remote.
- The shared password remains the only barrier.
Filtered out on N2 and N4.

## Non-negotiable requirements

Hard, testable filters derived from the constraint set: the browser-only audience, the fixed loopback endpoint, the UI's stream transport, the security floor of an agent with provider keys and repository write access, and the rollback that removed the tunnel machinery.

- N1 — The visiting device installs nothing: a browser alone reaches the UI, with no SSH client, no VPN or overlay client, and no app.
- N2 — The server keeps binding `127.0.0.1:49374`, and no host port is published for the UI.
- N3 — The path carries the UI event stream end to end: the browser's `GET /api/event` arrives as `text/event-stream` without buffering or drop, and a live state change reaches the open page.
- N4 — Reaching the UI requires a credential issued for this server or an identity, in addition to the shared password; the password alone does not admit a visitor.
- N5 — The path needs no asset the operator must first acquire: no domain, no paid plan, no vendor account.
- N6 — No separately built and operated relay component: no sidecar, no compose profile, no vendor token, no dashboard resource; the access path is the installed product's own.

| Option | N1 | N2 | N3 | N4 | N5 | N6 | Result |
|---|---|---|---|---|---|---|---|
| A pair --remote | PASS | PASS | PASS | PASS | PASS | PASS | eligible |
| B quick tunnel + PIN | PASS | PASS | FAIL | PASS | PASS | FAIL | filtered out on N3, N6 |
| C named tunnel + Access | PASS | PASS | PASS | PASS | FAIL | FAIL | filtered out on N5, N6 |
| D ngrok OAuth | PASS | PASS | PASS | PASS | FAIL | FAIL | filtered out on N5, N6 |
| E SSH local forward | FAIL | PASS | PASS | PASS | PASS | PASS | filtered out on N1 |
| F Tailscale serve/funnel | FAIL | PASS | PASS | FAIL | FAIL | FAIL | filtered out on N1, N4, N5, N6 |
| G bind 0.0.0.0 + publish | PASS | FAIL | PASS | FAIL | PASS | PASS | filtered out on N2, N4 |

Option B fails N3 on the vendor statement "Quick Tunnels do not support Server-Sent Events (SSE).": the page request is accepted and every update that would travel over the event stream never arrives. Option F's `funnel` passes N1 but fails N4, because the shared password is its only barrier; its `serve` form fails N1 because the visiting device needs the overlay client. Option G fails N2 because publication is the mechanism.

One option clears every requirement: A. Filtering leaves a single eligible option, so no contest exists and none is manufactured here; the four criteria would separate A from any future option that qualifies, and the rejected rows carry their failing requirement rather than a score. A's N3 and N4 verdicts rest on the product's documented behaviour, not on an exercised flow.

## Scoring

Only the eligible option is scored. Scores are unweighted, and each is the plain sum across the four criteria.

| Criterion | Opt A |
|---|---|
| Prerequisites the operator must already hold | 2 |
| Operational surface that must stay running | 2 |
| Address stability across restarts | 2 |
| Credential granularity | -2 |
| Total | 4 |

A sits at the top of the scale on the three quantities that ended the tunnel path: it needs nothing the operator does not already hold (+2), nothing is built or maintained beyond the server and its background service (+2), and the persisted route keeps the same address across restarts (+2). It sits at the floor on the one quantity it cannot fix: a single shared password with no per-user revocation (-2), which is the residual risk recorded below. The total is +4 of a possible +8, and the -2 is the whole cost.

Option B was filtered out on N3 and N6, C on N5 and N6, D on N5 and N6, E on N1, F on N1, N4, N5 and N6, and G on N2 and N4; none of them is scored, because eligibility is settled before any score is given.

## Decision

Remote access to the local opencode web UI is provided by OpenCode's own pairing path: `opencode pair --remote` prints a single-use link served through OpenTunnel, and a browser that opens it receives a session cookie and lands in the web app. The server stays bound to loopback on port 49374 with its password supplied from the untracked environment file, so no additional tunnel, vendor account, or client is part of the path.

## Consequences

- Rollback, what was built and removed: the cloudflared sidecar, its compose profile, the forwarded port, and its env keys were removed when the tunnel path was abandoned. Nothing in the repository now provides a tunnel, and no Cloudflare resource is part of the access path.
- Residual risk, transport: traffic passes a third-party relay, OpenTunnel, even though the binary states "Traffic is end-to-end encrypted, and access requires your server password." and the relay is described as a blind TLS tunnel. Availability and routing of the relay sit outside the operator's control.
- Residual risk, identity: access is one shared password, so every visitor acts with the agent's authority and its provider keys and repository write access. There is no per-user revocation; cutting off one device means rotating `OPENCODE_SERVER_PASSWORD`, which signs every session out at once. A lost device cannot be removed alone.
- Operational facts: the route is persisted in the service config, so the address is stable across restarts and can be bookmarked. Each link is single-use and short-lived, documented elsewhere as 5 minutes, so a link is a one-time admission rather than a standing URL. The background service must be running or no link is issued, `--remote` cannot be combined with `--url`, and `--yes` is required without an interactive terminal.
- Operational limit: exposure is switched on by `--remote`, which the binary describes as exposing the server to the internet. The loopback bind limits the listener, not the reach.
- Evidence limit, stated explicitly: no flow was proven from a remote device by the authoring agent. No pairing link was opened from another network, no session cookie was observed there, and no live update was seen through OpenTunnel. The pairing facts above are the binary's help text and the operator's documentation, so any smoke check must hold a session open from a remote device and watch a live update land, not merely load the page.
- Withdrawn selection: the earlier record named a Cloudflare quick tunnel behind an email PIN allow-list as the chosen path, with the event-stream requirement knowingly unmet. That selection is withdrawn; the quick tunnel appears here as a rejected option. Status is `accepted`, and the revision date is 2026-10-27.
- The local half is unchanged by the rollback: server command, loopback bind, and password source are as before. `mem:architecture/adr-rules` governs this shape and `mem:architecture/adr-template` the skeleton; ADR-019 and earlier remain in force.