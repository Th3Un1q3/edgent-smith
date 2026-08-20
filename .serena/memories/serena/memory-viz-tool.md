# memory-viz - Memory Graph Visualizer

`memory-viz` is this repo's sanctioned way to visualize the memory graph: `uv run python -m cli memory-viz` or `just memory-viz`; options `--memories-dir`, `--output`, `--open`.

## Output

Generates a self-contained `memory-graph.html` with the graph data embedded as JSON in the page, rendered with vis-network 10.1.1 from a CDN (unpkg fallback). Works from `file://` - no server, no build step.

What it visualizes: `mem:serena/memory-store-format`. Embedding technique: `mem:troubleshooting/web/no-build-graph-visualization`.