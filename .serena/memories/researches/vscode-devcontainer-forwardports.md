# VS Code Dev Containers forwardPorts never created (compose + OrbStack)

Symptom: tunnel-forwarding extension activates but no forward listener is ever created; compose-published ports fine.

Findings:
- #4645: compose devcontainers forward ONLY primary-container ports (open, 2021).
- #11772 (2026-07): rebuild leaves stale relay mapping; forwarded ports dead until manual remove+re-add.
- #10568: reconnect kills forwards; workarounds: reload window, remove/re-add, always-forward-a-port.
- #10370: PortsPerTunnel(10) limit error even with no active forwards — relay-state corruption denies forwarding.
- vscode#161045: remote.autoForwardPorts=false ignored in some containers.
- docs: forwardPorts/portsAttributes semantics from devcontainerjson-reference; remote.restoreForwardedPorts from SSH doc.
- OrbStack: no dedicated VS Code port-forwarding doc page found; event-based port forwarding per architecture doc; no matching orbstack issue for VS Code forwardPorts.

## Sources

- github.com/microsoft/vscode-remote-release/issues/4645, 11772, 10568, 10370, 9715, 11707, 11551, 9890
- github.com/microsoft/vscode/issues/161045
- code.visualstudio.com/docs/devcontainers/devcontainerjson-reference, /docs/remote/ssh, /docs/remote/containers, /docs/remote/tunnels
- heissenberger.at blog devcontainer-forward-ports-composer
- docs.orbstack.dev/architecture (event-based port forwarding)