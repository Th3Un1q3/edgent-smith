## Sources

- [desc] Initial description: "explore options of a typescript state-machine libraries. Must-have: - Popular 200+ stars - Actively developed - File-based state graph representation Good to have: - Store runtime state persistantly(in sqlite or file based storage) - Visualizes states"
- [scope] Workflow-selected scope: `bugfix`.

## Q1. [product owner] What decision should this comparison support?

This sets what counts as a good enough answer: a single pick, a shortlist, or a map of the landscape.

A. Pick one library to adopt, so the report must end with a single recommendation
B. Shortlist two or three candidates for a later, deeper evaluation
C. Understand the landscape and trade-offs only, with no pick
D. Decide whether to build our own rather than adopt a library
E. Not yet defined
X. Other (please specify)

[Answer]:

## Q2. [product owner] Who decides which library wins, and who else is affected?

The stakeholder map needs the decision-maker and anyone whose constraints could veto a choice.

A. I decide alone; no one else is affected
B. I decide, with input from one or two teammates
C. A team or architecture group decides; I provide the comparison
D. An external customer or compliance function must also sign off
E. Not identified
X. Other (please specify)

[Answer]:

## Q3. [developer] Where will the chosen library run?

The candidates differ in runtime support, so the comparison needs the target it must fit. The current repository is Python, which makes this an assumption worth stating.

A. A new TypeScript/JavaScript project, Node runtime
B. An existing TypeScript project on Node
C. A browser/frontend application
D. Not decided yet; note each candidate's runtime support
E. Not applicable; only the comparison matters
X. Other (please specify)

[Answer]:

## Q4. [developer] What should "popular (200+ stars)" measure?

GitHub stars alone miss libraries that are widely used through npm but starred less. This decides the popularity column.

A. GitHub stars of at least 200, as stated
B. Stars of at least 200 or npm weekly downloads above a comparable threshold
C. Stars plus download counts plus release history, judged together
D. Not yet defined; use the 200-star figure as stated
E. Not applicable; popularity should not filter candidates
X. Other (please specify)

[Answer]:

## Q5. [developer] What should "actively developed" mean?

A library can be stable with infrequent releases or busy with frequent ones. This decides the maintenance column.

A. A commit within the last 6 months
B. A release within the last 12 months
C. A commit within the last 3 months
D. Not yet defined; show the latest commit and release dates and judge from that
E. Not applicable; maintenance should not filter candidates
X. Other (please specify)

[Answer]:

## Q6. [developer] What counts as a "file-based state graph representation"?

Candidates differ: graph in JSON/YAML, a DSL, or state machines defined in TypeScript code. This decides the must-have verdict.

A. A declarative graph in JSON or YAML config files
B. State machines defined in TypeScript, as long as the graph is explicit and inspectable
C. A separate DSL file with its own syntax
D. Either declarative config or code-defined, as long as the graph is explicit and inspectable
E. Not yet defined
X. Other (please specify)

[Answer]:

## Q7. [developer] How much should the two good-to-haves influence the recommendation?

Persistence and visualization are optional criteria. Their weight decides how a candidate with strong must-haves but no built-in extras ranks.

A. Both matter; prefer built-in persistence and built-in visualization
B. Persistence matters more; visualization can come from external tooling
C. Visualization matters more; persistence can come from a plugin
D. Both are notes only; rank on the must-haves
E. Not yet defined
X. Other (please specify)

[Answer]:

## Q8. [product owner] What should this first version leave out?

The survey's scope already stops before implementation; this pins the remaining boundary.

A. No prototype or sample implementation of any candidate
B. No migration or adoption plan
C. No license or security audit
D. None; anything relevant to the comparison is in scope
E. Not yet defined
X. Other (please specify)

[Answer]:
