---
id: opencode/native-event-system-surface
type: claims
scope: claims — verified atomic facts about a published API surface, file/line evidence
L0: "OpenCode v2.2.7: events are subscribe-only; plugins emit only rpc.*, never a domain event"
provenance: "@opencode/client 2.0.24 and @opencode/plugin 2.0.24 dist .d.ts; @opencode/schema event.d.ts; binary fixed-string counts"
confidence: 0.9
hotness: 1.0
freshness: 2026-11-11
ttl: 90d
---
SDK: event.subscribe(options?):AsyncIterable<V2Event> client:10-12; opts {signal?,onActivity?} shared-events:2-6; GET /api/event; volatile (overflow/disconnect loses); server.connected injected.
Plugin: setup(ctx)=>Promise<Cleanup|void>|Cleanup|void plugin:55-58; Context.event:EventDomain=Pick<EventApi,"subscribe"> event:2. Publish Context.rpc plugin:44->register rpc:21->events.emit rpc:12-16 -> rpc.*; none emit session.idle.
V2Event 94 types:3357; envelope {id,type,created,data,location?,metadata?,durable?} schema:41-53.
Ext points=Context methods, not v1 hooks: tool.hook 6/session.hook 52/shell.hook 1/tool.transform 22/agent.transform 4/storage.scan 3; v1 Hooks 21 keys incl event?.