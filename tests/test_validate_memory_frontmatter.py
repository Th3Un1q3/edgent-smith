from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from types import ModuleType

import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[1]
SCRIPT = PROJECT_ROOT / "agent_utils/scripts/validate_memory_frontmatter.py"


def _load() -> ModuleType:
    spec = importlib.util.spec_from_file_location("validate_memory_frontmatter", SCRIPT)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


validator = _load()


def _store(tmp_path: Path, files: dict[str, str]) -> Path:
    root = tmp_path / ".serena" / "memories"
    for rel, text in files.items():
        path = root / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")
    return root


def _findings(text: str, rel: str, scope: str = "validate") -> list[object]:
    return validator.check_frontmatter(text, Path("/memories") / rel, rel, scope)


def _messages(text: str, rel: str, scope: str = "validate") -> list[str]:
    return [finding.message for finding in _findings(text, rel, scope)]


def _run(capsys: pytest.CaptureFixture[str], root: Path, *extra: str) -> tuple[int, str]:
    code = validator.main(["--path", str(root), *extra])
    return code, capsys.readouterr().out


@pytest.mark.parametrize(
    ("rel", "expected"),
    [
        ("cache/deepwiki/topic.md", "exempt"),
        ("researches/synthesis.md", "exempt"),
        ("serena/note.md", "exempt"),
        ("private/plan.md", "exempt"),
        ("browser-automation/flow.md", "exempt"),
        ("evals/case.md", "exempt"),
        ("tooling/harness.md", "exempt"),
        ("trajectories/run.md", "validate"),
        ("claims/claim.md", "validate"),
        ("architecture/adr/ADR-001-x.md", "validate"),
        ("architecture/adr-rules.md", "structural"),
        ("lessons/lesson.md", "structural"),
        ("skills/general/note.md", "structural"),
        ("cache/about.md", "validate"),
        ("lessons/about.md", "validate"),
    ],
)
def test_scope_tier_table(rel: str, expected: str) -> None:
    assert validator.scope_tier(rel) == expected


def test_body_dash_never_opens_frontmatter() -> None:
    text = "Report\n\n---\n\nkey: value\n---\n\n| a | b |\n|---|---|\n"

    assert _findings(text, "researches/report.md") == []
    assert validator.declares_type(text) is False


def test_frontmatter_body_dashes_are_not_a_parity_error() -> None:
    text = '---\nid: cases/x\ntype: cases\nL0: "x"\n---\n\n---\n\n| a | b |\n|---|---|\n'
    messages = _messages(text, "cases/x.md")

    assert not any("---" in message for message in messages)


def test_cache_header_without_delimiters_is_exempt(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    root = _store(
        tmp_path,
        {"cache/fetch/page.md": "tool: fetch\nurl: https://example.com\ndate: 2026-01-01\n"},
    )
    code, output = _run(capsys, root)

    assert code == 0
    assert "EXEMPT" in output
    assert "0 errors" in output


def test_about_type_is_a_warning_not_an_error(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    root = _store(
        tmp_path,
        {"cases/about.md": '---\ntype: about\nL0: "cases index"\n---\n\n# Cases\n'},
    )
    code, output = _run(capsys, root)
    assert code == 0
    assert "type 'about' should name the parent scope" in output

    strict_code, _ = _run(capsys, root, "--strict")
    assert strict_code == 1


def test_adr_outside_architecture_adr_needs_no_status() -> None:
    template = "---\nid: ADR-NNN\ntitle: Template\nstatus: draft\n---\n"
    messages = _messages(template, "architecture/adr-template.md", "structural")

    assert not any("ADR status" in message for message in messages)


def test_adr_status_is_checked_under_architecture_adr() -> None:
    body = "---\nid: ADR-001-x\ntitle: X\nstatus: {status}\n---\n"

    assert _messages(body.format(status="accepted"), "architecture/adr/ADR-001-x.md") == []
    assert any(
        "ADR status" in message
        for message in _messages(body.format(status="draft"), "architecture/adr/ADR-001-x.md")
    )


def test_four_space_l0_table_rows_are_accepted() -> None:
    text = (
        '---\ntype: cases\nL0: "cases"\nL0_table:\n'
        '  - id: cases/a\n    L0: "first case"\n'
        '  - id: cases/b\n    L0: "second case"\n---\n'
    )

    assert _messages(text, "cases/about.md") == []


def test_l0_over_256_is_fatal(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    root = _store(
        tmp_path, {"cases/long.md": f'---\nid: cases/long\ntype: cases\nL0: "{"x" * 290}"\n---\n'}
    )
    code, output = _run(capsys, root)

    assert code == 1
    assert "L0 exceeds 256c (290)" in output


def test_typed_frontmatter_missing_type_is_fatal(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    root = _store(
        tmp_path,
        {"experiences/restart.md": "---\nid: experiences/restart\ntitle: Restart\n---\n"},
    )
    code, output = _run(capsys, root)

    assert code == 1
    assert "typed frontmatter missing type" in output


def test_id_must_equal_memory_name(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    root = _store(
        tmp_path,
        {"cases/mismatch.md": '---\nid: cases/other\ntype: cases\nL0: "x"\n---\n'},
    )
    code, output = _run(capsys, root)

    assert code == 0
    assert "does not equal memory name 'mismatch'" in output


def test_exempt_and_structural_never_fail(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    root = _store(
        tmp_path,
        {
            "cache/fetch/page.md": f"L0: {'x' * 400}\ntype: bogus\n",
            "lessons/lesson.md": f"L0: {'x' * 400}\ntype: bogus\n",
        },
    )
    code, output = _run(capsys, root)

    assert code == 0
    assert "0 errors" in output


def test_structural_typed_file_is_validated_as_warning() -> None:
    text = '---\ntype: not-a-type\nL0: "x"\n---\n'
    findings = _findings(text, "lessons/lesson.md", "structural")

    assert [finding.severity for finding in findings] == ["warning"]


def test_json_fence_is_checked_only_in_validate_scope() -> None:
    text = "```json\n{not json}\n```\n"

    assert _messages(text, "cache/fetch/page.md", "validate")
    assert _messages(text, "cache/fetch/page.md", "exempt") == []


def test_skill_keys_checked_only_under_agents_skills() -> None:
    text = "---\nname: demo\n---\n"
    skill_path = Path("/repo/.agents/skills/demo/SKILL.md")
    memory_path = Path("/repo/.serena/memories/skills/SKILL.md")

    skill_findings = validator.check_frontmatter(text, skill_path, "SKILL.md", "validate")
    memory_findings = validator.check_frontmatter(text, memory_path, "skills/SKILL.md", "validate")

    assert any("missing frontmatter key" in finding.message for finding in skill_findings)
    assert memory_findings == []


def test_adr_id_prefixing_its_stem_is_clean() -> None:
    text = "---\nid: ADR-020\ntitle: Serve the web UI locally\nstatus: accepted\n---\n"

    assert _messages(text, "architecture/adr/ADR-020-serving-the-web-ui-locally.md") == []


def test_adr_id_with_a_different_number_still_warns() -> None:
    text = "---\nid: ADR-021\ntitle: Serve the web UI locally\nstatus: accepted\n---\n"
    messages = _messages(text, "architecture/adr/ADR-020-serving-the-web-ui-locally.md")

    assert any("does not equal memory name" in message for message in messages)


def test_adr_without_type_or_l0_is_clean() -> None:
    text = "---\nid: ADR-020\ntitle: Serve the web UI locally\nstatus: accepted\n---\n"

    assert _messages(text, "architecture/adr/ADR-020-serving-the-web-ui-locally.md") == []


def test_adr_with_l0_but_no_type_is_clean() -> None:
    text = (
        "---\nid: ADR-020\ntitle: Serve the web UI locally\nstatus: accepted\n"
        'L0: "the web UI is served locally over a tunnel"\n---\n'
    )
    messages = _messages(text, "architecture/adr/ADR-020-serving-the-web-ui-locally.md")

    assert not any("typed frontmatter must carry type and L0" in message for message in messages)


def test_adr_id_form_is_not_accepted_outside_architecture_adr() -> None:
    text = "---\nid: ADR-020\ntitle: X\n---\n"
    messages = _messages(text, "architecture/ADR-020-portable-devkit.md", "structural")

    assert any("does not equal memory name" in message for message in messages)


def test_non_adr_id_mismatch_still_warns() -> None:
    text = '---\nid: cases/other\ntype: cases\nL0: "x"\n---\n'
    messages = _messages(text, "cases/mismatch.md")

    assert any("does not equal memory name" in message for message in messages)


def test_type_less_typed_memory_is_still_reported() -> None:
    text = '---\nid: experiences/restart\nL0: "x"\n---\n'
    findings = _findings(text, "experiences/restart.md")

    assert [(finding.severity, finding.message) for finding in findings] == [
        ("error", "typed frontmatter missing type")
    ]


def test_no_frontmatter_passes() -> None:
    assert _messages("Just prose.\n", "cases/note.md") == []


def test_summary_prints_one_line_per_tier(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    root = _store(
        tmp_path,
        {
            "cases/ok.md": '---\nid: cases/ok\ntype: cases\nL0: "ok"\n---\n',
            "lessons/plain.md": "prose only\n",
            "cache/fetch/page.md": "tool: fetch\n",
        },
    )
    code, output = _run(capsys, root)

    assert code == 0
    assert "VALIDATE" in output
    assert "STRUCTURAL" in output
    assert "EXEMPT" in output
    assert "SUMMARY: 0 errors, 0 warnings" in output
