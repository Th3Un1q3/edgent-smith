---
id: ADR-020
title: Serving the opencode web UI locally with tunneling
status: proposed
date: 2026-10-25
scope: opencode-web-access — local server binding, password source, DevContainer forwarding, and remote reachability for the opencode web UI
L0: "ADR-020: opencode web on loopback, password from env; browser-only remote access via email-gated cloudflared tunnel upgradeable to Cloudflare Access."
---

# ADR-020: Serving the opencode web UI locally with tunneling

## Context

- The OpenCode web UI runs beside the local instance and is useful only if the operator can reach it from a remote network, including devices that may open nothing but a browser: no SSH client, no VPN or overlay client, no agent install.
- The application layer gates that UI with a single shared server password and offers no per-user accounts, no MFA, no RBAC, and no rate limiting (UNVERIFIED (docs)), so any visitor identity has to sit in front of it.
- Labels used below: (binary v2.1.4) = read from the installed CLI's --version/--help this session; UNVERIFIED (docs) = documentation statement not confirmed against a running server; UNVERIFIED (vendor docs) = tunnel or provider statement quoted from documentation but neither installed nor exercised here.
- Supported surface (binary v2.1.4): "opencode serve" ("Start the v2 API and web server") with --hostname, --port, --cors (repeatable, additional allowed CORS origin), --service, --stdio; there is no "opencode web" subcommand. UNVERIFIED (docs): the UI "is served from the same server that powers the TUI", "By default the server listens only on localhost", the default port is 49374 on macOS/Linux/WSL and 28894 on Windows, the password comes from OPENCODE_SERVER_PASSWORD, sessions last 30 days, and changing the password signs every session out. Precedence between that variable and "opencode service set password" is UNVERIFIED.

## Criteria

Chosen for a security-exposure and reachability decision, where the dominant risk is who can reach an agent holding provider keys and repository write access — not which library to import.

- Leak blast radius — -2 (a leaked link or stale session keeps the agent's full authority indefinitely) to +2 (leaked material expires quickly and can be cut off per identity); the decision exposes an agent holding provider keys, so the realistic incident is a shared link or a dormant session rather than a wrong abstraction. Separates A from F: rotating quick-tunnel hostnames and 20-30 second token revocation against a stable ngrok endpoint and a monthly identity slot.
- Running cost and prerequisites under free-tier limits — -2 (a paid tier or tight quotas force constant pruning) to +2 (free, stable, and accountless); the operator must keep this path up without administering an identity provider, so caps are the failure mode. Separates A from F: no account or domain needed for the quick tunnel against three traffic identities and three endpoints per month.
- Re-enrollment after device loss — -2 (recovering a lost device means rebuilding the tunnel) to +2 (a replacement device enrolls itself with a browser gesture); the requirement spans several devices, so loss and replacement are routine. Separates A from F: a new visitor email needs only the PIN against consuming one of three monthly identity slots.
Why this set: three criteria, each able to move A and F apart, covering the incident (leak blast radius), the upkeep (free-tier cost and prerequisites), and the device lifecycle (re-enrollment). Dropped from the earlier set and why: operator familiarity, because no tunnel product is installed in this environment — cloudflared, ngrok, and Tailscale are all absent — so neither eligible option is a mechanism the operator already runs, and the only content left in it (account and prerequisite burden) duplicates the running-cost criterion; browser-only reach, because it restates requirement N1 and both eligible options pass it, so it cannot rank them; identity strength and revocability, because both eligible options enforce visitor identity at the tunnel and tie at +2; reversibility, because A and F both switch off cleanly (tie at 1) and its content is measured more sharply by leak blast radius. Rejected as non-discriminating here: code-level maintainability and implementation ease in repo code, because this decision adds no repo code; flexibility, because every candidate reaches the same UI and differs only in its gate; and initial implementation cost, because both eligible paths are zero-cash on free tiers. Scale stays -2..+2 and unweighted: a total is the plain sum across the three criteria (-6..+6), ranking eligible options only, because eligibility is settled by the non-negotiables before any score is given.

## Options considered

#### Option A: Email-gated cloudflared quick tunnel, upgradeable to a named tunnel behind Cloudflare Access
Pros:
- A browser-only device works: the visitor receives a one-time PIN by email, needs no Cloudflare account, no client, and no key material.
- No account or domain is needed to start, and the same shape upgrades to a named tunnel with a deny-by-default Access allow policy once a domain exists.
- Identity sits in front of the web UI, and Access revocation is per-application and per-user with tokens rejected in 20-30 seconds.
Cons:
- The quick-tunnel hostname is random and rotates on each start.
- Email authentication requires an interactive browser session, so non-interactive clients cannot use this path.
- The --allowed-mail flag is doc-quoted and its presence in an installed binary is UNVERIFIED; the named tier needs an active domain, and identity never reaches the application layer.

#### Option B: Tailscale serve or funnel
Pros:
- serve adds no public listener and keeps the server private to the tailnet.
- funnel is reachable from a browser with no client on the visitor's device.
Cons:
- serve is reachable only from "other devices on your Tailscale network", so the visiting device needs the Tailscale client.
- funnel is public by construction and its ACL gates who may enable funnel, not who may visit, leaving the shared password as the only barrier.
- Invocations are UNVERIFIED and the binary is absent here.

#### Option C: SSH local forward
Pros:
- The documented local-forward form keeps the server on loopback and opens no new listener.
- Stable, well understood, and needs nothing new on the host beyond an SSH daemon.
Cons:
- Every visiting device needs an SSH client and key management.
- Unusable from a phone or a locked-down browser-only workstation.

#### Option D: Built-in opencode pair --remote, or a bare quick tunnel
Pros:
- No extra software: --remote ships in the installed binary (binary v2.1.4), and a bare quick tunnel needs no account.
- Reaches any browser that holds the shared password, so reachability alone is immediate.
Cons:
- Only the single shared server password stands in front (UNVERIFIED (docs): "This will expose your OpenCode server to the internet… access requires your server password"), so there is no visitor identity and no per-user revocation.
- Non-interactive use requires "--yes, -y", which the binary documents as "required without an interactive terminal" (binary v2.1.4), so unattended exposure is a one-flag decision, and a bare quick tunnel's URL is public by construction.

#### Option E: Bind 0.0.0.0 and publish the port
Pros:
- Smallest local change, and any host on the attached network reaches it.
Cons:
- Reaches no remote network without router port forwarding and provides no identity layer; the shared password remains the only barrier.
- Exposure differs per network and must be re-audited each time.

#### Option F: ngrok free plan with traffic-policy OAuth identity
Pros:
- Browser-only visitors authenticate through OAuth at the edge, so identity is not the shared password.
- No server change: the agent dials out and the loopback bind stands.
Cons:
- The free plan caps "Traffic identities (OAuth/OIDC MAU) | 3 / month" and "Online endpoints | Up to 3", which is thin for several devices used repeatedly.
- The --oauth and --basic-auth flags as literals are UNVERIFIED, so the policy shape would have to be confirmed against a real binary.

## Non-negotiable requirements

Each is a hard, testable filter derived from the actual constraint set; failing any one makes an option ineligible, and filtered options are recorded but never scored into the totals.

- N1 — The visiting device needs no software install of any kind; a browser is sufficient.
- N2 — The server stays bound to loopback, with no host port publication.
- N3 — Visitor identity is enforced by something other than the shared server password.
- N4 — The server password never enters the repository.
- N5 — The repository's runtime and toolchain gain no new dependency; host-side tools sit outside that set.

| Option | N1 | N2 | N3 | N4 | N5 | Result |
|---|---|---|---|---|---|---|
| A email-gated cloudflared | PASS | PASS | PASS | PASS | PASS | eligible |
| B Tailscale serve/funnel | FAIL (serve) | PASS | FAIL (funnel) | PASS | PASS | eliminated by N1 and N3 |
| C SSH local forward | FAIL | PASS | PASS | PASS | PASS | eliminated by N1 |
| D pair --remote / bare tunnel | PASS | PASS | FAIL | PASS | PASS | eliminated by N3 |
| E bind 0.0.0.0 + publish | PASS | FAIL | FAIL | PASS | PASS | eliminated by N2 and N3 |
| F ngrok traffic-policy OAuth | PASS | PASS | PASS | PASS | PASS | eligible |

Two options survive the filter, so a contest exists and the criteria above discriminate between them.

## Scoring

Only the eligible options are scored; B, C, D, and E are excluded and their totals never appear. Scores are unweighted.

| Criterion | Opt A | Opt F |
|---|---|---|
| Leak blast radius | 2 | 0 |
| Running cost and prerequisites under free-tier limits | 1 | -1 |
| Re-enrollment after device loss | 1 | 0 |
| Total | 4 | -1 |

Option A wins uniquely on all three criteria: rotating hostnames and 20-30 second revocation bound what a leaked link can still do, the quick tunnel needs no account or domain while F's free plan caps three traffic identities and three endpoints per month, and a replacement device re-enrolls with an email PIN rather than consuming an identity slot. B was filtered on N1 and N3, C on N1, D on N3, and E on N2 and N3; none of them is scored.

## Decision

Remote access to the opencode web UI is served through an email-gated cloudflared quick tunnel that verifies each visitor with a one-time PIN and upgrades in place to a named tunnel behind a Cloudflare Access allow policy, while the server stays bound to loopback with its password supplied per machine from the untracked root environment file. The host runs cloudflared, and any device that can open a browser reaches the full UI without installing a client.

## Consequences

- Host-side precondition: cloudflared must be installed and run on the host that exposes the port; nothing here reaches a remote device without it, and it is absent from this environment today, so its installation is a prerequisite rather than a verified step.
- Local half, mandated and not yet applied: the server is to bind loopback on port 49374 (28894 on a Windows host), the password is to come from the untracked root environment, that port is to be added to the DevContainer forwardPorts list (the current list does not contain it), CORS stays closed because only the same-origin web UI is used, and the "oc *ARGS" wrapper remains the CLI entry point.
- Identity is enforced at the tunnel, not inside OpenCode: on the named tier the origin receives Cf-Access-Authenticated-User-Email and Cf-Access-Jwt-Assertion, but the verified OpenCode docs name no consumption of them and describe only one shared password, so the application still sees a single principal with the agent's authority. Per-device and per-user attribution therefore lives in the tunnel's logs, not in OpenCode's records.
- Revoking one device means rotating OPENCODE_SERVER_PASSWORD, which signs every session out at once — the blunt instrument. Revoking one tunnel user is per-application and per-user at the Access layer and takes effect within 20-30 seconds without disturbing other devices; on the quick tunnel, restarting with a new hostname is the equivalent. Cloudflare's warning that the header alone is insufficient applies to any future origin-side check: the JWT and signature would have to be confirmed, which OpenCode does not do today.
- A device that can only browse can open the URL, pass the email PIN or the Access allow policy, and use the full web UI with the agent's authority. It cannot use non-interactive clients, because email authentication requires an interactive browser session; it cannot be given its own identity inside OpenCode; and it loses access once the tunnel stops or the password rotates.
- UNVERIFIED, and no flow was tested: the --allowed-mail PIN gate is doc-quoted (changelog 2026-10-02) but not confirmed against an installed cloudflared; the Access deny-by-default policy, per-user revocation timing, and origin header behaviour are vendor documentation; Tailscale serve/funnel invocations are unverified with the binary absent; ngrok policy flags are unverified. No tunnel, PIN, pairing, or Access flow was exercised for this ADR, so none of it should be read as an operational guarantee until an operator runs it once.
- Password tie-breaker, independent of the unknown precedence: the stored service password is kept absent, so OPENCODE_SERVER_PASSWORD is the only configured source and the two cannot diverge; if a stored password already exists, it is cleared through the service tooling first, because the clearing command is not documented here. If hostname or port is pinned with "opencode service set hostname|port", only that setting is stored.
- opencode.jsonc and .devcontainer/.env.example remain untouched, ADR-019 and earlier ADRs remain in force, and no repo file was changed by this decision.
