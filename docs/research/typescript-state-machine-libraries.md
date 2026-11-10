# TypeScript state-machine libraries

A TypeScript service needs 200+ stars, active development, and a file-based state graph; persistence and visualisation are bonuses. Figures are dated 2026-11-10, and star counts are GitHub/search-index renderings, not API reads.

Activity means a commit within the last 12 months and a release within 18 months, measured from 2026-11-10. The must-have columns judge the file graph and the library's currency; execution is a separate competence, not a must-have.

## Comparison

| Library | Stars | Activity (latest release) | File-based graph | Runtime-state persistence | Visualisation | Must-have fit |
|---|---|---|---|---|---|---|
| [XState](https://github.com/statelyai/xstate) | 30.4k | 5.33.4, 2026-11-07; v6 beta 6.0.0-beta.1, 2026-11-06 | Config object in a TS source file; v6 JSON unconfirmed | Snapshot JSON; storage is your code | Stately Studio, `@statelyai/sdk`, `@xstate/graph` (hosted; offline unconfirmed) | All three; strongest tooling |
| [jssm](https://github.com/StoneCypher/jssm) | 366-369, approx. | 5.164.1, 2026-09-27 | `.fsl` text file is graph and diagram | Not confirmed | Built-in DOT/SVG via fsl-render | All three; persistence unproven |
| [state-machine-cat](https://github.com/sverweij/state-machine-cat) | 874 | 15.0.10, 2026-10-07 | `.smcat` DSL; SCXML/JSON input | None; it does not execute | SVG, DOT, PDF, PNG locally | Yes as a diagram/format tool; no runtime |
| [robot3](https://github.com/matthewp/robot) | 2,192 | 1.4.0, 2026-10-05 | Config object in a source file | None documented | robot3-viz, output unconfirmed | Stars, activity, graph; no persistence |
| [javascript-state-machine](https://github.com/jakesgordon/javascript-state-machine) | ~8.8k | 3.1.0 in 2018; last commit 2025-06, over 12 months before 2026-11-10 | JS config object | Not documented | GraphViz documented | No; fails the 12-month commit test |
| [@scion-scxml/scxml](https://github.com/jbeard4/SCION) | 151 | 4.3.27, ~5 years stale | `.scxml` XML documents | Not assessed | Not assessed | No; fails stars and activity |

Adjacent, not state-machine libraries: [bpmn-engine](https://github.com/paed01/bpmn-engine) is a BPMN 2.0 workflow engine, 961 stars, 26.0.6 on 2026-11-06; [bpmn-js-token-simulation](https://github.com/bpmn-io/bpmn-js-token-simulation) is a token simulator, 320 stars, release date not captured. Neither belongs in the table.

## What "file-based" actually means here

Two strengths sit under one label. XState and robot3 declare the graph as a config object inside a TypeScript source file. It is versioned with the code and type-checked, but nothing reads an external graph document at runtime. jssm, state-machine-cat and SCION load dedicated data files, `.fsl`, `.smcat` and `.scxml`, that exist apart from the program and can be edited or rendered without compiling. This brief applies the wider reading: a graph declared in a checked-in file counts. Where the weaker form appears, the table says so, because it changes what the criterion buys: no runtime load of an external document and no round-trip editing by non-developers. A runtime YAML statechart loader did not surface in this research; treat that as a search gap, not a proven absence.

## Which to choose

- XState, for a production runtime with persistence and tooling. It is the only option here with a documented snapshot API, current releases on two tracks and a maintained visual toolchain. Persistence is not built in, so budget for the storage layer.
- jssm, for a file-first textual graph with offline diagrams. The `.fsl` file is both the runtime graph and the diagram source, and rendering is local. Persistence is unconfirmed and would be your code.
- state-machine-cat, for diagrams or SCXML conversion only. It draws, lints and converts machine definitions, but it cannot be your runtime. Pair it with another library when the service must execute states.
- robot3, for a minimal runtime without persistence. It is small and current, but no persistence is documented, so a process restart loses state unless you add a store.

## Persistence recipe

Call `actor.getPersistedSnapshot()` and write the returned JSON into one TEXT column, using better-sqlite3 or `node:sqlite`, or into one JSON file per key. Key the record by machine id plus a schema version that you bump whenever the machine config changes, and store that version with the snapshot. On boot, read the record, pass the JSON as `createActor(machine, { snapshot })`, and let the version check decide whether to migrate or reject. Keep one writer per key so two instances cannot interleave. That is the whole adapter, because XState ships none.

## Gaps and unverified

- jssm stars are approximate, 366-369 from a search index; a live count could not be rendered.
- jssm runtime-state persistence was not confirmed either way.
- The XState v6 `MachineJSON` and `createMachineFromConfig` documentation page could not be fetched, so a plain-JSON graph is unconfirmed.
- XState offline visualisation is unconfirmed. Stately Studio is hosted, and the SDK exports are the only local path seen.
- robot3-viz output, and whether it needs a running service, is unconfirmed.
- javascript-state-machine's ~8.8k stars are approximate, and its last release was 2018.
- Persistence and visualisation for the SCION and bpmn rows were not assessed; neither row is a candidate on the must-haves.
- No TypeScript library loading a YAML statechart at runtime surfaced. That is a search gap, not proof that none exists.
- Star counts are search-index renderings dated 2026-11-10, not GitHub API reads.
