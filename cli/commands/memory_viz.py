"""Interactive memory graph visualizer for the Serena memory store.

Reads ``*.md`` files under ``.serena/memories``, extracts ``mem:`` references
from their bodies, and renders a single self-contained HTML page powered by
vis-network (standalone UMD from jsDelivr, pinned v10.1.1).  No build step, no
network calls at runtime — the graph data is embedded directly into the HTML.

Parsing stays dependency-free (stdlib only); frontmatter is split crudely on
``---`` lines and never YAML-parsed.
"""

from __future__ import annotations

import json
import os
import re
import webbrowser
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import click

_MEM_REF_RE = re.compile(r"mem:([a-zA-Z0-9_/.\-]+)")
_BOILERPLATE_HEADINGS = frozenset({"fetched page"})
_PLACEHOLDER_REFS = ("...",)
_TRAILING_PUNCTUATION = ".,;:)"
_GHOST_GROUP = "_missing"
_DEFAULT_GROUP = "_default"


@dataclass
class MemoryData:
    """Parsed representation of a single memory file."""

    memory_id: str
    label: str
    group: str
    summary: str
    char_count: int
    refs: list[str] = field(default_factory=list)
    dropped_refs: int = 0


def collect_memory_files(memories_dir: Path) -> list[Path]:
    """Return all ``*.md`` files under ``memories_dir``, sorted by path."""
    return sorted(p for p in memories_dir.rglob("*.md") if p.is_file())


def _split_frontmatter(content: str) -> tuple[str, str]:
    """Crudely split ``---``-delimited frontmatter from the body.

    Returns ``(frontmatter, body)``.  If the file does not start with ``---``
    or the closing delimiter is missing, frontmatter is empty.
    """
    if not content.startswith("---"):
        return "", content
    lines = content.splitlines()
    for index in range(1, len(lines)):
        if lines[index] == "---":
            return "\n".join(lines[1:index]), "\n".join(lines[index + 1 :])
    return "", content


def _extract_title(frontmatter: str) -> str | None:
    """Return the ``title:`` value from crude frontmatter, if present."""
    for line in frontmatter.splitlines():
        stripped = line.strip()
        if stripped.lower().startswith("title:"):
            value = stripped.split(":", 1)[1].strip()
            return value.strip('"').strip("'").strip()
    return None


def _first_heading(body: str) -> str | None:
    """Return the first level-1 heading text from the body, if any."""
    for line in body.splitlines():
        stripped = line.strip()
        if stripped.startswith("# "):
            heading = stripped[2:].strip()
            if heading.lower() in _BOILERPLATE_HEADINGS:
                return None
            return heading
    return None


def _strip_boilerplate_heading(body: str) -> str:
    """Remove a leading boilerplate heading line (and trailing blanks) from the body.

    Cache-file memories open with a ``# fetched page`` heading that must not
    leak into summaries.  Only the first heading line is considered, and only
    when it is boilerplate; the heading line plus any immediately following
    blank lines are removed.
    """
    lines = body.splitlines()
    for index, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith("# "):
            if stripped[2:].strip().lower() not in _BOILERPLATE_HEADINGS:
                break
            rest = lines[index + 1 :]
            while rest and not rest[0].strip():
                rest = rest[1:]
            return "\n".join(rest)
    return body


def _normalize_refs(raw_refs: list[str]) -> tuple[list[str], int]:
    """Normalize raw ``mem:`` captures and count dropped placeholders."""
    refs: list[str] = []
    dropped = 0
    for ref in raw_refs:
        normalized = ref.rstrip(_TRAILING_PUNCTUATION)
        if normalized.endswith(".md"):
            normalized = normalized[:-3]
        if (
            not normalized
            or normalized.startswith("-")
            or any(marker in normalized for marker in _PLACEHOLDER_REFS)
        ):
            dropped += 1
            continue
        refs.append(normalized)
    return refs, dropped


def parse_memory_file(path: Path, base_dir: Path | None = None) -> MemoryData:
    """Parse one memory file into :class:`MemoryData`.

    ``memory_id`` is the path relative to ``base_dir`` (the memories root)
    minus the ``.md`` extension.  When ``base_dir`` is omitted it defaults to
    the file's parent directory.
    """
    content = path.read_text(encoding="utf-8")
    frontmatter, body = _split_frontmatter(content)
    base = base_dir if base_dir is not None else path.parent
    memory_id = path.relative_to(base).as_posix()
    if memory_id.endswith(".md"):
        memory_id = memory_id[:-3]
    group = memory_id.partition("/")[0] or _DEFAULT_GROUP

    label = _extract_title(frontmatter) or _first_heading(body) or path.stem
    heading = _first_heading(body)
    excerpt_body = _strip_boilerplate_heading(body).strip()
    excerpt = excerpt_body[:200]
    if len(excerpt_body) > 200:
        excerpt += "…"
    summary = " — ".join(part for part in (heading, excerpt) if part)

    raw_refs = _MEM_REF_RE.findall(content)
    refs, dropped = _normalize_refs(raw_refs)
    return MemoryData(
        memory_id=memory_id,
        label=label,
        group=group,
        summary=summary,
        char_count=len(content),
        refs=refs,
        dropped_refs=dropped,
    )


def normalize_ref(ref: str, memories_dir: Path) -> str | None:
    """Resolve a punctuation-normalized ref to a memory id, or ``None``.

    Resolution rules, in order:

    * ``memories_dir/<ref>.md`` exists → ``ref`` (real memory).
    * ``memories_dir/<ref>`` is a directory → ``<ref>/about`` if that memory
      exists, otherwise the dir-style string (becomes a ghost node).
    * otherwise → ``None`` (unresolvable; caller decides ghost handling).
    """
    ref = ref.rstrip("/")
    if (memories_dir / f"{ref}.md").is_file():
        return ref
    target_dir = memories_dir / ref
    if target_dir.is_dir():
        about = f"{ref}/about"
        if (memories_dir / f"{about}.md").is_file():
            return about
        return ref
    return None


def build_graph(memory_files: list[Path], memories_dir: Path) -> dict[str, Any]:
    """Build the graph data contract consumed by ``render_html``."""
    memories = [parse_memory_file(path, memories_dir) for path in memory_files]
    memory_ids = {memory.memory_id for memory in memories}

    edges: set[tuple[str, str]] = set()
    ghost_ids: set[str] = set()
    for memory in memories:
        for ref in memory.refs:
            target = normalize_ref(ref, memories_dir) or ref
            edges.add((memory.memory_id, target))
            if target not in memory_ids:
                ghost_ids.add(target)

    nodes = [
        {
            "id": memory.memory_id,
            "label": memory.label,
            "group": memory.group,
            "summary": memory.summary,
            "charCount": memory.char_count,
        }
        for memory in memories
    ]
    nodes.extend(
        {
            "id": ghost_id,
            "label": ghost_id,
            "group": _GHOST_GROUP,
            "summary": "referenced memory not found",
            "charCount": 0,
        }
        for ghost_id in sorted(ghost_ids)
    )
    edges_list = [
        {"source": source, "target": target, "kind": "reference"}
        for source, target in sorted(edges)
    ]

    return {
        "_meta": {
            "generatedAt": datetime.now(UTC).isoformat(),
            "memoryCount": len(memories),
            "edgeCount": len(edges_list),
            "ghostCount": len(ghost_ids),
            "droppedRefs": sum(memory.dropped_refs for memory in memories),
            "memoriesDir": str(memories_dir),
        },
        "nodes": nodes,
        "edges": edges_list,
    }


# Anchors injected into the HTML template (avoids f-string/format brace clashes
# with the embedded JavaScript).
_GRAPH_JSON_ANCHOR = "__GRAPH_JSON__"

_HTML_TEMPLATE = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Memory Graph</title>
<style>
  html, body { margin: 0; padding: 0; height: 100%; }
  body {
    background: #0f172a;
    color: #e2e8f0;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    overflow: hidden;
  }
  #mynetwork { width: 100%; height: 100%; }
  #counts {
    position: fixed; top: 12px; left: 12px;
    padding: 6px 12px;
    background: rgba(2, 6, 23, 0.75);
    border: 1px solid #334155;
    border-radius: 6px;
    font-size: 13px;
    color: #cbd5e1;
    z-index: 10;
    pointer-events: none;
  }
  #detail {
    position: fixed; top: 0; right: 0;
    width: 340px; max-width: 85vw; height: 100%;
    overflow-y: auto;
    background: #111827;
    border-left: 1px solid #334155;
    padding: 16px;
    box-sizing: border-box;
    display: none;
    z-index: 20;
  }
  #detail h2 {
    margin: 0 0 6px; font-size: 15px;
    word-break: break-all; color: #f8fafc;
    padding-right: 24px;
  }
  #detail .close {
    position: fixed; top: 10px; right: 12px;
    cursor: pointer; color: #94a3b8;
    font-size: 18px; z-index: 21;
    background: none; border: none;
  }
  #detail .close:hover { color: #f8fafc; }
  #detail .meta { color: #94a3b8; font-size: 12px; margin: 0 0 10px; }
  #detail .summary {
    font-size: 13px; line-height: 1.5;
    color: #e2e8f0; margin: 0 0 12px;
    white-space: pre-wrap;
  }
  #detail .neighbors { list-style: none; margin: 0; padding: 0; }
  #detail .neighbors li {
    padding: 6px 8px;
    border-bottom: 1px solid #1e293b;
    font-size: 13px;
  }
  #detail .neighbors li.ghost { color: #f87171; }
  #detail .neighbors li .nid {
    display: block; font-size: 11px;
    color: #64748b; word-break: break-all;
  }
</style>
<script src="https://cdn.jsdelivr.net/npm/vis-network@10.1.1/standalone/umd/vis-network.min.js"></script>
<script>
  if (typeof window.vis === 'undefined') {
    document.write('<script src="https://unpkg.com/vis-network@10.1.1/standalone/umd/vis-network.min.js"><\/script>');
  }
</script>
</head>
<body>
<div id="mynetwork"></div>
<div id="counts"></div>
<div id="detail"></div>
<script type="application/json" id="memory-data">__GRAPH_JSON__</script>
<script>
(function () {
  'use strict';
  var DATA = JSON.parse(document.getElementById('memory-data').textContent);

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function closeDetail() { document.getElementById('detail').style.display = 'none'; }
  window.closeDetail = closeDetail;

  var palette = [
    '#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f',
    '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac',
    '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
    '#8c564b', '#e377c2', '#bcbd22', '#17becf', '#7f7f7f'
  ];
  var groups = {
    '_missing': {
      color: { background: '#7f1d1d', border: '#f87171' },
      shape: 'diamond',
      font: { color: '#e2e8f0' }
    },
    '_default': { color: { background: '#64748b', border: '#94a3b8' }, font: { color: '#e2e8f0' } }
  };
  var groupIndex = 0;
  DATA.nodes.forEach(function (n) {
    var g = n.group || '_default';
    if (!groups[g]) {
      groups[g] = {
        color: { background: palette[groupIndex++ % palette.length], border: '#f8fafc' },
        font: { color: '#e2e8f0' }
      };
    }
  });

  var nodeMap = {};
  var nodes = new vis.DataSet();
  DATA.nodes.forEach(function (n) {
    nodeMap[n.id] = n;
    var label = String(n.label || n.id);
    if (label.length > 26) { label = label.slice(0, 24) + '\u2026'; }
    nodes.add({
      id: n.id,
      label: label,
      group: n.group || '_default',
      title: esc(n.summary) + '<br><code>' + esc(n.id) + '</code>',
      value: Math.max(4, Number(n.charCount) || 0),
      font: { color: '#e2e8f0', size: 12 }
    });
  });

  var edges = new vis.DataSet();
  DATA.edges.forEach(function (e) {
    edges.add({
      from: e.source,
      to: e.target,
      arrows: 'to',
      color: { color: '#64748b', highlight: '#38bdf8', opacity: 0.55 },
      smooth: { type: 'dynamic' }
    });
  });

  var container = document.getElementById('mynetwork');
  var network = new vis.Network(container, { nodes: nodes, edges: edges }, {
    groups: groups,
    physics: {
      enabled: true,
      solver: 'forceAtlas2Based',
      forceAtlas2Based: {
        gravitationalConstant: -60,
        centralGravity: 0.01,
        springLength: 120,
        springConstant: 0.04,
        damping: 0.4
      },
      stabilization: { iterations: 200 },
      minVelocity: 0.5
    },
    interaction: { hover: true, tooltipDelay: 120, dragNodes: true }
  });

  document.getElementById('counts').textContent =
    DATA._meta.memoryCount + ' memories \u00b7 ' + DATA.edges.length + ' references';

  network.on('click', function (params) {
    if (!params.nodes.length) { closeDetail(); return; }
    var id = params.nodes[0];
    var node = nodeMap[id];
    if (!node) { return; }
    var neighborIds = [];
    DATA.edges.forEach(function (e) {
      if (e.source === id) { neighborIds.push(e.target); }
      if (e.target === id) { neighborIds.push(e.source); }
    });
    var uniq = [];
    neighborIds.forEach(function (nid) { if (uniq.indexOf(nid) === -1) { uniq.push(nid); } });
    uniq.sort();
    var ghostCount = 0;
    uniq.forEach(function (nid) {
      if (nodeMap[nid] && nodeMap[nid].group === '_missing') { ghostCount += 1; }
    });

    var html = '';
    html += '<button class="close" onclick="closeDetail()" aria-label="close">\u2715</button>';
    html += '<h2>' + esc(id) + '</h2>';
    html += '<p class="meta">' + node.charCount + ' chars \u00b7 ' + uniq.length
      + ' connection' + (uniq.length === 1 ? '' : 's')
      + (ghostCount ? ' \u00b7 ' + ghostCount + ' missing' : '') + '</p>';
    html += '<p class="summary">' + esc(node.summary || '') + '</p>';
    if (node.group === '_missing') { html += '<p class="meta">referenced memory not found</p>'; }
    html += '<ul class="neighbors">';
    uniq.forEach(function (nid) {
      var nn = nodeMap[nid] || { label: nid };
      var cls = (nn.group === '_missing') ? 'ghost' : '';
      html += '<li class="' + cls + '">' + esc(nn.label || nid)
        + '<span class="nid">' + esc(nid) + '</span></li>';
    });
    html += '</ul>';
    var detail = document.getElementById('detail');
    detail.innerHTML = html;
    detail.style.display = 'block';
  });
})();
</script>
</body>
</html>
"""


def render_html(graph: dict[str, Any]) -> str:
    """Render the graph contract into a self-contained HTML page.

    The embedded JSON is escaped so a memory body can never break out of the
    ``script type="application/json"`` block: ``</script>`` becomes
    ``\\/script>`` (a valid JSON ``\\/`` escape) and ``<!--`` becomes
    ``\\u003c!--`` (a valid unicode escape that decodes back to ``<!--``),
    so the payload still round-trips through ``JSON.parse``/``json.loads``.
    """
    payload = json.dumps(graph)
    payload = payload.replace("</script>", "<\\/script>")
    payload = payload.replace("<!--", "\\u003c!--")
    return _HTML_TEMPLATE.replace(_GRAPH_JSON_ANCHOR, payload)


def _resolve_memories_dir(explicit: str | None) -> Path:
    """Resolve the memories directory: explicit > env var > cwd/ancestors."""
    if explicit is not None:
        return Path(explicit).resolve()
    env_dir = os.environ.get("SERENA_MEMORIES_DIR")
    if env_dir:
        return Path(env_dir).resolve()
    for candidate in (Path.cwd(), *Path.cwd().parents):
        probe = candidate / ".serena" / "memories"
        if probe.is_dir():
            return probe
    raise click.ClickException(
        "Could not locate .serena/memories. Pass --memories-dir or set SERENA_MEMORIES_DIR."
    )


def run_memory_viz(
    memories_dir: str | None = None,
    output: str = "memory-graph.html",
    open_browser: bool = False,
) -> int:
    """Build the memory graph and write the interactive HTML page."""
    resolved_dir = _resolve_memories_dir(memories_dir)
    if not resolved_dir.is_dir():
        raise click.ClickException(f"Memories directory not found: {resolved_dir}")
    memory_files = collect_memory_files(resolved_dir)
    if not memory_files:
        raise click.ClickException(f"No memory files found under {resolved_dir}")

    graph = build_graph(memory_files, resolved_dir)
    meta = graph["_meta"]
    output_path = Path(output)
    output_path.write_text(render_html(graph), encoding="utf-8")

    click.echo(
        f"Wrote memory graph: {output_path.resolve()} "
        f"({meta['memoryCount']} memories, {meta['edgeCount']} references, "
        f"{meta['ghostCount']} ghosts, {meta['droppedRefs']} placeholders dropped)"
    )
    file_uri = output_path.resolve().as_uri()
    click.echo(f"Open in browser: {file_uri}")
    if open_browser:
        webbrowser.open(file_uri)
    return 0
