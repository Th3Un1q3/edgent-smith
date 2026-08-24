# Diagnose OrbStack host process SIGKILL (wait status 9)

When the OrbStack host process dies with SIGKILL / wait-status-9, the killer is UNIDENTIFIED upstream (orbstack#2314, #2502, #2385). Do NOT assume memory pressure without evidence.

## Confirm the killer first

- Run `sudo log show --last 6h --predicate 'subsystem == "com.apple.runningboard"'`
- Check /Library/Logs/DiagnosticReports/JetsamEvent-*.ips

Watchdog kill after a VirtioFS hang (#2385) is a competing cause when refresh_nodeid errors precede death. When filing upstream, report the OrbStack version plus these artifacts.