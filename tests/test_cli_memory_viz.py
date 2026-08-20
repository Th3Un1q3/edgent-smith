"""Tests for the ``memory-viz`` CLI command (``cli/commands/memory_viz.py``).

Covers memory-file parsing, reference normalization, graph building, HTML
rendering (escaping), and the Click command wiring.  All tests use synthetic
``tmp_path`` memory stores — no network, no real ``.serena`` store.
"""

from __future__ import annotations

import json
import pathlib
import re
from typing import Any

import click
import pytest
from click.testing import CliRunner

from cli.commands.memory_viz import (
    build_graph,
    collect_memory_files,
    normalize_ref,
    parse_memory_file,
    render_html,
    run_memory_viz,
)
from cli.main import cli

_DATA_BLOCK_RE = re.compile(r'id="memory-data">(.*?)</script>', re.DOTALL)


def _extract_graph_payload(html: str) -> dict[str, Any]:
    """Extract and JSON-decode the embedded graph payload from rendered HTML."""
    match = _DATA_BLOCK_RE.search(html)
    assert match is not None, "memory-data script block not found in HTML"
    return json.loads(match.group(1))


@pytest.fixture
def rich_memory_dir(tmp_path: pathlib.Path) -> pathlib.Path:
    """A small synthetic memory store exercising refs, ghosts, and a placeholder."""
    mem_dir = tmp_path / "memories"
    (mem_dir / "domain").mkdir(parents=True)
    (mem_dir / "domain" / "a.md").write_text(
        '---\ntitle: "Alpha"\n---\n# Alpha Heading\n'
        "See mem:domain/b, mem:domain/b, mem:missing/x, and mem:...\n",
        encoding="utf-8",
    )
    (mem_dir / "domain" / "b.md").write_text(
        "# Beta\nBackrefs mem:domain/a, mem:domain/b, and mem:missing/x\n",
        encoding="utf-8",
    )
    return mem_dir


# --------------------------------------------------------------------------
# collect_memory_files
# --------------------------------------------------------------------------


def test_collect_memory_files_returns_sorted_md_files_only(
    tmp_path: pathlib.Path,
) -> None:
    """Only ``*.md`` files are returned, sorted by path, skipping non-files."""
    mem_dir = tmp_path / "memories"
    (mem_dir / "nested").mkdir(parents=True)
    (mem_dir / "two.md").write_text("two", encoding="utf-8")
    (mem_dir / "one.md").write_text("one", encoding="utf-8")
    (mem_dir / "notes.txt").write_text("not markdown", encoding="utf-8")
    (mem_dir / "nested" / "three.md").write_text("three", encoding="utf-8")
    (mem_dir / "fake.md").mkdir()  # directory named like a file must be skipped

    files = collect_memory_files(mem_dir)

    assert [p.relative_to(mem_dir).as_posix() for p in files] == [
        "nested/three.md",
        "one.md",
        "two.md",
    ]
    assert all(p.is_file() for p in files)
    assert all(p.suffix == ".md" for p in files)


# --------------------------------------------------------------------------
# parse_memory_file
# --------------------------------------------------------------------------


def test_parse_memory_file_adr_frontmatter_sets_label_group_id(
    tmp_path: pathlib.Path,
) -> None:
    """ADR-style frontmatter yields label from ``title:``, group from first path segment."""
    mem_dir = tmp_path / "memories"
    (mem_dir / "decisions").mkdir(parents=True)
    path = mem_dir / "decisions" / "adr.md"
    content = '---\ntitle: "My ADR"\n---\n# Decision\nWe chose the option.\n'
    path.write_text(content, encoding="utf-8")

    data = parse_memory_file(path, mem_dir)

    assert data.memory_id == "decisions/adr"
    assert data.label == "My ADR"
    assert data.group == "decisions"
    assert data.char_count == len(content)
    assert data.refs == []


def test_parse_memory_file_without_frontmatter_label_from_heading(
    tmp_path: pathlib.Path,
) -> None:
    """Without frontmatter the label falls back to the first ``# heading``."""
    mem_dir = tmp_path / "memories"
    mem_dir.mkdir()
    path = mem_dir / "note.md"
    path.write_text("# My Heading\nSome body text.\n", encoding="utf-8")

    data = parse_memory_file(path, mem_dir)

    assert data.label == "My Heading"
    assert data.memory_id == "note"
    assert data.group == "note"


def test_parse_memory_file_boilerplate_heading_label_falls_back_to_stem(
    tmp_path: pathlib.Path,
) -> None:
    """A ``# fetched page`` heading is ignored for labelling; basename wins."""
    mem_dir = tmp_path / "memories"
    mem_dir.mkdir()
    path = mem_dir / "webpage.md"
    path.write_text(
        "# fetched page\n\nFetched from https://example.com on 2026-01-01.\n",
        encoding="utf-8",
    )

    data = parse_memory_file(path, mem_dir)

    assert data.label == "webpage"
    assert data.group == "webpage"


def test_parse_memory_file_summary_excludes_boilerplate_heading(
    tmp_path: pathlib.Path,
) -> None:
    """Summary of a fetched-page memory must not contain the boilerplate heading."""
    mem_dir = tmp_path / "memories"
    mem_dir.mkdir()
    path = mem_dir / "webpage.md"
    path.write_text("# fetched page\n\nSome fetched content.\n", encoding="utf-8")

    data = parse_memory_file(path, mem_dir)

    assert "fetched page" not in data.summary


def test_parse_memory_file_summary_truncated_at_200_chars_with_ellipsis(
    tmp_path: pathlib.Path,
) -> None:
    """Long bodies truncate the summary excerpt to ~200 chars plus an ellipsis."""
    mem_dir = tmp_path / "memories"
    mem_dir.mkdir()

    long_path = mem_dir / "long.md"
    long_path.write_text("# Long Heading\n" + "z" * 250, encoding="utf-8")
    long_data = parse_memory_file(long_path, mem_dir)
    assert long_data.summary.endswith("…")
    assert long_data.summary.count("…") == 1
    # 'Long Heading' + ' — ' (15 chars) + 200-char excerpt + ellipsis (201)
    assert len(long_data.summary) == 15 + 201
    assert len(long_data.summary) > 200

    short_path = mem_dir / "short.md"
    short_path.write_text("# Short\n\ntiny body\n", encoding="utf-8")
    short_data = parse_memory_file(short_path, mem_dir)
    assert "…" not in short_data.summary


def test_parse_memory_file_extracts_and_normalizes_refs(
    tmp_path: pathlib.Path,
) -> None:
    """Refs are extracted, punctuation/.md-stripped, and placeholders dropped."""
    mem_dir = tmp_path / "memories"
    mem_dir.mkdir()
    path = mem_dir / "refs.md"
    path.write_text(
        "# Refs\n"
        "See `mem:domain/a` and mem:domain/b. "
        "Also mem:domain/c.md and mem:... plus junk mem:-bad and mem:ok-file.\n",
        encoding="utf-8",
    )

    data = parse_memory_file(path, mem_dir)

    assert data.refs == ["domain/a", "domain/b", "domain/c", "ok-file"]
    assert data.dropped_refs == 2


# --------------------------------------------------------------------------
# normalize_ref
# --------------------------------------------------------------------------


def _make_memory_dir(tmp_path: pathlib.Path) -> pathlib.Path:
    mem_dir = tmp_path / "memories"
    (mem_dir / "domain").mkdir(parents=True)
    (mem_dir / "domain" / "a.md").write_text("a", encoding="utf-8")
    (mem_dir / "domain" / "about.md").write_text("about", encoding="utf-8")
    (mem_dir / "empty").mkdir()
    return mem_dir


def test_normalize_ref_existing_file_returns_ref_unchanged(
    tmp_path: pathlib.Path,
) -> None:
    """A ref that maps to an existing ``<ref>.md`` file resolves to itself."""
    mem_dir = _make_memory_dir(tmp_path)

    assert normalize_ref("domain/a", mem_dir) == "domain/a"


def test_normalize_ref_directory_with_about_resolves_to_about(
    tmp_path: pathlib.Path,
) -> None:
    """A ref to a directory with an ``about`` memory resolves to ``<dir>/about``."""
    mem_dir = _make_memory_dir(tmp_path)

    assert normalize_ref("domain", mem_dir) == "domain/about"


def test_normalize_ref_trailing_slash_is_stripped(
    tmp_path: pathlib.Path,
) -> None:
    """A trailing slash on a directory ref is tolerated."""
    mem_dir = _make_memory_dir(tmp_path)

    assert normalize_ref("domain/", mem_dir) == "domain/about"


def test_normalize_ref_directory_without_about_returns_dir_style(
    tmp_path: pathlib.Path,
) -> None:
    """A directory without an ``about`` memory resolves to the dir-style string."""
    mem_dir = _make_memory_dir(tmp_path)

    assert normalize_ref("empty", mem_dir) == "empty"


def test_normalize_ref_unresolvable_returns_none(tmp_path: pathlib.Path) -> None:
    """A ref matching neither a file nor a directory resolves to ``None``."""
    mem_dir = _make_memory_dir(tmp_path)

    assert normalize_ref("nope/x", mem_dir) is None


# --------------------------------------------------------------------------
# build_graph
# --------------------------------------------------------------------------


def test_build_graph_one_node_per_memory_ids_match_relpaths(
    rich_memory_dir: pathlib.Path,
) -> None:
    """One node per memory file with ids equal to the relative paths."""
    graph = build_graph(collect_memory_files(rich_memory_dir), rich_memory_dir)

    memory_ids = {node["id"] for node in graph["nodes"] if node["group"] != "_missing"}
    assert memory_ids == {"domain/a", "domain/b"}
    for node in graph["nodes"]:
        if node["group"] == "domain":
            assert node["id"] in ("domain/a", "domain/b")
            assert node["group"] == "domain"


def test_build_graph_edges_point_from_referring_memory_to_resolved_target(
    rich_memory_dir: pathlib.Path,
) -> None:
    """Each edge's source is the referring memory and target the resolved ref."""
    graph = build_graph(collect_memory_files(rich_memory_dir), rich_memory_dir)
    edges = {(e["source"], e["target"]) for e in graph["edges"]}

    assert ("domain/a", "domain/b") in edges
    assert ("domain/b", "domain/a") in edges
    assert ("domain/a", "missing/x") in edges
    assert ("domain/b", "missing/x") in edges


def test_build_graph_unresolvable_refs_become_ghost_nodes(
    rich_memory_dir: pathlib.Path,
) -> None:
    """Unresolvable refs get ghost nodes in the ``_missing`` group."""
    graph = build_graph(collect_memory_files(rich_memory_dir), rich_memory_dir)

    ghosts = [n for n in graph["nodes"] if n["group"] == "_missing"]
    assert len(ghosts) == 1
    ghost = ghosts[0]
    assert ghost["id"] == "missing/x"
    assert ghost["label"] == "missing/x"
    assert ghost["summary"] == "referenced memory not found"
    assert ghost["charCount"] == 0


def test_build_graph_duplicate_edges_deduped(
    rich_memory_dir: pathlib.Path,
) -> None:
    """Repeated refs from one file collapse to a single edge; ghosts dedupe too."""
    graph = build_graph(collect_memory_files(rich_memory_dir), rich_memory_dir)

    duplicate_pairs = [
        e for e in graph["edges"] if (e["source"], e["target"]) == ("domain/a", "domain/b")
    ]
    assert len(duplicate_pairs) == 1
    ghost_nodes = [n for n in graph["nodes"] if n["id"] == "missing/x"]
    assert len(ghost_nodes) == 1


def test_build_graph_self_reference_kept(rich_memory_dir: pathlib.Path) -> None:
    """A memory referencing itself keeps the self-loop edge."""
    graph = build_graph(collect_memory_files(rich_memory_dir), rich_memory_dir)

    assert ("domain/b", "domain/b") in {(e["source"], e["target"]) for e in graph["edges"]}


def test_build_graph_meta_counts(rich_memory_dir: pathlib.Path) -> None:
    """``_meta`` counts memories, edges, ghosts, and dropped placeholders."""
    graph = build_graph(collect_memory_files(rich_memory_dir), rich_memory_dir)

    assert graph["_meta"]["memoryCount"] == 2
    assert graph["_meta"]["edgeCount"] == 5
    assert graph["_meta"]["ghostCount"] == 1
    assert graph["_meta"]["droppedRefs"] == 1
    assert graph["_meta"]["memoriesDir"] == str(rich_memory_dir)
    assert len(graph["nodes"]) == 3
    assert len(graph["edges"]) == 5


# --------------------------------------------------------------------------
# render_html
# --------------------------------------------------------------------------


def _minimal_graph() -> dict[str, Any]:
    return {
        "_meta": {
            "generatedAt": "2026-01-01T00:00:00+00:00",
            "memoryCount": 1,
            "edgeCount": 0,
            "ghostCount": 0,
            "droppedRefs": 0,
            "memoriesDir": "/synthetic/memories",
        },
        "nodes": [
            {
                "id": "decisions/adr",
                "label": "My ADR",
                "group": "decisions",
                "summary": "# Decision\nWe chose the option.",
                "charCount": 42,
            }
        ],
        "edges": [],
    }


def test_render_html_contains_pinned_vis_network_cdn_script() -> None:
    """The rendered page pins vis-network 10.1.1 from the jsDelivr CDN."""
    html = render_html(_minimal_graph())

    assert (
        "https://cdn.jsdelivr.net/npm/vis-network@10.1.1/standalone/umd/vis-network.min.js" in html
    )


def test_render_html_embeds_parseable_json_matching_graph() -> None:
    """The embedded data block round-trips through ``json.loads`` to the input graph."""
    graph = _minimal_graph()
    graph["nodes"][0]["summary"] = "contains </script> inside summary"
    graph["_meta"]["edgeCount"] = 1
    graph["edges"].append({"source": "a", "target": "b", "kind": "reference"})

    html = render_html(graph)

    assert _extract_graph_payload(html) == graph


def test_render_html_escapes_closing_script_and_comment_markers() -> None:
    """``</script>`` and ``<!--`` in memory content are escaped inside the data block."""
    graph = _minimal_graph()
    graph["nodes"][0]["summary"] = "evil </script> followed by <!-- comment"

    html = render_html(graph)
    payload = _DATA_BLOCK_RE.search(html).group(1)

    assert "<\\/script>" in payload
    assert "\\u003c!--" in payload
    assert "</script>" not in payload
    assert "<!--" not in payload


def test_render_html_escapes_html_injection_in_summary() -> None:
    """Injected markup stays confined to the JSON payload and is runtime-escaped."""
    graph = _minimal_graph()
    graph["nodes"][0]["summary"] = "<script>alert(1)</script>"

    html = render_html(graph)

    # The raw injection string appears only inside the inert JSON data block.
    assert html.count("<script>alert(1)") == 1
    # Runtime rendering routes summaries through the escaping function for
    # title attributes and the detail panel.
    assert "title: esc(n.summary)" in html
    assert "esc(node.summary || '')" in html
    assert "'<': '&lt;'" in html


def test_render_html_json_roundtrip_survives_html_comment_marker() -> None:
    """A memory containing ``<!--`` must still produce parseable embedded JSON."""
    graph = _minimal_graph()
    graph["nodes"][0]["summary"] = "an HTML comment <!-- hidden --> here"

    html = render_html(graph)

    assert _extract_graph_payload(html) == graph


# --------------------------------------------------------------------------
# run_memory_viz + Click command
# --------------------------------------------------------------------------


def test_memory_viz_cli_writes_graph_with_correct_counts(
    tmp_path: pathlib.Path,
    rich_memory_dir: pathlib.Path,
) -> None:
    """The command writes the default output file with the expected counts."""
    runner = CliRunner()

    with runner.isolated_filesystem(temp_dir=tmp_path):
        result = runner.invoke(cli, ["memory-viz", "--memories-dir", str(rich_memory_dir)])

        assert result.exit_code == 0
        assert "Wrote memory graph:" in result.output
        assert "2 memories, 5 references, 1 ghosts, 1 placeholders dropped" in result.output

        output_path = pathlib.Path("memory-graph.html")
        assert output_path.exists()
        payload = _extract_graph_payload(output_path.read_text(encoding="utf-8"))
        assert payload["_meta"]["memoryCount"] == 2
        assert payload["_meta"]["edgeCount"] == 5
        assert payload["_meta"]["ghostCount"] == 1
        assert payload["_meta"]["droppedRefs"] == 1


def test_memory_viz_cli_respects_custom_output_path(
    tmp_path: pathlib.Path,
    rich_memory_dir: pathlib.Path,
) -> None:
    """``--output`` controls the written file location and name."""
    runner = CliRunner()

    with runner.isolated_filesystem(temp_dir=tmp_path):
        result = runner.invoke(
            cli,
            ["memory-viz", "--memories-dir", str(rich_memory_dir), "--output", "custom.html"],
        )

        assert result.exit_code == 0
        assert pathlib.Path("custom.html").exists()
        assert not pathlib.Path("memory-graph.html").exists()


def test_memory_viz_cli_missing_memories_dir_fails(tmp_path: pathlib.Path) -> None:
    """A non-existent memories directory is reported as a Click error."""
    runner = CliRunner()

    result = runner.invoke(cli, ["memory-viz", "--memories-dir", str(tmp_path / "does-not-exist")])

    assert result.exit_code != 0
    assert "Error: Memories directory not found" in result.output


def test_run_memory_viz_empty_directory_raises(tmp_path: pathlib.Path) -> None:
    """An existing but empty memories directory raises a Click error."""
    empty_dir = tmp_path / "empty-memories"
    empty_dir.mkdir()

    with pytest.raises(click.ClickException, match="No memory files found"):
        run_memory_viz(memories_dir=str(empty_dir))


def test_memory_viz_cli_uses_serena_memories_dir_env(
    tmp_path: pathlib.Path,
    rich_memory_dir: pathlib.Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """``SERENA_MEMORIES_DIR`` is honored when ``--memories-dir`` is omitted."""
    monkeypatch.setenv("SERENA_MEMORIES_DIR", str(rich_memory_dir))
    runner = CliRunner()

    with runner.isolated_filesystem(temp_dir=tmp_path):
        result = runner.invoke(cli, ["memory-viz"])

        assert result.exit_code == 0
        assert pathlib.Path("memory-graph.html").exists()
