# dsh Sandbox Backend Selection

bwrap 0.9.0 is installed but BROKEN in the unprivileged OrbStack devcontainer (EPERM creating namespaces, seccomp). dsh probes backends by CAPABILITY (bwrap -> Landlock), so Landlock (`node-addon-landlock-run`) is auto-selected; the home patch pins `sandbox-policy.config.mode: workspace-write`. Fail-closed `SANDBOX_UNAVAILABLE` error when no backend works.

Telemetry `session-telemetry-otel` defaults DISABLED — matches the repo telemetry-off stance; leave it. General devcontainer environment process: mem:devcontainer-workflows/about.