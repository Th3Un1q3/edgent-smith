---
id: opencode/plugin-rpc-custom-events
type: claims
L0: "Plugins emit ephemeral events only via Context.rpc registration"
ttl: 60d
freshness: 2026-11-11
---
- rpc=RpcDomain (plugin.d.ts:44); register()=>registration (rpc.d.ts:21); events.emit(...EventInput) (:12-16); [name,data] (rpc.d.ts:101-103); type rpc.<defId>.<event> (:105).
- Envelope {id,created,metadata?,type,location(server-set),data}; V2Event.rpc; no durable (groups/event.js:11-18).
- Declare-first: events required (:41); unknown fails "Unknown RPC event: <id>.<name>". Ephemeral only (event.d.ts:52); volatile (slow consumer overflows, disconnects lost); no cross-location (rpc.d.ts:18); cannot emit session.idle.
- Unconfirmed: id rewrite; fan-out. Repo: context.rpc 0 hits.