# Indeed Honeypot Detection — VERIFIED (2026-08-15 run log)

**Status:** VERIFIED from the 2026-08-15 run log + the workflow fix. The defense is implemented in the workflow `/workspace/automa-workflows/Manual Indeed Jobs.automa.json`.

## Verified behavior (run-log evidence)

- de.indeed.com injects a honeypot job card that looks real (real-looking title/company) but carries a fake `data-jk` (observed: `abcdef0123456789`) and an anchor that navigates to `https://de.indeed.com/viewjob?jk=<fake>` with a FULL PAGE NAVIGATION instead of the SPA panel load.
- 2026-08-15 failure sequence: clicked at iteration 6, whole tab navigated to the viewjob placeholder, the extraction block read a description from the WRONG page, the honeypot row was inserted (fake id), and the remaining 19 iterations spun on the wrong page until max_jobs.
- The fake jk `abcdef0123456789` DOES match `^[a-f0-9]{16}$`, so jk-format alone cannot detect it (whether the fake jk always matches hex-16 is UNVERIFIED; the primary detector is the href).

## UNVERIFIED (devtools was down)

- Live DOM attributes of the honeypot card itself (its exact href/markers) remain UNVERIFIED. The validity filter uses the verified real-card href pattern `/pagead/clk|/rc/clk` as the primary discriminator.

## Fix

- Defense = navigation guard + card validity filter + wrong-page sanity check; implemented in the workflow. Generalizable pattern: `browser-automation/automa/honeypot-defense-pattern`.