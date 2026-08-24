# OrbStack forwarder binds fail with EADDRNOTAVAIL

OrbStack scon port forwarding binds on internal service-subnet addresses (IPv4 0.250.250.x, IPv6 fd07::/8 ULA) and fails with EADDRNOTAVAIL during devcontainer startup. Known bug class: orbstack#2527, filed against v2.2.1; co-occurs with SIGKILL diagnostics in orbstack#2502. Traced against live failures 2026-08-22.

## Recovery

Run full `orb shutdown`, restart OrbStack, then rerun `devcontainer up`. Required especially after macOS sleep/wake or VPN changes. Update OrbStack to >= 2.2.2: v2.2.2 fixes interface binds (#2567) and filesystem events (#2561).

## Related signals

virtio_snd probe -110 messages are benign noise. refresh_nodeid race errors were crash precursors before v2.1.0 (orbstack#2385). Host-side SIGKILL diagnosis: `mem:troubleshooting/orbstack-sigkill-diagnostics`.