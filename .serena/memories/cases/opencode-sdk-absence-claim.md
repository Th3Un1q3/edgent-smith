---
id: cases/opencode-sdk-absence-claim
type: cases
L0: "one-package grep 0 read as absence; emit is in @opencode/plugin"
provenance: mem:cases/absence-claim-from-scoped-grep
---
Symptom: "no emit/publish API" shipped in a judged answer.
False: grep over client/dist/**/*.d.ts = 0 in one package only; absence assumed.
Cause: emit is @opencode/plugin RpcRegistration.events.emit via Context.rpc; the 0 was wrong (prose hit, client/dist/pty-handoff.d.ts:4).
Confirmed: a judge re-read plugin/dist/promise/rpc.d.ts:12-16, plugin.d.ts:44. Plugins publish only their own rpc.* events, never a domain event.
Prevention: sweep sibling packages + prose hits; state "no X on surface S", never a global no.
