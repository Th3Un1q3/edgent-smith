# @aiDotEngineer (AI Engineer) — Channel Catalog for Harness Engineering

Updated 2026-08-07 (Run 6 — session id ses_024f1d87bffeSW5IghWxx5cXE5). Sources: yt-dlp flat-playlist enumeration (1023 videos), youtube-transcript get_video_info (metadata), get_transcript (transcripts).

## Channel overview
- Name: AI Engineer (@aiDotEngineer). Focus: AI engineering conferences/talks (AI Engineer Summit/World's Fair/CODE/Europe/Singapore/Miami/Melbourne), agent harness engineering, MCP, coding agents, evals, context engineering.
- Size: 1023 videos enumerated (newest-first via yt-dlp; includes livestreams, keynotes, workshops, short talks). Activity: very high — ~1 upload/day since 2023; heavy cadence around events (WF2026 Jul 2026, AIE CODE, Singapore/Miami/Melbourne 2026).
- Subscriber/view counts: NOT available via get_video_info (fields: title, description, uploader, upload_date, duration only).

## Transcript cache status (run 4)
- 9 target videos attempted → 2 CACHED + 7 BLOCKED.
- Blocked: YouTube hard IP ban (cloud-provider IP; "YouTube is blocking requests from your IP") — same blocker as run 1. Retried after 45s + 150s backoffs, tried get_timed_transcript, get_available_languages (transcripts EXIST — en auto-generated). 0 of 7 retrievable this run.
- Transcript fetch PARKED pending YouTube IP-ban lift (temporary/external blocker); retry list persisted in this catalog — resume when the ban clears.
- Newly cached (verbatim, verified by read-back):
  - mem:cache/youtube-videos/ai-engineer/why-agent-engineering_5N33E9tC400 (12,540 chars)
  - mem:cache/youtube-videos/ai-engineer/building-pi-in-a-world-of-slop_RjfbvDXpFls (18,882 chars)
- Pre-existing (10, from run 1, unverified content): WF2024/2025/2026 keynotes & tracks, GraphRAG, Reasoning+RL, AIE CODE leadership, AIE Europe coding agents, autoresearch, software factories, 6-things promo.
- Next run: retry 7 blocked ids — BurJvbqFr4c, rmvDxxNubIg, Lue8K2jqfKk, W2HVdB4Jbjs, blmAkayzE8M, -aM2EDTiaMs, xJXm4Wcw4m8 (URLs: https://www.youtube.com/watch?v=<id>).

## Harness-relevant catalog (verified dates via get_video_info 2026-08-06)
| title | date | dur | id | rel | topic |
|---|---|---|---|---|---|
| Why Agent Engineering (swyx) | 2025-03-24 | 12m | 5N33E9tC400 | HIGH | harness philosophy — CACHED |
| Building pi in a World of Slop (Mario Zechner) | 2026-04-16 | 18m | RjfbvDXpFls | HIGH | agent harness case study (pi agent) — CACHED |
| Your Insecure MCP Server Won't Survive Production (Tun Shwe) | 2026-04-08 | 25m | BurJvbqFr4c | HIGH | MCP security — CACHED (run 6) |
| No Vibes Allowed (Dex Horthy) | 2025-12-02 | 21m | rmvDxxNubIg | HIGH | engineering standards vs vibes — CACHED (run 6) |
| Claude Code & evolution of agentic coding (Boris Cherny) | 2025-07-04 | 18m | Lue8K2jqfKk | HIGH | coding agent internals — CACHED (run 6) |
| Architecting Agent Memory (Richmond Alake, MongoDB) | 2025-06-27 | 18m | W2HVdB4Jbjs | HIGH | agent memory — CACHED (run 6) |
| How to Secure Agents using OAuth (Jared Hanson) | 2025-07-30 | 19m | blmAkayzE8M | HIGH | auth/permissions — CACHED (run 6) |
| Everything You Need To Know About Agent Observability (Raindrop) | 2026-05-07 | 50m | -aM2EDTiaMs | HIGH | observability — CACHED (run 6) |
| Taming Rogue AI Agents (Jim Bennett, Galileo) | 2025-06-27 | 16m | xJXm4Wcw4m8 | HIGH | safety/evals — CACHED (run 6) |
| Harness Engineering: Humans Steer, Agents Execute (Ryan Lopopolo, OpenAI) | 2026-04-17 | 46m | am_oeAoUhew | HIGH | harness engineering — CACHED (run 6) |
| Your Agent Didn't Fail. Your Harness Did. (Vinoth Govindarajan, OpenAI) | 2026-07-29 | 18m | BInpv7lGp1o | HIGH | harness debugging — CACHED (run 6) |
| Every Harness Will Become A Claw (Sam Bhagwat, Mastra) | 2026-07-21 | 16m | 8qWIPUia2O8 | HIGH | harness future — CACHED (run 6) |
| Harnesses in AI: A Deep Dive (Tejas Kumar, IBM) | 2026-05-17 | 20m | C_GG5g38vLU | HIGH | harness survey |
| Skills are new features: Building Skill-Centric Harness (Yogendra Miraje, FactSet) | 2026-07-29 | 17m | 7jjudsEhBtM | HIGH | skill system as harness |
| Harness Engineering is not Enough: Software Factories Fail (Dex Horthy) | 2026-07-23 | 19m | Ib5GBkD555M | HIGH | harness critique |
| Event-sourced agent harness with stream processors (Jonas Templestein, Iterate) | 2026-05-14 | 60m | vi-2nasppAg | HIGH | harness architecture |
| What if the harness mattered more than the model? (Aditya Bhargava, Etsy) | 2026-07-07 | 32m | 2e9ANoOEn28 | HIGH | harness vs model |
| Loop Engineering from First Principles (Kyle Mistele, HumanLayer) | 2026-07-25 | 18m | xIt_mTQp6mY | HIGH | agent loop design — CACHED (run 6) |
| The Great Loops Debate (Dex Horthy et al) | 2026-07-17 | 60m | c35YoMdnI78 | HIGH | agent loop debate |
| WTF Is the Context Layer? (Prukalpa Sankar) | 2026-07-14 | 21m | 8G_1-3IO4ZQ | HIGH | context infrastructure |
| From fork() to Fleet: Agent Sandbox Cloud (Abhishek Bhardwaj, OpenAI) | 2026-07-13 | 45m | OqM67QG_Ikk | HIGH | sandboxing |
| When Agents Meet Physical Data: Physics of Agent Harnesses (Dmitry Petrov) | 2026-07-20 | 28m | bUJgirn4_yc | MEDIUM | harness + data |
| 12-Factor Agents (Dex Horthy, HumanLayer) | 2025-07-03 | 17m | 8kMaTybvDUw | HIGH | agent reliability patterns |
| MCP Is Not Good Yet (David Cramer, Sentry) | 2025-07-03 | 17m | FCi4jT86gSw | HIGH | MCP critique |
| How Claude Code Works (Jared Zoneraich) | 2025-12-26 | 60m | RFKCzGlAU6Q | HIGH | coding agent internals — CACHED (run 6) |
| Claude Agent SDK Full Workshop (Thariq Shihipar) | 2026-01-05 | 2h | TqC1qOfiVcQ | HIGH | agent SDK |
| Gateways are All You Need (Karan Sampath, Anthropic) | 2026-04-27 | 18m | CD6R4Wf3jnY | HIGH | permissions/gateway |
| Identity for AI Agents (Auth0) | 2026-01-14 | 60m | VSdV-AdSlis | HIGH | auth |
| CIAM for AI: Authn/Authz for Agents (Michael Grinich, WorkOS) | 2025-07-21 | 20m | D4Dswf-__RM | HIGH | auth |
| Securing Agents with Open Standards (Auth0) | 2025-06-30 | 19m | FZoMSupg37E | HIGH | security |
| Evolving Claude APIs for Agents (Katelyn Lesse, Anthropic) | 2025-12-04 | 13m | aqW68Is_Kj4 | HIGH | agent API/loop |
| Context Is the New Code (Patrick Debois, Tessl) | 2026-05-03 | 27m | bSG9wUYaHWU | HIGH | context engineering |
| Why More Context Makes Your Agent Dumber (Nupur Sharma, Qodo) | 2026-06-08 | 26m | EcqMYoIV57A | HIGH | context management |
| Agentic Search for Context Engineering (Leonie Monigatti, Elastic) | 2026-05-08 | 60m | ynJyIKwjonM | HIGH | context/retrieval |
| Two Roads to Durable Agents: Replay vs Snapshot (Eric Allam) | 2026-05-10 | 17m | svCnShDvgQg | HIGH | agent state |
| How we solved Context Management in Agents (Sally-Ann Delucia) | 2026-05-10 | 16m | esY99nYXxR4 | HIGH | context management |
| MCP Apps: Extending the Frontier (Ido Salomon & Liad Yosef) | 2026 (WF26) | 19m | -jY2T2PiJBE | MEDIUM | MCP apps |
| MCP Tasks (async) (Cornelia Davis, Temporal) | 2026 | 24m | s4r6nk5WsZw | HIGH | MCP async |

## Prior-run verified catalog (35 videos) still valid — see run-1 table; URLs https://www.youtube.com/watch?v=<id>.

## External find (not channel)
- InfoQ: The Engineering of AI Agents: Context, Harnessing, and Autonomy (_R83pFpUWyM, 2026-05-07, 42m) — harness-relevant, worth citing.

## Run 5 status (2026-08-07)
- Run 5 — ses_024f6bbbcffe5ahjtgmwcQvIvh, 2026-08-07.
- Ban probe: get_transcript on BurJvbqFr4c (retry list) + am_oeAoUhew (watch list) — BOTH failed with "YouTube is blocking requests from your IP" (identical cloud-provider IP ban as runs 1/3/4).
- 0 fetched → 0 cached → 0 verified. Stopped early per 2× retry cap + early-stop rule; remaining 12 IDs not attempted (would waste calls).
- Cached (run 5): (none — 0 fetched).
- Retry list (persistent, unchanged — all 7 still blocked): BurJvbqFr4c, rmvDxxNubIg, Lue8K2jqfKk, W2HVdB4Jbjs, blmAkayzE8M, -aM2EDTiaMs, xJXm4Wcw4m8
- Watch list (5 IDs, still uncached — also blocked by the same ban): am_oeAoUhew, BInpv7lGp1o, 8qWIPUia2O8, xIt_mTQp6mY, RFKCzGlAU6Q
- 12 pre-existing transcripts remain in cache (10 conference tracks + 2 talks); verified intact by read-back this run.

## Run 3 status (2026-08-07)
- Retried all 7 blocked ids (get_transcript x2 each; get_timed_transcript fallback for 6): still hard IP-blocked ("YouTube is blocking requests from your IP"). get_video_info + get_available_languages OK (proves en auto-generated transcripts EXIST for all 7).
- 0 fetched -> 0 cached -> 0 verified this run. 12 pre-existing transcripts remain (10 conference tracks + 2 talks); 2 duration-verified (why-agent-engineering 12,540c/12m; building-pi 18,882c/18m ~1Kc/min).
- View counts NOT exposed by get_video_info (fields: title, description, uploader, upload_date, duration only).
- Newly-relevant uncached videos added to watch list (NOT transcript-attempted, universal IP ban): am_oeAoUhew (Harness Engineering: Humans Steer, Agents Execute), BInpv7lGp1o (Your Agent Didnt Fail. Your Harness Did.), 8qWIPUia2O8 (Every Harness Will Become A Claw), xIt_mTQp6mY (Loop Engineering from First Principles), RFKCzGlAU6Q (How Claude Code Works).
- Retry list (persistent, unchanged, corrected last id): BurJvbqFr4c, rmvDxxNubIg, Lue8K2jqfKk, W2HVdB4Jbjs, blmAkayzE8M, -aM2EDTiaMs, xJXm4Wcw4m8

## Run 6 status (2026-08-07)
- IP ban LIFTED (user changed IP): first probes on BurJvbqFr4c (retry) + am_oeAoUhew (watch) both returned full transcripts; prior runs failed with "YouTube is blocking requests from your IP".
- Attempted ALL 12 targets (7 retry + 5 watch): 12/12 fetched and cached VERBATIM via get_transcript (1 video needed 2 pages: RFKCzGlAU6Q). Zero failures, retry cap not exceeded.
- Cached (run 6) - all read-back verified, duration-proportional (~1K chars/min):
  - mem:cache/youtube-videos/ai-engineer/your-insecure-mcp-server-won-t-survive-production-tun-shwe-l_BurJvbqFr4c (20,707 chars / 25m)
  - mem:cache/youtube-videos/ai-engineer/harness-engineering-how-to-build-software-when-humans-steer-_am_oeAoUhew (43,422 / 46m)
  - mem:cache/youtube-videos/ai-engineer/no-vibes-allowed-solving-hard-problems-in-complex-codebases-_rmvDxxNubIg (23,639 / 21m)
  - mem:cache/youtube-videos/ai-engineer/claude-code-the-evolution-of-agentic-coding-boris-cherny_Lue8K2jqfKk (18,091 / 18m)
  - mem:cache/youtube-videos/ai-engineer/architecting-agent-memory-principles-patterns-and-best-pract_W2HVdB4Jbjs (15,660 / 18m)
  - mem:cache/youtube-videos/ai-engineer/how-to-secure-agents-using-oauth-jared-hanson-keycard-passke_blmAkayzE8M (19,545 / 19m)
  - mem:cache/youtube-videos/ai-engineer/everything-you-need-to-know-about-agent-observability-danny-_-aM2EDTiaMs (41,413 / 50m)
  - mem:cache/youtube-videos/ai-engineer/taming-rogue-ai-agents-with-observability-driven-evaluation-_xJXm4Wcw4m8 (16,940 / 16m)
  - mem:cache/youtube-videos/ai-engineer/your-agent-didn-t-fail-your-harness-did-vinoth-govindarajan_BInpv7lGp1o (14,539 / 18m)
  - mem:cache/youtube-videos/ai-engineer/every-harness-will-become-a-claw-sam-bhagwat-mastra_8qWIPUia2O8 (14,986 / 16m)
  - mem:cache/youtube-videos/ai-engineer/loop-engineering-from-first-principles-kyle-mistele-humanlay_xIt_mTQp6mY (18,435 / 18m)
  - mem:cache/youtube-videos/ai-engineer/how-claude-code-works-jared-zoneraich-promptlayer_RFKCzGlAU6Q (61,839 / ~1h, 2 pages)
- Remaining blocked: NONE - retry list cleared; watch list fully cached. ai-engineer cache now 24 entries (12 pre-existing + 12 new).
- Note: subagent session id not discoverable (env + opencode storage probes empty); section labeled by date. All 12 uploaders verified = AI Engineer via get_video_info.

## Cached sources
- mem:cache/youtube-videos/ai-engineer/why-agent-engineering_5N33E9tC400
- mem:cache/youtube-videos/ai-engineer/building-pi-in-a-world-of-slop_RjfbvDXpFls
- Full 1023-video enumeration (id|title|duration) regenerable via `uvx yt-dlp --flat-playlist --print %(id)s|%(title)s|%(duration)s https://www.youtube.com/@aiDotEngineer`; flat-playlist does not expose upload dates.