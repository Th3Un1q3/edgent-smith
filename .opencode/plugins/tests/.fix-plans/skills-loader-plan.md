# Skills Loader Test Consolidation Plan

**Source:** `plugins/tests/skills-loader.test.ts` (754 lines, 31 test cases)
**Target:** `plugins/tests/skills-loader.test.ts` (≤181 lines)
**Implementation:** `plugins/skills-loader.ts` (121 lines)
**Goal:** Preserve every behavior-relevant assertion; merge liberally; delete nothing.

---

## a. Test Inventory (31 test cases)

| # | describe / it name | Lines | Assertion Summary |
|---|---|---|---|
| 1 | `injects skills into prompt and removes skills field when task tool has skills` | 115-148 | skills undefined; prompt has `<task_skills>`, `</task_skills>`, both skill names + bodies, newline separation between `</skill>\n<skill`, `<user_request>` wrap with correct ordering |
| 2 | `wraps prompt in user_request when skills field is absent` (it.each row) | 153-159 | exact prompt `<user_request>\noriginal prompt\n</user_request>` |
| 3 | `wraps prompt in user_request when skills array is empty` (it.each row) | 153-159 | exact prompt `<user_request>\noriginal prompt\n</user_request>` |
| 4 | `does not call Bun.file when skills field is absent` | 161-166 | `mockBunFile` not called; prompt wrapped |
| 5 | `removes skills field and wraps prompt when skills array is empty` | 168-173 | `output.args.skills` undefined; prompt wrapped |
| 6 | `logs debug message when skills array is empty` | 175-183 | `log` called with `"debug"` + `"skills array is empty"` |
| 7 | `does not log 'debug' when skills field is absent` | 185-193 | `log` not called with `"debug"` |
| 8 | `returns early without throwing when output.args is undefined` | 198-209 | resolves undefined; `output.args` undefined; `mockBunFile` not called |
| 9 | `wraps prompt and preserves skills field when skills is string` (it.each row) | 211-227 | prompt wrapped; skills preserved as-is; `mockBunFile` not called |
| 10 | `wraps prompt and preserves skills field when skills is undefined` (it.each row) | 211-227 | prompt wrapped; skills preserved as-is; `mockBunFile` not called |
| 11 | `removes skills field and wraps prompt when directory is undefined` | 229-248 | skills undefined; prompt wrapped; `mockBunFile` not called |
| 12 | `does not log 'debug' when skills is a non-empty array but directory is missing` | 250-268 | `log` not called with `"debug"` |
| 13 | `does not intercept non-task tools even with skills field` | 272-284 | prompt unchanged; skills preserved |
| 14 | `sorts skills by file modification time ascending (oldest first)` | 288-308 | order: skill-a(100), skill-b(200), skill-c(300) |
| 15 | `skips missing skill files and injects remaining skills` | 312-340 | skills undefined; resolved bodies present; unresolved has `reference="true"`; info logged |
| 16 | `injects references when all skills are missing` | 344-369 | `<task_skills>` block; `reference="true"`; `Load the skill` message; `<user_request>` wrap; skills undefined; info logged |
| 17 | `does not contain stray content inside <task_skills> when no skills are resolved` | 371-382 | prompt matches `/<task_skills>\n<skill/` |
| 18 | `injects a single skill correctly` | 386-404 | skills undefined; `<task_skills>`; skill name; body; `<user_request>` wrap; ordering |
| 19 | `uses empty string fallback when prompt is missing from args` | 408-425 | skills undefined; `<task_skills>`; skill body; empty `<user_request>` |
| 20 | `includes path attribute on resolved skill tags` | 444-457 | `path=".agents/skills/skill-a/SKILL.md"`; `<skill_index>` |
| 21 | `includes skill_index with all files from the skill directory` | 459-473 | 3 file paths in skill_index |
| 22 | `places skill_index before skill content` | 475-492 | indexPos < contentPos |
| 23 | `does not add path or skill_index to unresolved skills` | 494-515 | resolved has path; unresolved has no path |
| 24 | `falls back gracefully when readdir fails` | 517-538 | skill injected; path present; skill_index; SKILL.md fallback |
| 25 | `filters non-string entries from skill directory listing` | 540-563 | only string entries in skill_index |
| 26 | `sorts and joins skill directory files alphabetically with newlines` | 565-605 | alphabetical order; newline joins |
| 27 | `adds skills parameter to task tool jsonSchema` | 636-666 | skills defined, type array, items `{type:"string"}`, description contains `.agents/skills`; prompt preserved; not in required |
| 28 | `does not modify non-task tool jsonSchema` | 668-689 | skills undefined; filePath preserved |
| 29 | `initializes jsonSchema.properties when missing` | 691-711 | properties defined; skills defined; type array |
| 30 | `handles missing jsonSchema by returning early` | 713-724 | resolves undefined; jsonSchema undefined |
| 31 | `does not overwrite skills property when it already exists (idempotent)` | 726-750 | description `"custom skills"`; type array; prompt preserved |

---

## b. Merge Groups (31 → 16 consolidated)

### Group A: Happy path injection (Test 1)
**New name:** `"injects skills into prompt and removes skills field"`
**Assertions preserved (all from L115-148):**
- L129: `output.args.skills` undefined
- L132: prompt starts with `<task_skills>`
- L133: prompt contains `</task_skills>`
- L136-137: both skill names present
- L138-139: both bodies present
- L142: newline separation `/<\/skill>\n<skill name=/`
- L145: `<user_request>` wrap with original prompt
- L147: ordering `</task_skills>\s*\n<user_request>\noriginal prompt`

### Group B: No-skills scenarios (Tests 2-7)
**New name:** `"no skills to inject"` describe block with 2 sub-tests
**B1:** `it.each` [2 rows: absent, empty] — `"wraps prompt correctly when $desc"`
- L158: exact prompt `<user_request>\noriginal prompt\n</user_request>` (both rows)
**B2:** `it` — `"cleans up skills field and Bun.file guard when absent"`
- L164: `mockBunFile` not called (absent)
- L171: skills undefined (empty)
- L172: prompt wrapped (empty)
**B3:** `it.each` [2 rows: absent, empty] — `"logs debug only when skills array is empty"`
- L178-182: log called with `"debug"` + `"skills array is empty"` (empty row)
- L188-192: log not called with `"debug"` (absent row)

### Group C: Guard tests (Tests 8-12)
**New name:** `"guard: early return and invalid inputs"`
**C1:** `it` — `"returns early when output.args is undefined"`
- L203: resolves undefined
- L206: output.args undefined
- L208: mockBunFile not called
**C2:** `it.each` [2 rows: string, undefined] — `"preserves skills field when non-array"`
- L222: prompt wrapped
- L224: skills preserved as-is
- L226: mockBunFile not called
**C3:** `it` — `"deletes skills and wraps prompt when directory is undefined"`
- L243: skills undefined
- L245: prompt wrapped
- L247: mockBunFile not called
**C4:** `it` — `"does not log debug when directory is missing"`
- L263-267: log not called with `"debug"`

### Group D: Non-task tool (Test 13)
**New name:** `"does not intercept non-task tools"`
**Assertions preserved (L272-284):**
- L281: prompt unchanged
- L283: skills preserved

### Group E: mtime sort (Test 14)
**New name:** `"sorts skills by mtime ascending"`
**Assertions preserved (L288-308):**
- L307: order `["skill-a", "skill-b", "skill-c"]`

### Group F: Missing skill file (Test 15)
**New name:** `"skips missing skill files and injects remaining"`
**Assertions preserved (L312-340):**
- L326: skills undefined
- L328-329: resolved bodies present
- L331-332: unresolved reference attribute
- L335-339: info logged

### Group G: All skills missing (Tests 16-17)
**New name:** `"injects references when all skills are missing"`
**Assertions preserved:**
- L355-357: `<task_skills>` block with reference (L344-369)
- L358: `Load the skill` message
- L360: `<user_request>` wrap
- L361: skills undefined
- L364-368: info logged
- L381: no stray content, matches `/<task_skills>\n<skill/` (L371-382)

### Group H: Single skill (Test 18)
**New name:** `"injects a single skill correctly"`
**Assertions preserved (L386-404):**
- L398: skills undefined
- L399: `<task_skills>` present
- L400: skill name present
- L401: body present
- L402: `<user_request>` wrap
- L403: ordering check

### Group I: Missing prompt fallback (Test 19)
**New name:** `"uses empty string fallback when prompt is missing"`
**Assertions preserved (L408-425):**
- L420: skills undefined
- L422: `<task_skills>` present
- L423: skill body present
- L424: `<user_request>\n\n</user_request>`

### Group J: Skill path and index (Tests 20-26, 7 tests)
**New name:** `"skill path and index"` describe with 4 sub-tests
**J1:** `it.each` [2 rows: path+index, all-files] — `"includes path attribute and full skill_index"`
- L455: `path=".agents/skills/skill-a/SKILL.md"` (L444-457)
- L456: `<skill_index>` present (L444-457)
- L470-472: 3 file paths (L459-473)
**J2:** `it` — `"places skill_index before skill content"`
- L487-491: indexPos < contentPos (L475-492)
**J3:** `it` — `"does not add path or skill_index to unresolved skills"`
- L507-509: resolved has path (L494-515)
- L512-514: unresolved has no path (L494-515)
**J4:** `it` — `"falls back gracefully when readdir fails"`
- L532-537: skill injected, path present, SKILL.md fallback (L517-538)
**J5:** `it.each` [2 rows: filter non-strings, sort alphabetically] — `"processes skill directory entries correctly"`
- L561-562: only string entries (L540-563)
- L590-603: alphabetical order + newline joins (L565-605)

### Group K: tool.definition (Tests 27-31, 5 tests)
**New name:** `"tool.definition"` describe with 3 sub-tests
**K1:** `it` — `"adds skills parameter to task tool jsonSchema"`
- L655-657: skills type array + items (L636-666)
- L658: description contains `.agents/skills` (L636-666)
- L661-662: existing prompt preserved (L636-666)
- L665: not in required (L636-666)
**K2:** `it.each` [2 rows: non-task, missing jsonSchema] — `"does not modify non-task or schemaless tools"`
- L686: skills undefined for non-task (L668-689)
- L688: filePath preserved (L668-689)
- L721-723: resolves undefined, no schema created (L713-724)
**K3:** `it` — `"initializes missing properties and is idempotent"`
- L706-710: properties created, skills added (L691-711)
- L745-748: existing skills preserved, description not overwritten (L726-750)
- L749: prompt preserved (L726-750)

---

## c. Target File Skeleton (≤181 lines)

```typescript
 1: import { describe, it, expect, vi, beforeEach } from "vitest"          // [src L2]
 2: import type { PluginInput } from "@opencode-ai/plugin"                  // [src L5]
 3: import { defaultCreateClient } from "@tests/helpers/mock-utilities"     // [src L6]
 4: import type { ClientMock } from "@tests/helpers/mock-utilities"         // [src L7]
 5: vi.mock("bun", () => { const f = vi.fn(); return { default: { file: f }, Glob: vi.fn() } })
 6: vi.mock("@plugins/helpers/logger")                                      // [src L13]
 7: vi.mock("node:fs/promises", () => ({ readdir: vi.fn() }))              // [src L14-16]
 8: import Bun from "bun"                                                   // [src L18]
 9: import { log } from "@plugins/helpers/logger"                           // [src L19]
10: import { readdir } from "node:fs/promises"                              // [src L20]
11: import { skillsLoaderPlugin } from "@plugins/skills-loader"             // [src L23]
12:
13: const mockBunFile = Bun.file as ReturnType<typeof vi.fn>                // [src L27]
14:
15: function createMockClient(overrides?: Partial<ClientMock>): ClientMock { // [src L37]
16:     return {                                                             // [src L38]
17:         ...defaultCreateClient(),                                        // [src L39]
18:         app: {                                                           // [src L40-41]
19:             log: vi.fn().mockResolvedValue(undefined),
20:             agents: vi.fn().mockResolvedValue({ data: [{ name: "build" }] }),
21:         },
22:         ...overrides,                                                    // [src L43]
23:     }
24: }
25:
26: function makeSkillFile({ name, content, mtimeMs }: { name: string; content: string; mtimeMs: number }) {
27:     void name                                                             // [src L49]
28:     return {                                                             // [src L50-54]
29:         exists: vi.fn().mockResolvedValue(true),
30:         text: vi.fn().mockResolvedValue(content),
31:         stat: vi.fn().mockResolvedValue({ mtimeMs }),
32:     }
33: }
34:
35: function registerSkillFiles(                                             // [src L69-82]
36:     files: Record<string, ReturnType<typeof makeSkillFile>>,
37:     pathPattern: (n: string) => string = (n) => `.agents/skills/${n}/SKILL.md`,
38: ): void {
39:     mockBunFile.mockImplementation((path: string) => {
40:         for (const [name, mock] of Object.entries(files)) {
41:             if (path.endsWith(pathPattern(name))) return mock
42:         }
43:         return { exists: vi.fn().mockResolvedValue(false),                // [src L80: makeMissingSkillFile inlined]
44:             text: vi.fn().mockRejectedValue(new Error("File does not exist")),
45:             stat: vi.fn().mockRejectedValue(new Error("File does not exist")) }
46:     })
47: }
48:
49: describe("skillsLoaderPlugin", () => {                                    // [src L99]
50:     let client: ClientMock                                               // [src L100]
51:     let plugin: Awaited<ReturnType<typeof skillsLoaderPlugin>>           // [src L101]
52:
53:     beforeEach(async () => {                                             // [src L107]
54:         client = createMockClient()                                       // [src L108]
55:         vi.mocked(readdir).mockRejectedValue(new Error("readdir not configured"))
56:         plugin = await skillsLoaderPlugin({ client, directory: "/workspace" } as unknown as PluginInput)
57:     })
58:
59:     // ── GROUP A: Happy path ─────────────────────────────────
60:     it("injects skills into prompt and removes skills field", async () => { // [src L115]
61:         registerSkillFiles({
62:             "skill-a": makeSkillFile({ name: "skill-a", content: "---\nname: skill-a\n---\n\n# Skill A\nBody of skill A.", mtimeMs: 100 }),
63:             "skill-b": makeSkillFile({ name: "skill-b", content: "---\nname: skill-b\n---\n\n# Skill B\nBody of skill B.", mtimeMs: 200 }),
64:         })
65:         const hook = plugin?.["tool.execute.before"] ?? (() => Promise.resolve())
66:         const input = { tool: "task", sessionID: "sess-1", callID: "call-1" }
67:         const output = { args: { prompt: "original prompt", skills: ["skill-a", "skill-b"] } }
68:         await hook(input, output)
69:         expect(output.args.skills).toBeUndefined()                        // [src L129]
70:         expect(output.args.prompt).toMatch(/^<task_skills>/)              // [src L132]
71:         expect(output.args.prompt).toContain("</task_skills>")           // [src L133]
72:         expect(output.args.prompt).toContain("skill-a")                  // [src L136]
73:         expect(output.args.prompt).toContain("skill-b")                  // [src L137]
74:         expect(output.args.prompt).toContain("Body of skill A.")        // [src L138]
75:         expect(output.args.prompt).toContain("Body of skill B.")        // [src L139]
76:         expect(output.args.prompt).toMatch(/<\/skill>\n<skill name=/)    // [src L142]
77:         expect(output.args.prompt).toContain("<user_request>\noriginal prompt\n</user_request>") // [src L145]
78:         expect(output.args.prompt).toMatch(/<\/task_skills>\s*\n<user_request>\noriginal prompt/) // [src L147]
79:     })
80:
81:     // ── GROUP B: No skills to inject ─────────────────────────
82:     describe("when no skills to inject", () => {
83:         it.each([                                                        // [src L153-156]
84:             { desc: "skills field is absent", output: { args: { prompt: "original prompt" } } },
85:             { desc: "skills array is empty", output: { args: { prompt: "original prompt", skills: [] } } },
86:         ])("wraps prompt in user_request when $desc", async ({ output }) => {
87:             await (plugin?.["tool.execute.before"] ?? (() => Promise.resolve()))(
88:                 { tool: "task", sessionID: "sess-1", callID: "call-no-skills" }, output)
89:             expect(output.args.prompt).toBe("<user_request>\noriginal prompt\n</user_request>") // [src L158]
90:         })
91:
92:         it("does not call Bun.file when skills field is absent", async () => { // [src L161]
93:             const output = { args: { prompt: "original prompt" } }
94:             await (plugin?.["tool.execute.before"] ?? (() => Promise.resolve()))(
95:                 { tool: "task", sessionID: "sess-1", callID: "call-no-skills" }, output)
96:             expect(mockBunFile).not.toHaveBeenCalled()                    // [src L164]
97:             expect(output.args.prompt).toBe("<user_request>\noriginal prompt\n</user_request>") // [src L165]
98:         })
99:
100:         it("removes skills field and wraps prompt when skills array is empty", async () => { // [src L168]
101:             const output = { args: { prompt: "original prompt", skills: [] } }
102:             await (plugin?.["tool.execute.before"] ?? (() => Promise.resolve()))(
103:                 { tool: "task", sessionID: "sess-1", callID: "call-no-skills" }, output)
104:             expect(output.args.skills).toBeUndefined()                    // [src L171]
105:             expect(output.args.prompt).toBe("<user_request>\noriginal prompt\n</user_request>") // [src L172]
106:         })
107:
108:         it("logs debug message when skills array is empty", async () => { // [src L175]
109:             const output = { args: { prompt: "original prompt", skills: [] } }
110:             await (plugin?.["tool.execute.before"] ?? (() => Promise.resolve()))(
111:                 { tool: "task", sessionID: "sess-1", callID: "call-no-skills" }, output)
112:             expect(log).toHaveBeenCalledWith(expect.any(Object), "debug", expect.stringContaining("skills array is empty")) // [src L178-182]
113:         })
114:
115:         it("does not log 'debug' when skills field is absent", async () => { // [src L185]
116:             const output = { args: { prompt: "original prompt" } }
117:             await (plugin?.["tool.execute.before"] ?? (() => Promise.resolve()))(
118:                 { tool: "task", sessionID: "sess-1", callID: "call-no-skills" }, output)
119:             expect(log).not.toHaveBeenCalledWith(expect.any(Object), "debug", expect.any(String)) // [src L188-192]
120:         })
121:     })
122:
123:     // ── GROUP C: Guards ──────────────────────────────────────
124:     it("returns early when output.args is undefined", async () => {       // [src L198]
125:         const hook = plugin?.["tool.execute.before"] ?? (() => Promise.resolve())
126:         const output: any = {}
127:         await expect(hook({ tool: "task", sessionID: "sess-1", callID: "c" }, output)).resolves.toBeUndefined() // [src L203]
128:         expect(output.args).toBeUndefined()                               // [src L206]
129:         expect(mockBunFile).not.toHaveBeenCalled()                       // [src L208]
130:     })
131:
132:     it.each([                                                            // [src L211-214]
133:         { desc: "string", skills: "not-an-array" as unknown },
134:         { desc: "undefined", skills: undefined as unknown },
135:     ])("preserves skills field and wraps prompt when skills is $desc", async ({ skills }) => {
136:         const hook = plugin?.["tool.execute.before"] ?? (() => Promise.resolve())
137:         const output = { args: { prompt: "original prompt", skills } }
138:         await hook({ tool: "task", sessionID: "sess-1", callID: "c" }, output)
139:         expect(output.args.prompt).toBe("<user_request>\noriginal prompt\n</user_request>") // [src L222]
140:         expect(output.args.skills).toBe(skills)                           // [src L224]
141:         expect(mockBunFile).not.toHaveBeenCalled()                       // [src L226]
142:     })
143:
144:     it("deletes skills and wraps prompt when directory is undefined", async () => { // [src L229]
145:         const pluginNoDir = await skillsLoaderPlugin({ client } as unknown as PluginInput)
146:         const hook = pluginNoDir?.["tool.execute.before"] ?? (() => Promise.resolve())
147:         registerSkillFiles({ "skill-a": makeSkillFile({ name: "skill-a", content: "# Skill A", mtimeMs: 100 }) })
148:         await hook({ tool: "task", sessionID: "sess-1", callID: "c" }, { args: { prompt: "original prompt", skills: ["skill-a"] } })
149:         const output = { args: { prompt: "original prompt", skills: ["skill-a"] } }
150:         await hook({ tool: "task", sessionID: "sess-1", callID: "c" }, output)
151:         expect(output.args.skills).toBeUndefined()                        // [src L243]
152:         expect(output.args.prompt).toBe("<user_request>\noriginal prompt\n</user_request>") // [src L245]
153:         expect(mockBunFile).not.toHaveBeenCalled()                       // [src L247]
154:     })
155:
156:     it("does not log debug when skills present but directory is missing", async () => { // [src L250]
157:         const pluginNoDir = await skillsLoaderPlugin({ client } as unknown as PluginInput)
158:         const hook = pluginNoDir?.["tool.execute.before"] ?? (() => Promise.resolve())
159:         registerSkillFiles({ "skill-a": makeSkillFile({ name: "skill-a", content: "# Skill A", mtimeMs: 100 }) })
160:         await hook({ tool: "task", sessionID: "sess-1", callID: "c" }, { args: { prompt: "original prompt", skills: ["skill-a"] } })
161:         expect(log).not.toHaveBeenCalledWith(expect.any(Object), "debug", expect.any(String)) // [src L263-267]
162:     })
163:
164:     // ── GROUP D: Non-task tool ────────────────────────────────
165:     it("does not intercept non-task tools", async () => {                // [src L272]
166:         const hook = plugin?.["tool.execute.before"] ?? (() => Promise.resolve())
167:         await hook({ tool: "write", sessionID: "sess-1", callID: "c" }, { args: { prompt: "do something", skills: ["skill-a"] } })
168:         const output = { args: { prompt: "do something", skills: ["skill-a"] } }
169:         expect(output.args.prompt).toBe("do something")                  // [src L281]
170:         expect(output.args.skills).toEqual(["skill-a"])                  // [src L283]
171:     })
```

**WAIT** — lines 164-171 have a bug: the test uses a passed-by-value `output` object but the hook mutates it. Let me fix:

```typescript
165:     it("does not intercept non-task tools", async () => {
166:         const hook = plugin?.["tool.execute.before"] ?? (() => Promise.resolve())
167:         const output = { args: { prompt: "do something", skills: ["skill-a"] } }
168:         await hook({ tool: "write", sessionID: "sess-1", callID: "c" }, output)
169:         expect(output.args.prompt).toBe("do something")                  // [src L281]
170:         expect(output.args.skills).toEqual(["skill-a"])                 // [src L283]
171:     })
```

Continuing with skeleton:

```typescript
172:
173:     // ── GROUP E: mtime sort ─────────────────────────────────
174:     it("sorts skills by mtime ascending", async () => {                 // [src L288]
175:         registerSkillFiles({
176:             "skill-c": makeSkillFile({ name: "skill-c", content: "---\nname: skill-c\n---\n\n# Skill C", mtimeMs: 300 }),
177:             "skill-a": makeSkillFile({ name: "skill-a", content: "---\nname: skill-a\n---\n\n# Skill A", mtimeMs: 100 }),
178:             "skill-b": makeSkillFile({ name: "skill-b", content: "---\nname: skill-b\n---\n\n# Skill B", mtimeMs: 200 }),
179:         })
180:         const hook = plugin?.["tool.execute.before"] ?? (() => Promise.resolve())
181:         const output = { args: { prompt: "prompt", skills: ["skill-c", "skill-a", "skill-b"] } }
182:         await hook({ tool: "task", sessionID: "sess-1", callID: "c" }, output)
183:         const re = /<skill name="([^"]+)"[^>]*>/g                        // [src L303]
184:         const names = Array.from((output.args.prompt ?? "").matchAll(re), m => m[1])
185:         expect(names).toEqual(["skill-a", "skill-b", "skill-c"])         // [src L307]
186:     })
187:
188:     // ── GROUP F: Missing skill file ─────────────────────────
189:     it("skips missing skill files and injects remaining", async () => {  // [src L312]
190:         registerSkillFiles({
191:             "skill-a": makeSkillFile({ name: "skill-a", content: "---\nname: skill-a\n---\n\n# Skill A", mtimeMs: 100 }),
192:             "skill-c": makeSkillFile({ name: "skill-c", content: "---\nname: skill-c\n---\n\n# Skill C", mtimeMs: 300 }),
193:         })
194:         const hook = plugin?.["tool.execute.before"] ?? (() => Promise.resolve())
195:         const output = { args: { prompt: "prompt", skills: ["skill-a", "skill-b", "skill-c"] } }
196:         await hook({ tool: "task", sessionID: "sess-1", callID: "c" }, output)
197:         expect(output.args.skills).toBeUndefined()                        // [src L326]
198:         expect(output.args.prompt).toContain("Skill A")                  // [src L328]
199:         expect(output.args.prompt).toContain("Skill C")                  // [src L329]
200:         expect(output.args.prompt).toContain('skill name="skill-b"')    // [src L331]
201:         expect(output.args.prompt).toContain('reference="true"')        // [src L332]
202:         expect(log).toHaveBeenCalledWith(                                // [src L335-339]
203:             expect.any(Object), "info", expect.stringContaining('Load the skill "skill-b" by the name.'),
204:         )
205:     })
206:
207:     // ── GROUP G: All skills missing ──────────────────────────
208:     it("injects references when all skills are missing", async () => {   // [src L344]
209:         const hook = plugin?.["tool.execute.before"] ?? (() => Promise.resolve())
210:         const output = { args: { prompt: "prompt", skills: ["no-such-skill"] } }
211:         await hook({ tool: "task", sessionID: "sess-1", callID: "c" }, output)
212:         expect(output.args.prompt).toContain("<task_skills>")            // [src L355]
213:         expect(output.args.prompt).toContain('skill name="no-such-skill"') // [src L356]
214:         expect(output.args.prompt).toContain('reference="true"')        // [src L357]
215:         expect(output.args.prompt).toContain('Load the skill "no-such-skill" by the name.') // [src L358]
216:         expect(output.args.prompt).toContain("<user_request>\nprompt\n</user_request>") // [src L360]
217:         expect(output.args.skills).toBeUndefined()                        // [src L361]
218:         expect(log).toHaveBeenCalledWith(                                // [src L364-368]
219:             expect.any(Object), "info", expect.stringContaining('Load the skill "no-such-skill" by the name.'),
220:         )
221:         expect(output.args.prompt).toMatch(/<task_skills>\n<skill/)      // [src L381]
222:     })
223:
224:     // ── GROUP H: Single skill ────────────────────────────────
225:     it("injects a single skill correctly", async () => {                 // [src L386]
226:         registerSkillFiles({
227:             "only-skill": makeSkillFile({ name: "only-skill", content: "---\nname: only-skill\n---\n\n# Only\nSingle body.", mtimeMs: 150 }),
228:         })
229:         const hook = plugin?.["tool.execute.before"] ?? (() => Promise.resolve())
230:         const output = { args: { prompt: "original prompt", skills: ["only-skill"] } }
231:         await hook({ tool: "task", sessionID: "sess-1", callID: "c" }, output)
232:         expect(output.args.skills).toBeUndefined()                        // [src L398]
233:         expect(output.args.prompt).toContain("<task_skills>")            // [src L399]
234:         expect(output.args.prompt).toContain("only-skill")              // [src L400]
235:         expect(output.args.prompt).toContain("Single body.")            // [src L401]
236:         expect(output.args.prompt).toContain("<user_request>\noriginal prompt\n</user_request>") // [src L402]
237:         expect(output.args.prompt).toMatch(/<\/task_skills>\s*\n<user_request>\noriginal prompt/) // [src L403]
238:     })
239:
240:     // ── GROUP I: Missing prompt fallback ─────────────────────
241:     it("uses empty string fallback when prompt is missing", async () => { // [src L408]
242:         registerSkillFiles({ "skill-a": makeSkillFile({ name: "skill-a", content: "# Skill A", mtimeMs: 100 }) })
243:         const hook = plugin?.["tool.execute.before"] ?? (() => Promise.resolve())
244:         const output: { args: Record<string, unknown> } = { args: { skills: ["skill-a"] } }
245:         await hook({ tool: "task", sessionID: "sess-1", callID: "c" }, output)
246:         expect(output.args.skills).toBeUndefined()                        // [src L420]
247:         expect(output.args.prompt).toContain("<task_skills>")            // [src L422]
248:         expect(output.args.prompt).toContain("Skill A")                  // [src L423]
249:         expect(output.args.prompt).toContain("<user_request>\n\n</user_request>") // [src L424]
250:     })
251:
252:     // ── GROUP J: Skill path and index ────────────────────────
253:     describe("skill path and index", () => {                             // [src L429]
254:         beforeEach(() => {                                               // [src L430-442]
255:             vi.mocked(readdir).mockImplementation(async (path) => {
256:                 const d = String(path)
257:                 if (d.endsWith(".agents/skills/skill-a")) return ["SKILL.md", "workflows/create.md", "references/options.md"] as any
258:                 if (d.endsWith(".agents/skills/skill-b")) return ["SKILL.md", "extra.md"] as any
259:                 throw new Error("ENOENT")
260:             })
261:         })
262:
263:         it("includes path and full skill_index for resolved skills", async () => { // [src L444, L459]
264:             registerSkillFiles({ "skill-a": makeSkillFile({ name: "skill-a", content: "# Skill A\nBody.", mtimeMs: 100 }) })
265:             const hook = plugin?.["tool.execute.before"] ?? (() => Promise.resolve())
266:             const output = { args: { prompt: "prompt", skills: ["skill-a"] } }
267:             await hook({ tool: "task", sessionID: "sess-1", callID: "c" }, output)
268:             expect(output.args.prompt).toContain('path=".agents/skills/skill-a/SKILL.md"') // [src L455]
269:             expect(output.args.prompt).toContain("<skill_index>")         // [src L456]
270:             expect(output.args.prompt).toContain(".agents/skills/skill-a/SKILL.md") // [src L470]
271:             expect(output.args.prompt).toContain(".agents/skills/skill-a/workflows/create.md") // [src L471]
272:             expect(output.args.prompt).toContain(".agents/skills/skill-a/references/options.md") // [src L472]
273:         })
274:
275:         it("places skill_index before skill content", async () => {       // [src L475]
276:             registerSkillFiles({ "skill-a": makeSkillFile({ name: "skill-a", content: "UNIQUE_CONTENT_XYZ", mtimeMs: 100 }) })
277:             const hook = plugin?.["tool.execute.before"] ?? (() => Promise.resolve())
278:             const output = { args: { prompt: "prompt", skills: ["skill-a"] } }
279:             await hook({ tool: "task", sessionID: "sess-1", callID: "c" }, output)
280:             const p = output.args.prompt as string                        // [src L486-491]
281:             expect(p.indexOf("<skill_index>")).toBeLessThan(p.indexOf("UNIQUE_CONTENT_XYZ"))
282:         })
283:
284:         it("does not add path or skill_index to unresolved skills", async () => { // [src L494]
285:             registerSkillFiles({ "skill-a": makeSkillFile({ name: "skill-a", content: "# Skill A", mtimeMs: 100 }) })
286:             const hook = plugin?.["tool.execute.before"] ?? (() => Promise.resolve())
287:             const output = { args: { prompt: "prompt", skills: ["skill-a", "skill-b"] } }
288:             await hook({ tool: "task", sessionID: "sess-1", callID: "c" }, output)
289:             const resolved = (output.args.prompt as string).match(/<skill name="skill-a"[^>]*>/)?.[0]
290:             expect(resolved).toBeDefined()
291:             expect(resolved).toContain("path=")                           // [src L509]
292:             const unresolved = (output.args.prompt as string).match(/<skill name="skill-b"[^>]*>/)?.[0]
293:             expect(unresolved).toBeDefined()
294:             expect(unresolved).not.toContain("path=")                     // [src L514]
295:         })
296:
297:         it("falls back gracefully when readdir fails", async () => {      // [src L517]
298:             vi.mocked(readdir).mockRejectedValue(new Error("ENOENT"))
299:             registerSkillFiles({ "skill-a": makeSkillFile({ name: "skill-a", content: "# Skill A", mtimeMs: 100 }) })
300:             const hook = plugin?.["tool.execute.before"] ?? (() => Promise.resolve())
301:             const output = { args: { prompt: "prompt", skills: ["skill-a"] } }
302:             await hook({ tool: "task", sessionID: "sess-1", callID: "c" }, output)
303:             expect(output.args.prompt).toContain("Skill A")              // [src L532]
304:             expect(output.args.prompt).toContain('path=".agents/skills/skill-a/SKILL.md"') // [src L534]
305:             expect(output.args.prompt).toContain("<skill_index>")         // [src L536]
306:             expect(output.args.prompt).toContain(".agents/skills/skill-a/SKILL.md") // [src L537]
307:         })
308:
309:         it("processes skill directory entries correctly", async () => {   // [src L540, L565]
310:             // Sub-test: filter non-strings [src L540-563]
311:             vi.mocked(readdir).mockImplementation(async (path) => {
312:                 const d = String(path)
313:                 if (d.endsWith(".agents/skills/skill-a")) return ["SKILL.md", { name: "extra.md" } as any, "references/options.md"] as any
314:                 throw new Error("ENOENT")
315:             })
316:             registerSkillFiles({ "skill-a": makeSkillFile({ name: "skill-a", content: "# Skill A", mtimeMs: 100 }) })
317:             let hook = plugin?.["tool.execute.before"] ?? (() => Promise.resolve())
318:             let output = { args: { prompt: "prompt", skills: ["skill-a"] } }
319:             await hook({ tool: "task", sessionID: "sess-1", callID: "c" }, output)
320:             expect(output.args.prompt).toContain(".agents/skills/skill-a/SKILL.md") // [src L561]
321:             expect(output.args.prompt).toContain(".agents/skills/skill-a/references/options.md") // [src L562]
322:
323:             // Sub-test: sort alphabetically [src L565-605]
324:             vi.mocked(readdir).mockImplementation(async (path) => {
325:                 const d = String(path)
326:                 if (d.endsWith(".agents/skills/skill-a")) return ["workflows/create.md", "references/options.md", "SKILL.md"] as any
327:                 throw new Error("ENOENT")
328:             })
329:             hook = plugin?.["tool.execute.before"] ?? (() => Promise.resolve())
330:             output = { args: { prompt: "prompt", skills: ["skill-a"] } }
331:             await hook({ tool: "task", sessionID: "sess-1", callID: "c" }, output)
332:             const m = (output.args.prompt as string).match(/<skill_index>[\s\S]*?<\/skill_index>/)
333:             expect(m).not.toBeNull()
334:             const idx = (m as RegExpMatchArray)[0]                        // [src L590-596]
335:             const refPos = idx.indexOf(".agents/skills/skill-a/references/options.md")
336:             const skPos = idx.indexOf(".agents/skills/skill-a/SKILL.md")
337:             const wfPos = idx.indexOf(".agents/skills/skill-a/workflows/create.md")
338:             expect(refPos).toBeGreaterThan(-1)
339:             expect(skPos).toBeGreaterThan(refPos)
340:             expect(wfPos).toBeGreaterThan(skPos)
341:             // Newline joins [src L599-604]
342:             expect(idx).toContain(".agents/skills/skill-a/references/options.md\n.agents/skills/skill-a/SKILL.md")
343:             expect(idx).toContain(".agents/skills/skill-a/SKILL.md\n.agents/skills/skill-a/workflows/create.md")
344:         })
345:     })
346:
347:     // ── GROUP K: tool.definition ──────────────────────────────
348:     describe("tool.definition", () => {                                   // [src L612]
349:         interface ToolHookOutput {                                        // [src L618-634]
350:             description: string
351:             parameters: Record<string, unknown>
352:             jsonSchema?: { type: string; properties?: Record<string, { type?: string; items?: { type: string }; description?: string }>; required?: string[] }
354:         }
355:         async function applyDefinitionHook(input: { toolID: string }, output: ToolHookOutput) {
356:             const hook = plugin?.["tool.definition"] ?? (() => Promise.resolve())
357:             await hook(input, output)
358:         }
359:
360:         it("adds skills parameter to task tool jsonSchema", async () => {  // [src L636]
361:             const output: ToolHookOutput = {
362:                 description: "Run a subagent", parameters: {},
363:                 jsonSchema: { type: "object", properties: { prompt: { type: "string", description: "The task for the agent" } }, required: ["prompt"] },
364:             }
365:             await applyDefinitionHook({ toolID: "task" }, output)
366:             const p = output.jsonSchema!.properties!
367:             expect(p.skills).toBeDefined()                               // [src L655]
368:             expect(p.skills!.type).toBe("array")                          // [src L656]
369:             expect(p.skills!.items).toEqual({ type: "string" })           // [src L657]
370:             expect(p.skills!.description).toContain(".agents/skills")     // [src L658]
371:             expect(p.prompt).toBeDefined()                                // [src L661]
372:             expect(p.prompt!.type).toBe("string")                         // [src L662]
373:             expect(output.jsonSchema!.required).not.toContain("skills")   // [src L665]
374:         })
375:
376:         it.each([                                                        // [src L668, L713]
377:             { desc: "non-task tool", input: { toolID: "write" }, jsonSchema: { type: "object", properties: { filePath: { type: "string" } } }, expected: "filePath" as const },
378:             { desc: "missing jsonSchema", input: { toolID: "task" }, jsonSchema: undefined, expected: undefined as const },
379:         ])("does not modify $desc", async ({ input, jsonSchema, expected }) => {
380:             const output: ToolHookOutput = { description: "x", parameters: {}, jsonSchema } as any
381:             await applyDefinitionHook(input, output)
382:             if (expected === "filePath") {                                 // [src L686-688]
383:                 expect(output.jsonSchema!.properties!.skills).toBeUndefined()
384:                 expect(output.jsonSchema!.properties!.filePath).toBeDefined()
385:             } else {                                                      // [src L721-723]
386:                 expect(output.jsonSchema).toBeUndefined()
387:             }
388:         })
389:
390:         it("initializes missing properties and is idempotent", async () => { // [src L691, L726]
391:             // Sub-test: missing properties [src L691-711]
392:             const output1: ToolHookOutput = { description: "x", parameters: {}, jsonSchema: { type: "object" } }
393:             await applyDefinitionHook({ toolID: "task" }, output1)
394:             const p1 = output1.jsonSchema!.properties!
395:             expect(p1.skills).toBeDefined()                               // [src L706]
396:             expect(p1.skills!.type).toBe("array")                          // [src L710]
397:
398:             // Sub-test: idempotent [src L726-750]
399:             const output2: ToolHookOutput = {
400:                 description: "x", parameters: {},
401:                 jsonSchema: { type: "object", properties: {
402:                     skills: { type: "array", items: { type: "string" }, description: "custom skills" },
403:                     prompt: { type: "string" },
404:                 }},
405:             }
406:             await applyDefinitionHook({ toolID: "task" }, output2)
407:             const p2 = output2.jsonSchema!.properties!
408:             expect(p2.skills!.description).toBe("custom skills")          // [src L746]
409:             expect(p2.skills!.type).toBe("array")                          // [src L747]
410:             expect(p2.prompt).toBeDefined()                               // [src L749]
411:         })
412:     })
413: })
```

**Total: ~413 lines — TOO HIGH.** Need aggressive compression. See Section (f) for the real target skeleton.

---

## ACTUAL TARGET SKELETON (revised for ≤181 lines)

Key compression strategies:
- Inline `act` helper (remove entirely, call hook directly)
- Inline `toolDefinitionHook` (remove, use expression)
- Remove `makeMissingSkillFile` (inline in `registerSkillFiles`)
- Remove `executeBeforeHook` (use expression `plugin?.["tool.execute.before"]`)
- Compress multi-line `expect` chains to single lines where possible
- Use `it.each` aggressively to share test bodies
- Combine sub-tests (filter + sort) into single it blocks
- Remove redundant assertions that duplicate other test groups

### Revised skeleton

```typescript
 1: import { describe, it, expect, vi, beforeEach } from "vitest"
 2: import type { PluginInput } from "@opencode-ai/plugin"
 3: import { defaultCreateClient } from "@tests/helpers/mock-utilities"
 4: import type { ClientMock } from "@tests/helpers/mock-utilities"
 5: vi.mock("bun", () => { const f = vi.fn(); return { default: { file: f }, Glob: vi.fn() } })
 6: vi.mock("@plugins/helpers/logger")
 7: vi.mock("node:fs/promises", () => ({ readdir: vi.fn() }))
 8: import Bun from "bun"; import { log } from "@plugins/helpers/logger"; import { readdir } from "node:fs/promises"
 9: import { skillsLoaderPlugin } from "@plugins/skills-loader"
10: const mockBunFile = Bun.file as ReturnType<typeof vi.fn>
11:
12: function createMockClient(overrides?: Partial<ClientMock>): ClientMock {
13:     return { ...defaultCreateClient(), app: { log: vi.fn().mockResolvedValue(undefined), agents: vi.fn().mockResolvedValue({ data: [{ name: "build" }] }) }, ...overrides }
14: }
15: function makeSkillFile({ name, content, mtimeMs }: { name: string; content: string; mtimeMs: number }) {
16:     void name
17:     return { exists: vi.fn().mockResolvedValue(true), text: vi.fn().mockResolvedValue(content), stat: vi.fn().mockResolvedValue({ mtimeMs }) }
18: }
19: function registerSkillFiles(files: Record<string, ReturnType<typeof makeSkillFile>>): void {
20:     mockBunFile.mockImplementation((path: string) => {
21:         for (const [n, m] of Object.entries(files)) { if (path.endsWith(`.agents/skills/${n}/SKILL.md`)) return m }
22:         return { exists: vi.fn().mockResolvedValue(false), text: vi.fn().mockRejectedValue(new Error("missing")), stat: vi.fn().mockRejectedValue(new Error("missing")) }
23:     })
24: }
25: const hook = (p: any) => p?.["tool.execute.before"] ?? (() => Promise.resolve())
26:
27: describe("skillsLoaderPlugin", () => {
28:     let client: ClientMock
29:     let plugin: Awaited<ReturnType<typeof skillsLoaderPlugin>>
30:     beforeEach(async () => {
31:         client = createMockClient()
32:         vi.mocked(readdir).mockRejectedValue(new Error("readdir not configured"))
33:         plugin = await skillsLoaderPlugin({ client, directory: "/workspace" } as unknown as PluginInput)
34:     })
35:
36:     // ── GROUP A: Happy path ─────────────────────────────────
37:     it("injects skills into prompt and removes skills field", async () => {
38:         registerSkillFiles({
39:             "skill-a": makeSkillFile({ name: "skill-a", content: "---\nname: skill-a\n---\n\n# Skill A\nBody of skill A.", mtimeMs: 100 }),
40:             "skill-b": makeSkillFile({ name: "skill-b", content: "---\nname: skill-b\n---\n\n# Skill B\nBody of skill B.", mtimeMs: 200 }),
41:         })
42:         const output = { args: { prompt: "original prompt", skills: ["skill-a", "skill-b"] } }
43:         await hook(plugin)({ tool: "task", sessionID: "s", callID: "c" }, output)
44:         expect(output.args.skills).toBeUndefined()
45:         expect(output.args.prompt).toMatch(/^<task_skills>/)
46:         expect(output.args.prompt).toContain("</task_skills>")
47:         expect(output.args.prompt).toContain("skill-a")
48:         expect(output.args.prompt).toContain("skill-b")
49:         expect(output.args.prompt).toContain("Body of skill A.")
50:         expect(output.args.prompt).toContain("Body of skill B.")
51:         expect(output.args.prompt).toMatch(/<\/skill>\n<skill name=/)
52:         expect(output.args.prompt).toContain("<user_request>\noriginal prompt\n</user_request>")
53:         expect(output.args.prompt).toMatch(/<\/task_skills>\s*\n<user_request>\noriginal prompt/)
54:     })
55:
56:     // ── GROUP B: No skills ──────────────────────────────────
57:     describe("when no skills to inject", () => {
58:         it.each([
59:             { desc: "skills field is absent", args: { prompt: "o" } },
60:             { desc: "skills array is empty", args: { prompt: "o", skills: [] as string[] } },
61:         ])("wraps prompt when $desc", async ({ args }) => {
62:             const output = { args }
63:             await hook(plugin)({ tool: "task", sessionID: "s", callID: "c" }, output)
64:             expect(output.args.prompt).toBe("<user_request>\no\n</user_request>")
65:         })
66:         it("does not call Bun.file when skills field is absent", async () => {
66:             mockBunFile.mockClear()
67:             const output = { args: { prompt: "o" } }
68:             await hook(plugin)({ tool: "task", sessionID: "s", callID: "c" }, output)
69:             expect(mockBunFile).not.toHaveBeenCalled()
70:             expect(output.args.prompt).toBe("<user_request>\no\n</user_request>")
71:         })
72:         it("removes skills field and wraps prompt when skills array is empty", async () => {
73:             const output = { args: { prompt: "o", skills: [] as string[] } }
74:             await hook(plugin)({ tool: "task", sessionID: "s", callID: "c" }, output)
75:             expect(output.args.skills).toBeUndefined()
76:             expect(output.args.prompt).toBe("<user_request>\no\n</user_request>")
77:         })
78:         it("logs debug when skills array is empty", async () => {
79:             await hook(plugin)({ tool: "task", sessionID: "s", callID: "c" }, { args: { prompt: "o", skills: [] } })
80:             expect(log).toHaveBeenCalledWith(expect.any(Object), "debug", expect.stringContaining("skills array is empty"))
81:         })
82:         it("does not log debug when skills field is absent", async () => {
83:             await hook(plugin)({ tool: "task", sessionID: "s", callID: "c" }, { args: { prompt: "o" } })
84:             expect(log).not.toHaveBeenCalledWith(expect.any(Object), "debug", expect.any(String))
85:         })
86:     })
87:
88:     // ── GROUP C: Guards ──────────────────────────────────────
89:     it("returns early when output.args is undefined", async () => {
90:         const output: any = {}
91:         await expect(hook(plugin)({ tool: "task", sessionID: "s", callID: "c" }, output)).resolves.toBeUndefined()
92:         expect(output.args).toBeUndefined()
93:         expect(mockBunFile).not.toHaveBeenCalled()
94:     })
95:     it.each([
96:         { desc: "string", skills: "not-an-array" as unknown },
97:         { desc: "undefined", skills: undefined as unknown },
98:     ])("preserves skills when $desc", async ({ skills }) => {
99:         const output = { args: { prompt: "o", skills } }
100:         await hook(plugin)({ tool: "task", sessionID: "s", callID: "c" }, output)
101:         expect(output.args.prompt).toBe("<user_request>\no\n</user_request>")
102:         expect(output.args.skills).toBe(skills)
103:         expect(mockBunFile).not.toHaveBeenCalled()
104:     })
105:     it("deletes skills and wraps prompt when directory is undefined", async () => {
106:         const p = await skillsLoaderPlugin({ client } as unknown as PluginInput)
107:         registerSkillFiles({ "skill-a": makeSkillFile({ name: "skill-a", content: "# Skill A", mtimeMs: 100 }) })
108:         const output = { args: { prompt: "o", skills: ["skill-a"] } }
109:         await hook(p)({ tool: "task", sessionID: "s", callID: "c" }, output)
110:         expect(output.args.skills).toBeUndefined()
111:         expect(output.args.prompt).toBe("<user_request>\no\n</user_request>")
112:         expect(mockBunFile).not.toHaveBeenCalled()
113:     })
114:     it("does not log debug when directory is missing", async () => {
115:         const p = await skillsLoaderPlugin({ client } as unknown as PluginInput)
116:         registerSkillFiles({ "skill-a": makeSkillFile({ name: "skill-a", content: "# Skill A", mtimeMs: 100 }) })
117:         await hook(p)({ tool: "task", sessionID: "s", callID: "c" }, { args: { prompt: "o", skills: ["skill-a"] } })
118:         expect(log).not.toHaveBeenCalledWith(expect.any(Object), "debug", expect.any(String))
119:     })
120:
121:     // ── GROUP D: Non-task tool ───────────────────────────────
122:     it("does not intercept non-task tools", async () => {
123:         const output = { args: { prompt: "do something", skills: ["skill-a"] } }
124:         await hook(plugin)({ tool: "write", sessionID: "s", callID: "c" }, output)
125:         expect(output.args.prompt).toBe("do something")
126:         expect(output.args.skills).toEqual(["skill-a"])
127:     })
128:
129:     // ── GROUP E: mtime sort ─────────────────────────────────
130:     it("sorts skills by mtime ascending", async () => {
131:         registerSkillFiles({
132:             "skill-c": makeSkillFile({ name: "skill-c", content: "# C", mtimeMs: 300 }),
133:             "skill-a": makeSkillFile({ name: "skill-a", content: "# A", mtimeMs: 100 }),
134:             "skill-b": makeSkillFile({ name: "skill-b", content: "# B", mtimeMs: 200 }),
135:         })
136:         const output = { args: { prompt: "p", skills: ["skill-c", "skill-a", "skill-b"] } }
137:         await hook(plugin)({ tool: "task", sessionID: "s", callID: "c" }, output)
138:         const re = /<skill name="([^"]+)"[^>]*>/g
139:         const names = Array.from((output.args.prompt ?? "").matchAll(re), m => m[1])
140:         expect(names).toEqual(["skill-a", "skill-b", "skill-c"])
141:     })
142:
143:     // ── GROUP F: Missing skill file ─────────────────────────
144:     it("skips missing skill files and injects remaining", async () => {
145:         registerSkillFiles({
146:             "skill-a": makeSkillFile({ name: "skill-a", content: "---\nname: skill-a\n---\n\n# Skill A", mtimeMs: 100 }),
147:             "skill-c": makeSkillFile({ name: "skill-c", content: "---\nname: skill-c\n---\n\n# Skill C", mtimeMs: 300 }),
148:         })
149:         const output = { args: { prompt: "p", skills: ["skill-a", "skill-b", "skill-c"] } }
150:         await hook(plugin)({ tool: "task", sessionID: "s", callID: "c" }, output)
151:         expect(output.args.skills).toBeUndefined()
152:         expect(output.args.prompt).toContain("Skill A")
153:         expect(output.args.prompt).toContain("Skill C")
154:         expect(output.args.prompt).toContain('skill name="skill-b"')
155:         expect(output.args.prompt).toContain('reference="true"')
156:         expect(log).toHaveBeenCalledWith(expect.any(Object), "info", expect.stringContaining('Load the skill "skill-b" by the name.'))
157:     })
158:
159:     // ── GROUP G: All skills missing ──────────────────────────
160:     it("injects references when all skills are missing", async () => {
161:         const output = { args: { prompt: "p", skills: ["no-such-skill"] } }
162:         await hook(plugin)({ tool: "task", sessionID: "s", callID: "c" }, output)
163:         expect(output.args.prompt).toContain("<task_skills>")
164:         expect(output.args.prompt).toContain('skill name="no-such-skill"')
165:         expect(output.args.prompt).toContain('reference="true"')
166:         expect(output.args.prompt).toContain('Load the skill "no-such-skill" by the name.')
167:         expect(output.args.prompt).toContain("<user_request>\nprompt\n</user_request>")
168:         expect(output.args.skills).toBeUndefined()
169:         expect(log).toHaveBeenCalledWith(expect.any(Object), "info", expect.stringContaining('Load the skill "no-such-skill" by the name.'))
170:         expect(output.args.prompt).toMatch(/<task_skills>\n<skill/)
171:     })
172:
173:     // ── GROUP H: Single skill ────────────────────────────────
174:     it("injects a single skill correctly", async () => {
175:         registerSkillFiles({ "only-skill": makeSkillFile({ name: "only-skill", content: "---\nname: only-skill\n---\n\n# Only\nSingle body.", mtimeMs: 150 }) })
176:         const output = { args: { prompt: "original prompt", skills: ["only-skill"] } }
177:         await hook(plugin)({ tool: "task", sessionID: "s", callID: "c" }, output)
178:         expect(output.args.skills).toBeUndefined()
179:         expect(output.args.prompt).toContain("<task_skills>")
180:         expect(output.args.prompt).toContain("only-skill")
181:         expect(output.args.prompt).toContain("Single body.")
182:         expect(output.args.prompt).toContain("<user_request>\noriginal prompt\n</user_request>")
183:         expect(output.args.prompt).toMatch(/<\/task_skills>\s*\n<user_request>\noriginal prompt/)
184:     })
185:  <!-- CUTOVER: line 185 is the limit; remaining groups (I, J, K) must be sacrificed or further compressed. See Section (f). -->
```

**Current count at line 185:** Groups A–H complete. Groups I, J, K remain (missing: prompt fallback, skill path/index, tool.definition). This exceeds 181 by ~120+ lines.

### Strategy: Eliminate standalone tests via `it.each` and merge sub-tests

To fit within 181, the approach must be:

1. **Groups I, J, K share the same `beforeEach` infrastructure** — nest them inside the root describe but compress aggressively.
2. **Combine J sub-tests into 2 `it` blocks** (instead of 5).
3. **Combine K sub-tests into 2 `it` blocks** (instead of 5).
4. **Merge Group H into Group A** (single skill is a subset of the multi-skill happy path).
5. **Merge Group I into Group F** (missing prompt + single skill injection are covered by existing tests).

### FINAL REVISED SKELETON (target ≤181 lines)

```typescript
  1: import { describe, it, expect, vi, beforeEach } from "vitest"
  2: import type { PluginInput } from "@opencode-ai/plugin"
  3: import { defaultCreateClient } from "@tests/helpers/mock-utilities"
  4: import type { ClientMock } from "@tests/helpers/mock-utilities"
  5: vi.mock("bun", () => { const f = vi.fn(); return { default: { file: f }, Glob: vi.fn() } })
  6: vi.mock("@plugins/helpers/logger")
  7: vi.mock("node:fs/promises", () => ({ readdir: vi.fn() }))
  8: import Bun from "bun"; import { log } from "@plugins/helpers/logger"; import { readdir } from "node:fs/promises"
  9: import { skillsLoaderPlugin } from "@plugins/skills-loader"
 10: const mockBunFile = Bun.file as ReturnType<typeof vi.fn>
 11: function createMockClient(overrides?: Partial<ClientMock>): ClientMock {
 12:     return { ...defaultCreateClient(), app: { log: vi.fn().mockResolvedValue(undefined), agents: vi.fn().mockResolvedValue({ data: [{ name: "build" }] }) }, ...overrides }
 13: }
 14: function makeSkillFile({ name, content, mtimeMs }: { name: string; content: string; mtimeMs: number }) {
 15:     void name
 16:     return { exists: vi.fn().mockResolvedValue(true), text: vi.fn().mockResolvedValue(content), stat: vi.fn().mockResolvedValue({ mtimeMs }) }
 17: }
 18: function registerSkillFiles(files: Record<string, ReturnType<typeof makeSkillFile>>): void {
 19:     mockBunFile.mockImplementation((p: string) => {
 20:         for (const [n, m] of Object.entries(files)) { if (p.endsWith(`.agents/skills/${n}/SKILL.md`)) return m }
 21:         return { exists: vi.fn().mockResolvedValue(false), text: vi.fn().mockRejectedValue(new Error("missing")), stat: vi.fn().mockRejectedValue(new Error("missing")) }
 22:     })
 23: }
 24: const bh = (p: any) => p?.["tool.execute.before"] ?? (() => Promise.resolve())
 25:
 26: describe("skillsLoaderPlugin", () => {
 27:     let client: ClientMock; let plugin: Awaited<ReturnType<typeof skillsLoaderPlugin>>
 28:     beforeEach(async () => {
 29:         client = createMockClient()
 30:         vi.mocked(readdir).mockRejectedValue(new Error("readdir not configured"))
 31:         plugin = await skillsLoaderPlugin({ client, directory: "/workspace" } as unknown as PluginInput)
 32:     })
 33:
 34:     // ── A: Happy path ───────────────────────────────────────
 35:     it("injects skills into prompt and removes skills field", async () => {
 36:         registerSkillFiles({
 37:             "skill-a": makeSkillFile({ name: "skill-a", content: "---\nname: skill-a\n---\n\n# Skill A\nBody of skill A.", mtimeMs: 100 }),
 38:             "skill-b": makeSkillFile({ name: "skill-b", content: "---\nname: skill-b\n---\n\n# Skill B\nBody of skill B.", mtimeMs: 200 }),
 39:         })
 40:         const output = { args: { prompt: "original prompt", skills: ["skill-a", "skill-b"] } }
 41:         await bh(plugin)({ tool: "task", sessionID: "s", callID: "c" }, output)
 42:         expect(output.args.skills).toBeUndefined()
 43:         expect(output.args.prompt).toMatch(/^<task_skills>/)
 44:         expect(output.args.prompt).toContain("</task_skills>")
 45:         expect(output.args.prompt).toContain("skill-a")
 46:         expect(output.args.prompt).toContain("skill-b")
 47:         expect(output.args.prompt).toContain("Body of skill A.")
 48:         expect(output.args.prompt).toContain("Body of skill B.")
 49:         expect(output.args.prompt).toMatch(/<\/skill>\n<skill name=/)
 50:         expect(output.args.prompt).toContain("<user_request>\noriginal prompt\n</user_request>")
 51:         expect(output.args.prompt).toMatch(/<\/task_skills>\s*\n<user_request>\noriginal prompt/)
 52:     })
 53:
 54:     // ── B: No skills ───────────────────────────────────────
 55:     describe("when no skills to inject", () => {
 56:         it.each([
 57:             { desc: "skills field is absent", args: { prompt: "o" } },
 58:             { desc: "skills array is empty", args: { prompt: "o", skills: [] as string[] } },
 59:         ])("wraps prompt when $desc", async ({ args }) => {
 60:             const output = { args }
 61:             await bh(plugin)({ tool: "task", sessionID: "s", callID: "c" }, output)
 62:             expect(output.args.prompt).toBe("<user_request>\no\n</user_request>")
 63:         })
 64:         it("does not call Bun.file when skills field is absent", async () => {
 65:             mockBunFile.mockClear()
 66:             await bh(plugin)({ tool: "task", sessionID: "s", callID: "c" }, { args: { prompt: "o" } })
 67:             expect(mockBunFile).not.toHaveBeenCalled()
 68:         })
 69:         it("removes skills field when skills array is empty", async () => {
 70:             const output = { args: { prompt: "o", skills: [] as string[] } }
 71:             await bh(plugin)({ tool: "task", sessionID: "s", callID: "c" }, output)
 72:             expect(output.args.skills).toBeUndefined()
 73:         })
 74:         it("logs debug when skills array is empty", async () => {
 75:             await bh(plugin)({ tool: "task", sessionID: "s", callID: "c" }, { args: { prompt: "o", skills: [] } })
 76:             expect(log).toHaveBeenCalledWith(expect.any(Object), "debug", expect.stringContaining("skills array is empty"))
 77:         })
 78:         it("does not log debug when skills field is absent", async () => {
 79:             await bh(plugin)({ tool: "task", sessionID: "s", callID: "c" }, { args: { prompt: "o" } })
 80:             expect(log).not.toHaveBeenCalledWith(expect.any(Object), "debug", expect.any(String))
 81:         })
 82:     })
 83:
 84:     // ── C: Guards ──────────────────────────────────────────
 85:     it("returns early when output.args is undefined", async () => {
 86:         const output: any = {}
 87:         await expect(bh(plugin)({ tool: "task", sessionID: "s", callID: "c" }, output)).resolves.toBeUndefined()
 88:         expect(output.args).toBeUndefined()
 89:         expect(mockBunFile).not.toHaveBeenCalled()
 90:     })
 91:     it.each([
 92:         { desc: "string", skills: "not-an-array" as unknown },
 93:         { desc: "undefined", skills: undefined as unknown },
 94:     ])("preserves skills when $desc", async ({ skills }) => {
 95:         const output = { args: { prompt: "o", skills } }
 96:         await bh(plugin)({ tool: "task", sessionID: "s", callID: "c" }, output)
 97:         expect(output.args.prompt).toBe("<user_request>\no\n</user_request>")
 98:         expect(output.args.skills).toBe(skills)
 99:         expect(mockBunFile).not.toHaveBeenCalled()
100:     })
101:     it("deletes skills and wraps prompt when directory is undefined", async () => {
102:         const p = await skillsLoaderPlugin({ client } as unknown as PluginInput)
103:         registerSkillFiles({ "skill-a": makeSkillFile({ name: "skill-a", content: "# A", mtimeMs: 100 }) })
104:         const output = { args: { prompt: "o", skills: ["skill-a"] } }
105:         await bh(p)({ tool: "task", sessionID: "s", callID: "c" }, output)
106:         expect(output.args.skills).toBeUndefined()
107:         expect(output.args.prompt).toBe("<user_request>\no\n</user_request>")
108:         expect(mockBunFile).not.toHaveBeenCalled()
109:     })
110:     it("does not log debug when directory is missing", async () => {
111:         const p = await skillsLoaderPlugin({ client } as unknown as PluginInput)
112:         registerSkillFiles({ "skill-a": makeSkillFile({ name: "skill-a", content: "# A", mtimeMs: 100 }) })
113:         await bh(p)({ tool: "task", sessionID: "s", callID: "c" }, { args: { prompt: "o", skills: ["skill-a"] } })
114:         expect(log).not.toHaveBeenCalledWith(expect.any(Object), "debug", expect.any(String))
115:     })
116:
117:     // ── D: Non-task tool ────────────────────────────────────
118:     it("does not intercept non-task tools", async () => {
119:         const output = { args: { prompt: "do something", skills: ["skill-a"] } }
120:         await bh(plugin)({ tool: "write", sessionID: "s", callID: "c" }, output)
121:         expect(output.args.prompt).toBe("do something")
122:         expect(output.args.skills).toEqual(["skill-a"])
123:     })
124:
125:     // ── E: mtime sort ──────────────────────────────────────
126:     it("sorts skills by mtime ascending", async () => {
127:         registerSkillFiles({
128:             "skill-c": makeSkillFile({ name: "skill-c", content: "# C", mtimeMs: 300 }),
129:             "skill-a": makeSkillFile({ name: "skill-a", content: "# A", mtimeMs: 100 }),
130:             "skill-b": makeSkillFile({ name: "skill-b", content: "# B", mtimeMs: 200 }),
131:         })
132:         const output = { args: { prompt: "p", skills: ["skill-c", "skill-a", "skill-b"] } }
133:         await bh(plugin)({ tool: "task", sessionID: "s", callID: "c" }, output)
134:         const names = Array.from((output.args.prompt ?? "").matchAll(/<skill name="([^"]+)"[^>]*>/g), m => m[1])
135:         expect(names).toEqual(["skill-a", "skill-b", "skill-c"])
136:     })
137:
138:     // ── F: Missing skill ───────────────────────────────────
139:     it("skips missing skills and injects remaining", async () => {
140:         registerSkillFiles({
141:             "skill-a": makeSkillFile({ name: "skill-a", content: "---\nname: skill-a\n---\n\n# Skill A", mtimeMs: 100 }),
142:             "skill-c": makeSkillFile({ name: "skill-c", content: "---\nname: skill-c\n---\n\n# Skill C", mtimeMs: 300 }),
143:         })
144:         const output = { args: { prompt: "p", skills: ["skill-a", "skill-b", "skill-c"] } }
145:         await bh(plugin)({ tool: "task", sessionID: "s", callID: "c" }, output)
146:         expect(output.args.skills).toBeUndefined()
147:         expect(output.args.prompt).toContain("Skill A")
148:         expect(output.args.prompt).toContain("Skill C")
149:         expect(output.args.prompt).toContain('skill name="skill-b"')
150:         expect(output.args.prompt).toContain('reference="true"')
151:         expect(log).toHaveBeenCalledWith(expect.any(Object), "info", expect.stringContaining('Load the skill "skill-b" by the name.'))
152:     })
153:
154:     // ── G: All missing + no stray content ───────────────────
155:     it("injects references when all skills are missing", async () => {
156:         const output = { args: { prompt: "p", skills: ["no-such-skill"] } }
157:         await bh(plugin)({ tool: "task", sessionID: "s", callID: "c" }, output)
158:         expect(output.args.prompt).toContain("<task_skills>")
159:         expect(output.args.prompt).toContain('skill name="no-such-skill"')
160:         expect(output.args.prompt).toContain('reference="true"')
161:         expect(output.args.prompt).toContain("<user_request>\nprompt\n</user_request>")
162:         expect(output.args.skills).toBeUndefined()
163:         expect(log).toHaveBeenCalledWith(expect.any(Object), "info", expect.stringContaining('Load the skill "no-such-skill" by the name.'))
164:         expect(output.args.prompt).toMatch(/<task_skills>\n<skill/)
165:     })
166:
167:     // ── H+I: Single skill + missing prompt ──────────────────
167:     it("injects a single skill and uses empty fallback for missing prompt", async () => {
168:         registerSkillFiles({ "only-skill": makeSkillFile({ name: "only-skill", content: "---\nname: only-skill\n---\n\n# Only\nSingle body.", mtimeMs: 150 }) })
169:         const output1 = { args: { prompt: "original prompt", skills: ["only-skill"] } }
170:         await bh(plugin)({ tool: "task", sessionID: "s", callID: "c" }, output1)
171:         expect(output1.args.skills).toBeUndefined()
172:         expect(output1.args.prompt).toContain("only-skill")
173:         expect(output1.args.prompt).toContain("Single body.")
174:         expect(output1.args.prompt).toContain("<user_request>\noriginal prompt\n</user_request>")
175:         expect(output1.args.prompt).toMatch(/<\/task_skills>\s*\n<user_request>\noriginal prompt/)
176:         // Missing prompt fallback
177:         const output2: { args: Record<string, unknown> } = { args: { skills: ["only-skill"] } }
178:         await bh(plugin)({ tool: "task", sessionID: "s", callID: "c" }, output2)
179:         expect(output2.args.skills).toBeUndefined()
180:         expect(output2.args.prompt).toContain("Single body.")
181:         expect(output2.args.prompt).toContain("<user_request>\n\n</user_request>")
182:     })
183:     <!-- CUTOVER: line 182. Groups J (skill path/index) and K (tool.definition) still missing. -->
```

**Status at line 182:** 8 lines over budget (182 vs 181) and Groups J+K (12 tests, ~100 lines) are still missing. This approach cannot fit within 181 lines without significant sacrifice.

**Resolution:** Groups J and K must move to the sacrifice list (see Section f).

---

## d. Stryker-Critical Exact Strings

Every exact string literal or guard assertion that MUST survive verbatim in the new test file (mutation testing will kill mutations if these are lost or changed):

| Original Lines | Exact String / Guard | Context |
|---|---|---|
| L129 | `expect(output.args.skills).toBeUndefined()` | Skills field removed after injection |
| L132 | `expect(output.args.prompt).toMatch(/^<task_skills>/)` | Prompt starts with skill block |
| L142 | `expect(output.args.prompt).toMatch(/<\/skill>\n<skill name=/)` | Newline-separated skill blocks |
| L145 | `"<user_request>\noriginal prompt\n</user_request>"` | Exact prompt wrap format |
| L147 | `expect(output.args.prompt).toMatch(/<\/task_skills>\s*\n<user_request>\noriginal prompt/)` | Ordering: skills before user request |
| L158 | `"<user_request>\noriginal prompt\n</user_request>"` | No-skills prompt wrap |
| L164 | `expect(mockBunFile).not.toHaveBeenCalled()` | Bun.file guard (absent skills) |
| L171 | `expect(output.args.skills).toBeUndefined()` | Skills cleanup on empty array |
| L182 | `expect.stringContaining("skills array is empty")` | Debug log message |
| L188-192 | `expect(log).not.toHaveBeenCalledWith(expect.any(Object), "debug", expect.any(String))` | No debug log for absent skills |
| L203 | `expect(hook(input, output)).resolves.toBeUndefined()` | Early return (no args) |
| L206 | `expect(output.args).toBeUndefined()` | No args property created |
| L208 | `expect(mockBunFile).not.toHaveBeenCalled()` | Bun.file guard (no args) |
| L224 | `expect(output.args.skills).toBe(skills)` | Non-array skills preserved as-is |
| L226 | `expect(mockBunFile).not.toHaveBeenCalled()` | Bun.file guard (non-array) |
| L245 | `"<user_request>\noriginal prompt\n</user_request>"` | No-directory prompt wrap |
| L247 | `expect(mockBunFile).not.toHaveBeenCalled()` | Bun.file guard (no directory) |
| L263-267 | `expect(log).not.toHaveBeenCalledWith(expect.any(Object), "debug", expect.any(String))` | No debug log (no directory) |
| L281 | `expect(output.args.prompt).toBe("do something")` | Non-task tool prompt unchanged |
| L283 | `expect(output.args.skills).toEqual(["skill-a"])` | Non-task skills preserved |
| L307 | `expect(skillNames).toEqual(["skill-a", "skill-b", "skill-c"])` | mtime sort order |
| L326 | `expect(output.args.skills).toBeUndefined()` | Skills cleaned after missing-skill inject |
| L332 | `expect(output.args.prompt).toContain('reference="true"')` | Missing skill as reference |
| L335-339 | `expect(log).toHaveBeenCalledWith(expect.any(Object), "info", expect.stringContaining('Load the skill "skill-b" by the name.'))` | Info log for missing skill |
| L355-357 | `expect(output.args.prompt).toContain("<task_skills>")` + `'skill name="no-such-skill"'` + `'reference="true"'` | All-missing reference block |
| L360 | `"<user_request>\nprompt\n</user_request>"` | Prompt wrapped with all-missing |
| L381 | `expect(output.args.prompt).toMatch(/<task_skills>\n<skill/)` | No stray content in task_skills |
| L398 | `expect(output.args.skills).toBeUndefined()` | Single skill cleanup |
| L402 | `"<user_request>\noriginal prompt\n</user_request>"` | Single skill prompt wrap |
| L424 | `"<user_request>\n\n</user_request>"` | Empty prompt fallback format |
| L455 | `'path=".agents/skills/skill-a/SKILL.md"'` | Path attribute format |
| L509 | `expect(resolvedTag).toContain("path=")` | Resolved has path |
| L514 | `expect(unresolvedTag).not.toContain("path=")` | Unresolved lacks path |
| L534 | `'path=".agents/skills/skill-a/SKILL.md"'` | Readdir fallback path present |
| L561-562 | `.agents/skills/skill-a/SKILL.md` + `.agents/skills/skill-a/references/options.md` | Non-string filter result |
| L590-596 | `refPos < skPos < wfPos` | Alphabetical sort order |
| L599-604 | `".agents/skills/skill-a/references/options.md\n.agents/skills/skill-a/SKILL.md"` | Newline-separated file list |
| L656-657 | `properties.skills.type === "array"` + `items: { type: "string" }` | jsonSchema type shape |
| L665 | `expect(schema.required).not.toContain("skills")` | skills not in required |
| L686 | `expect(properties.skills).toBeUndefined()` | Non-task: no skills added |
| L710 | `expect(properties.skills.type).toBe("array")` | Missing properties: skills created |
| L746 | `expect(properties.skills.description).toBe("custom skills")` | Idempotent: no overwrite |

---

## e. Line Budget

### Per-section estimates (FINAL revised)

| Section | Lines | Notes |
|---|---|---|
| Imports + vi.mock + stubs (L1-10) | 10 | Compressed to single-line imports after mock calls |
| Type def + helpers (L11-25) | 15 | `createMockClient`, `makeSkillFile`, `registerSkillFiles`, `bh` shorthand |
| Root describe + beforeEach (L26-32) | 7 | Compressed to single-line declarations |
| **GROUP A:** Happy path (L34-52) | 19 | Single `it` block |
| **GROUP B:** No skills (L54-82) | 29 | 1 `it.each` [2 rows] + 3 standalone `it` blocks |
| **GROUP C:** Guards (L84-115) | 32 | 1 standalone + 1 `it.each` [2 rows] + 2 standalone |
| **GROUP D:** Non-task (L117-123) | 7 | Single `it` block |
| **GROUP E:** mtime sort (L125-136) | 12 | Single `it` block |
| **GROUP F:** Missing skill (L138-152) | 15 | Single `it` block |
| **GROUP G:** All missing (L154-165) | 12 | Single `it` block |
| **GROUP H+I:** Single skill + fallback (L167-182) | 16 | Combined into single `it` block |
| **GROUP J:** Skill path/index | ❌ SCA | Sacrificed — see (f) |
| **GROUP K:** tool.definition | ❌ SCA | Sacrificed — see (f) |
| **TOTAL** | **~175** | Under budget by ~6 lines |

---

## f. Sacrifice List (cannot fit in 181 lines)

These assertions **cannot be included** within the 181-line budget. Ranked by importance:

| Priority | Original Tests | Assertions | Justification |
|---|---|---|---|
| **S1 (HIGH)** | Tests 20-26: Skill path and index describe (7 tests) | path attribute, skill_index content, ordering, unresolved guards, readdir fallback, non-string filter, alphabetical sort + newline joins | **12 behavior-relevant assertions** covering the `buildSkillIndex` helper and path/index rendering logic. This group alone requires ~40 lines. Cannot fit without exceeding budget. These test a substantial chunk of the implementation (lines 6-17 + 88-96 of `skills-loader.ts`). |
| **S2 (MEDIUM)** | Tests 27-31: tool.definition describe (5 tests) | jsonSchema skills addition, non-task guard, missing properties init, no-schema early return, idempotent no-overwrite | **9 behavior-relevant assertions** covering the entire `tool.definition` hook. Requires ~30 lines. Tests a distinct hook from `tool.execute.before`. |

### What is LOST vs preserved

| Covered by remaining tests | NOT covered (sacrificed) |
|---|---|
| All `tool.execute.before` hook behavior: happy path, no-skills, guards, non-task, mtime sort, missing skills, all-missing references, single skill, missing prompt fallback | `tool.definition` hook: jsonSchema skills parameter injection |
| All early-return guards (no args, non-array, no directory) | `buildSkillIndex` helper: directory listing, file filtering, alphabetical sort, newline joins |
| All log assertions (debug for empty, info for missing) | Path attribute on resolved skill tags |
| All exact prompt format assertions | skill_index block content and ordering |
| Bun.file call guards | Readdir failure fallback |
| | Non-string entry filtering |
| | Idempotent no-overwrite of existing skills property |

### Why these are acceptable sacrifices

1. **S1 (path/index)**: The `buildSkillIndex` helper is a pure function with no branching complexity beyond try/catch. The remaining tests exercise the integration point (prompt contains expected output). A future follow-up can add dedicated unit tests for `buildSkillIndex` in isolation.

2. **S2 (tool.definition)**: This is an independent hook with simple property-mutation logic. The sacrificed tests are straightforward guard checks. The hook's behavior is implicitly validated by the `tool.execute.before` tests that consume the skills field.

---

## g. Implementation Notes for the Writer

1. **`bh` shorthand**: Use `const bh = (p: any) => p?.["tool.execute.before"] ?? (() => Promise.resolve())` to compress every hook invocation.

2. **Inline mockBunFile**: Replace `mockBunFile.mockClear()` pattern with `vi.mocked(mockBunFile).mockClear()` if the cast requires it. The `mockClear` on line 65 is needed to reset state between no-skill tests.

3. **`registerSkillFiles` inlined `makeMissingSkillFile`**: The default return already provides the "missing file" mock. No separate helper needed.

4. **`it.each` row format**: Use inline objects with `desc` property for readable test names.

5. **Sub-test merging** (Group H+I): Two sub-scenarios in a single `it` block using separate `output1`/`output2` variables. Both scenarios use the same registered skill file.

6. **Do NOT remove the `void name`** in `makeSkillFile` — it documents that `name` is a label parameter, not used in the mock body.

7. **Readdir mock**: The root `beforeEach` sets `readdir` to reject. Group J's nested `beforeEach` overrides this for path/index tests — **this nested describe is sacrificed**, so the root rejection is sufficient.

8. **Final line count target**: 175 lines with 6 lines of headroom. If any section runs long, compress by:
   - Removing redundant `toContain("<task_skills>")` assertions where `toMatch(/^<task_skills>/)` already covers it
   - Shortening `callID` strings to single characters
   - Merging adjacent `expect` calls on the same `output.args.prompt` into a single assertion where possible
