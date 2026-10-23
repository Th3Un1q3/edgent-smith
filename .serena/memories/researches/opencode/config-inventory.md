# OpenCode config inventory (as-is snapshot)

Snapshot date: 2026-10-23. Harness: opencode v2.1.1. Read-only introspection. Facts only; the decision record lives in architecture/adr/ADR-013-native-code-mode-mcp-access and is not restated here. Every fact is tagged [verified] (read from file/command output during the snapshot) or [unverified].

## 1. Config sources

1. Project config is ONLY /workspace/opencode.jsonc (95 lines) [verified] opencode.jsonc:1-95.
2. /workspace/opencode.json is ABSENT [verified] (ls: No such file or directory).
3. Global config ~/.config/opencode/ holds only service.json, which contains a single key password [verified] (ls ~/.config/opencode; cat service.json). No opencode.json or opencode.jsonc there: ABSENT [verified].
4. opencode debug config reports three sources: {"type":"directory","path":"/home/vscode/.config/opencode"}, {"type":"document","path":"/workspace/opencode.jsonc"}, {"type":"directory","path":"/workspace/.opencode"} [verified] opencode debug config output.
5. /workspace/.opencode/.opencode/ contains only package.json, package-lock.json, .gitignore; no config [verified] (.opencode/.opencode listing).
6. .opencode/oh-my-openagent.jsonc:11-16 sets disabled_mcps [websearch, context7, grep_app, lsp]; this is a separate harness file, not opencode's mcp block [verified].
7. The Docker MCP Gateway catalog is mcp/catalog.yaml and is not an opencode config source [verified] mcp/catalog.yaml:1-106.
8. .copilot/mcp-config.json configures Copilot only (mcpServers: context7, deepwiki) [verified] .copilot/mcp-config.json:1-20.

## 2. MCP declaration shape

Legacy flat shape, verbatim [verified] opencode.jsonc:89-94:

    "mcp": {
        "gateway": {
            "type": "remote",
            "url": "http://mcp_gateway:8080/mcp"
        },
    }

9. Exactly one MCP entry exists: gateway, type remote, url http://mcp_gateway:8080/mcp [verified] opencode.jsonc:90-93.
10. The runtime normalizes the flat shape. opencode debug config prints "mcp": {"servers": {"gateway": {"type": "remote", "url": "http://mcp_gateway:8080/mcp"}}} [verified] opencode debug config output.
11. Behind the gateway, mcp/catalog.yaml declares 9 servers: tavily (:3, remote), deepwiki (:20, remote), serena (:28, remote, http://serena:9121/mcp), devtools (:36, remote, http://host.docker.internal:9223/mcp), context7 (:44, remote), github (:58, remote, read-only), fetch (:72, local image mcp/fetch:latest), youtube-transcript (:78, local), filesystem (:84, local, digest-pinned) [verified] mcp/catalog.yaml.
12. Remote/local split in the catalog: 6 remote, 3 local container images [verified] mcp/catalog.yaml:3,20,28,36,44,58 vs :72,78,84.

## 3. Permission entries governing MCP and execute

13. opencode.jsonc:59: "list_mcp_resources": "deny" [verified].
14. opencode.jsonc:81: "gateway_*": "deny" [verified].
15. opencode.jsonc:82-84: "gateway_mcp-find": "allow", "gateway_code-mode": "allow", "gateway_mcp-exec": "allow" [verified].
16. debug config renders the wildcard entry as a literal action: {"action":"gateway_*","resource":"*","effect":"deny"}, followed by the three exact-name allows [verified] opencode debug config output.
17. There is no top-level execute entry in opencode.jsonc; only agents declare it [verified] opencode.jsonc:54-85.

## 4. Agent-level permission postures (user-owned; outside every write scope)

18. .opencode/agents/rug.md:5-11 denies *, allows goal, workflow, subtask_*, execute, question [verified].
19. .opencode/agents/rug-workflow.md:5-11 has the identical posture; its description at :3 says work runs via code mode [verified].
20. .opencode/agents/rug-swe.md:10-11 denies list_mcp_* and read_mcp_* [verified].
21. .opencode/agents/rug-team-coach.md:5-6 denies * [verified].
22. These agent frontmatter permissions are user-owned configuration and sit outside this research's write scope; they are recorded as observed, not as proposed changes [verified]

## 5. Plugins and instructions

23. opencode.jsonc:86-88 declares one plugin: @mohak34/opencode-notifier@latest [verified].
24. debug config plugins array lists only that notifier, yet .opencode/plugins/*.ts plugins are active: each exports default plugin (goal-continuation.ts:403, instructions-loader.ts:552, quality-gate-enforcer.ts:99, tool-limit-reminder.ts:405, workflow.ts:382) and this snapshot session received their injected steering [verified].
25. opencode.jsonc:20-22 sets instructions to exactly [.opencode/instructions/steering-message.md] [verified].
26. The instructions-loader plugin publishes the other instruction files as steering entries; .opencode/instructions/ contains 20 files [verified] (.opencode/instructions listing).
27. tool-limit-reminder.ts hooks execute.before (:301) and execute.after (:344), and rewrites the prompt to prepend a task-budget tag (:355-366) [verified].

## 6. Skill loader

28. Skills are surfaced through the native skill tool, not through the mcp block [verified] (session tool catalog).
29. .agents/skills/ contains 39 skill directories [verified] (ls .agents/skills | wc -l).
30. Envelope and loader internals are NOT re-described here; see refactoring/skills-loader-envelope-mechanism.

## 7. Effective session-start tool set (this harness, default agent)

31. Model-visible tools: execute; shell; read; write; edit; glob; grep; skill; goal; websearch; question; task; plus MCP tools addressed as tools.gateway["code-mode"|"mcp-exec"|"mcp-find"] and tools.opencode[...] [verified] session tool catalog.
32. The gateway exposes only these three functions at session start; individual catalog servers appear as namespaces inside code mode, not as top-level tools [verified] session tool catalog.

## 8. Code-mode awareness in config

33. No codemode key exists anywhere in config today: a repo-wide grep for codemode (excluding node_modules, .git, sessions) finds matches only in .serena/memories prose, none in opencode.jsonc, mcp/catalog.yaml, or .opencode/plugins [verified].
34. The only current code-mode awareness in committed config is agent permission entries naming execute (rug.md:8, rug-workflow.md:8) and the rug-workflow.md:3 description [verified].

## 9. Diff anchor

This file is the before-image. After any migration, diff the following anchors: the mcp block at opencode.jsonc:89-94 (flat vs servers), the permission block at opencode.jsonc:54-85, the presence or absence of a codemode key, the count of session-start top-level tools, and the set of config sources reported by opencode debug config.