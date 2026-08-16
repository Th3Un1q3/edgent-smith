# Automa: repeat-task loops do NOT work with loop-breakpoint

The engine's repeat-task handler (handlerRepeatTask.js) counts iterations in this.repeatedTasks[id] keyed by the block's NODE ID and never populates this.loopList. The loop-breakpoint handler (handlerLoopBreakpoint.js) reads loopList[data.loopId] and throws Can't find a loop with "<loopId>" loop id when absent. Only loop-data / loop-elements populate loopList. Wiring a loop-breakpoint to a repeat-task loopId therefore crashes the workflow on the first iteration — with workflow onError: stop-workflow the entire run dies.

Proven pattern (used by this repo's Xing/LI job workflows): repeat-task with back-edges INTO the repeat-task node's input-1 to iterate, exit via output-1; no loop-breakpoint at all.

NOTE: the Automa skill docs (create-workflow.md / design-patterns.md) claim repeat-task requires a loop-breakpoint — that guidance is WRONG per the engine source (see `mem:cache/fetch/raw-githubusercontent-com/automaapp-documentation-main-docs-workflow-looping-md` for the official docs background). Trust the engine source; observed behavior confirms the back-edge pattern works.