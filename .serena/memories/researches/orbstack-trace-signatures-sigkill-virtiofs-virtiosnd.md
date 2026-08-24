# OrbStack trace signatures: SIGKILL of helper, virtiofs refresh_nodeid race, virtio_snd probe -110
Research date: 2026-08-22

## S1 host exit SIGKILL raw wait status 9
- Exact match: orbstack/orbstack#2601 (OPEN) — Helper SIGKILLed during Docker workloads.
- Related open: #2579 (random crash, v2.2.1), #308 (exited signal 9), #2314 (silent VM death).
- Cause per #2601 comments: on 16GiB hosts macOS jetsam idle-exit kills helper (confirmed via runningboard log + JetsamEvent absence/presence checks); one 32GiB host shows same signature WITHOUT jetsam evidence -> cause unsettled.
- Diagnostics from comments: sudo log show --predicate 'subsystem == "com.apple.runningboard"' --last 6h; check JetsamEvent-*.ips; memorystatus lines; unified-kill.log.
## S4 virtiofs refresh_nodeid race
#2385 (CLOSED 2026-04-20): vmgr hangs then macOS watchdog SIGKILLs; title names VirtioFS refresh_nodeid race. Comment: Fixed in v2.1.0 (docs.orbstack.dev/release-notes). RN v2.1.0 (2026-04-19): Fixed rare race in shared file system. Last commenter still sees crashes 10x/day (REPORTED, unverified). Not cosmetic in that report: preceded vmgr death.
## S5 virtio_snd control message timeout, probe failed -110
-110=ETIMEDOUT during Linux driver probe; probe failure leaves VM without audio, boot continues. No orbstack issue matches this log line. #2477 (CLOSED): virtio-snd passthrough feature request implemented, Released in v2.2.0 (Jun 4, 2026); RN also lists microphone fixes. Harmless unless audio needed inside machine/container.
## Cached sources
- mem:cache/github/orbstack-orbstack/search-sigkill
- mem:cache/github/orbstack-orbstack/search-refresh-nodeid-race
- mem:cache/github/orbstack-orbstack/search-virtio-snd-timeout
- mem:cache/github/orbstack-orbstack/issue-2579 .. issue-30 (+comments for 2385/2601/30/2477)
- mem:cache/fetch/docs.orbstack.dev/release-notes
- mem:cache/tavily/search-virtio-snd-etimedout-benign
- mem:cache/tavily/search-macos-sigkill-jetsam-diagnostics