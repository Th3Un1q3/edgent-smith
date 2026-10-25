#!/usr/bin/env python3
"""Minimal skill eval runner using OpenCode CLI."""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import time
import tomllib
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path
from typing import Any

run_id = datetime.now().strftime("%Y%m%d-%H%M%S")


def _expand_run_id(text: str) -> str:
    return text.replace("{run_id}", run_id)


def find_project_root(start: str | None = None) -> Path:
    p = Path(start or os.getcwd()).resolve()
    for cand in [p, *p.parents]:
        if (cand / ".opencode").is_dir() or (cand / "pyproject.toml").is_file():
            return cand
    return p


def resolve_skill(skill: str, root: Path) -> Path:
    p = Path(skill)
    if p.is_dir():
        return p.resolve()
    for sub in (".agents/skills", "skills"):
        cand = root / sub / skill
        if cand.is_dir():
            return cand.resolve()
    raise SystemExit(f"skill not found: {skill}")


def parse_config_file(path: Path) -> dict[str, Any]:
    if path.suffix.lower() == ".json":
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    with path.open("rb") as f:
        data = tomllib.load(f)
    return data if isinstance(data, dict) else {}


def discover_config(skill_dir: Path, root: Path, explicit: str | None) -> dict[str, Any]:
    candidates: list[Path] = []
    if explicit:
        candidates.append(Path(explicit))
    bases = [
        (skill_dir / "evals", "config"),
        (root / "evals", "config"),
        (root / ".opencode", "evals"),
    ]
    for directory, stem in bases:
        candidates.append(directory / f"{stem}.toml")
        candidates.append(directory / f"{stem}.json")
    for cand in candidates:
        if cand.is_file():
            try:
                return parse_config_file(cand)
            except (OSError, ValueError, tomllib.TOMLDecodeError, json.JSONDecodeError):
                continue
    return {}


def load_evals(skill_dir: Path, eval_set: str) -> tuple[dict[str, Any], Path]:
    path = Path(eval_set)
    if not path.is_absolute():
        path = skill_dir / path
    if not path.is_file():
        raise SystemExit(f"eval set not found: {path}")
    return json.loads(path.read_text(encoding="utf-8")), path


def build_case_prompt(skill_dir: Path, case: dict[str, Any]) -> str:
    skill_md = ""
    sm = skill_dir / "SKILL.md"
    if sm.is_file():
        skill_md = sm.read_text(encoding="utf-8")
    case_prompt = _expand_run_id(str(case.get("prompt", "")))
    return (
        "Follow the skill below and answer the case. "
        "Return your full response only.\n\n"
        "## SKILL\n" + skill_md + "\n\n"
        "## CASE PROMPT\n" + case_prompt + "\n"
    )


def _texts_from_obj(obj: dict[str, Any]) -> list[str]:
    out: list[str] = []
    typ = obj.get("type")
    if typ == "text":
        part = obj.get("part") or {}
        text = part.get("text")
        if text:
            out.append(text)
        return out
    if typ != "assistant":
        return out
    part = obj.get("part") or {}
    text = part.get("text")
    if text:
        out.append(text)
        return out
    message = obj.get("message") or {}
    content = message.get("content")
    if isinstance(content, str) and content:
        out.append(content)
    elif isinstance(content, list):
        for item in content:
            if isinstance(item, dict):
                ct = item.get("text")
                if ct:
                    out.append(ct)
    return out


def _extract_text_parts(stdout: str) -> list[str]:
    parts: list[str] = []
    for line in stdout.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
        except json.JSONDecodeError:
            continue
        if not isinstance(obj, dict):
            continue
        parts.extend(_texts_from_obj(obj))
    return parts


# An unreachable primary model surfaces as a provider routing or packaging error,
# not a rate limit, and must arm the fallback just the same.
_FALLBACK_MARKERS = (
    "rate limit",
    "429",
    "limit",
    "quota",
    "no-route",
    "provider.no-route",
    "unsupported package",
)


def _is_rate_limited(rc: int, *outputs: str) -> bool:
    if rc == 0:
        return False
    blob = "\n".join(outputs).lower()
    return any(marker in blob for marker in _FALLBACK_MARKERS)


def _invoke_opencode(
    prompt: str,
    bin_path: str,
    timeout: int | None,
    model: str | None,
    agent: str | None,
    session_id: str | None = None,
    title: str | None = None,
) -> tuple[str, str, int, float]:
    cmd = [bin_path, "run"]
    if session_id:
        cmd += ["-s", session_id]
    cmd += [prompt, "--format", "json", "--auto"]
    if title:
        cmd += ["--title", title]
    if model:
        cmd += ["--model", model]
    if agent:
        cmd += ["--agent", agent]
    start = time.monotonic()
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    except FileNotFoundError:
        return "", f"opencode binary not found: {bin_path}", 127, 0.0
    except subprocess.TimeoutExpired as e:
        elapsed = time.monotonic() - start
        stderr = e.stderr if isinstance(e.stderr, str) else ""
        return "", (stderr + "\ntimeout").strip(), 124, elapsed
    elapsed = time.monotonic() - start
    return proc.stdout or "", (proc.stderr or "").strip(), proc.returncode, elapsed


def _session_id_from_stdout(stdout: str) -> str | None:
    for line in stdout.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(obj, dict):
            sid = obj.get("sessionID")
            if isinstance(sid, str) and sid:
                return sid
    return None


def run_opencode(
    prompt: str,
    bin_path: str,
    timeout: int | None,
    model: str | None = None,
    agent: str | None = None,
    raw_path: Path | None = None,
    fallback_model: str | None = None,
    session_id: str | None = None,
    title: str | None = None,
) -> tuple[str, str, int, float, str | None]:
    stdout, stderr, rc, elapsed = _invoke_opencode(
        prompt, bin_path, timeout, model, agent, session_id, title
    )
    if fallback_model and _is_rate_limited(rc, stderr, stdout):
        stdout, stderr, rc, fb_elapsed = _invoke_opencode(
            prompt, bin_path, timeout, fallback_model, agent, session_id, title
        )
        elapsed += fb_elapsed
    if raw_path is not None:
        try:
            raw_path.parent.mkdir(parents=True, exist_ok=True)
            raw_path.write_text(stdout, encoding="utf-8")
        except OSError:
            pass
    parts = _extract_text_parts(stdout)
    return "\n".join(parts).strip(), stderr, rc, elapsed, _session_id_from_stdout(stdout)


_CONTINUE_PROMPT = "Continue and complete the task. Report the final answer."
# A turn that stops right after its planning block leaves little text past
# </task_contract>; the floor separates that from a turn that also answered.
_FINAL_ANSWER_MIN_CHARS = 200


def _has_final_answer(text: str) -> bool:
    tail = text.rpartition("</task_contract>")[2].strip()
    return len(tail) >= _FINAL_ANSWER_MIN_CHARS


# A turn that reports its own gaps is not finished even when it cleared the
# length floor: the marker is the signal, so one more turn is spent on it.
# Only explicit gap declarations qualify. Generic words such as "pending",
# "TODO", or "residual risk" appear in ordinary status prose, so matching them
# spends a continuation turn on a finished answer.
# A plan-only run narrates the write it intended instead of issuing it, so the
# report itself is the signal that the work is still undone.
_INCOMPLETE_MARKERS = (
    re.compile(r"\bNOT performed\b"),
    re.compile(r"\bnot performed\b"),
    re.compile(r"\bbudget exhausted\b"),
    re.compile(r"\bnot verified\b"),
    re.compile(r"\boutcome: partial\b"),
    re.compile(r"\bblocked by tool limit\b"),
    re.compile(r"\bspend: 24\b"),
    re.compile(r"\bno write_memory was issued\b"),
    re.compile(r"\bnothing was persisted\b"),
    re.compile(r"\bno memories exist\b"),
    re.compile(r"\bno write was\b"),
    re.compile(r"\bplan-only\b"),
    re.compile(r"\bdid not write\b"),
)


def _needs_continuation(text: str) -> bool:
    stripped = text.strip()
    if not stripped:
        return True
    if any(marker.search(stripped) for marker in _INCOMPLETE_MARKERS):
        return True
    if "<task_contract>" not in stripped:
        return False
    return not _has_final_answer(stripped)


def _collect_transcripts(results_dir: Path, prefix: str) -> list[str]:
    return [
        str(p.resolve()) for p in sorted(results_dir.glob(f"{prefix}*.raw*.txt")) if p.is_file()
    ]


def run_case(
    case: dict[str, Any],
    skill_dir: Path,
    bin_path: str,
    timeout: int | None,
    model: str | None,
    agent: str | None = None,
    ts: str | None = None,
    fallback_model: str | None = None,
    max_turns: int = 0,
) -> dict[str, Any]:
    prompt = build_case_prompt(skill_dir, case)
    skill_name = skill_dir.name
    stamp = ts or datetime.now().strftime("%Y%m%d-%H%M%S")
    raw_path = (
        skill_dir / "evals" / "results" / f"{skill_name}-{stamp}-case{case.get('id')}.raw.txt"
    )
    fallback_used = False
    # A fixed title keeps the run name out of the model's hands and makes
    # sessions easy to find by case id.
    title = f"eval-case-{case.get('id')}"

    def _turn(
        turn_prompt: str, raw: Path, session: str | None
    ) -> tuple[str, str, int, float, str | None]:
        nonlocal fallback_used
        turn_text, turn_stderr, code, secs, sid = run_opencode(
            turn_prompt,
            bin_path,
            timeout,
            model,
            agent,
            raw_path=raw,
            fallback_model=None if fallback_used else fallback_model,
            session_id=session,
            title=title,
        )
        # A timed-out or empty turn is retried once on the fallback model as a
        # fresh run of the case prompt: the session may hold the failing turn.
        if fallback_model and not fallback_used and (code == 124 or not turn_text.strip()):
            fallback_used = True
            fb_text, fb_stderr, fb_code, fb_secs, fb_sid = run_opencode(
                prompt,
                bin_path,
                timeout,
                fallback_model,
                agent,
                raw_path=raw.with_name(f"{raw.stem}-fallback.txt"),
                title=title,
            )
            return fb_text, fb_stderr or turn_stderr, fb_code, secs + fb_secs, fb_sid
        return turn_text, turn_stderr, code, secs, sid

    turn_text, stderr, rc, elapsed, session_id = _turn(prompt, raw_path, None)
    texts = [turn_text] if turn_text else []
    turns = 1
    while turns <= max_turns and rc == 0 and session_id and _needs_continuation(turn_text):
        turns += 1
        turn_text, turn_stderr, rc, turn_elapsed, turn_session = _turn(
            _CONTINUE_PROMPT,
            raw_path.with_name(f"{raw_path.stem}-turn{turns}.txt"),
            session_id,
        )
        elapsed += turn_elapsed
        stderr = turn_stderr or stderr
        session_id = turn_session or session_id
        if turn_text:
            texts.append(turn_text)
    text = "\n\n".join(texts).strip()
    transcript_paths = _collect_transcripts(
        raw_path.parent, f"{skill_name}-{stamp}-case{case.get('id')}"
    )
    error = None
    if rc != 0:
        error = f"rc={rc}: {stderr[:300]}"
    elif not text:
        error = "empty output"
    return {
        "id": case.get("id"),
        "prompt": case.get("prompt"),
        "output": text,
        "elapsed": round(elapsed, 3),
        "rc": rc,
        "error": error,
        "stderr": stderr,
        "turns": turns,
        "session_id": session_id,
        "transcripts": transcript_paths,
        "fallback_used": fallback_used,
    }


def _strip_fences(text: str) -> str:
    t = text.strip()
    if t.startswith("```"):
        lines = t.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        t = "\n".join(lines).strip()
    return t


def _try_parse_json(text: str) -> tuple[Any, str | None]:
    cleaned = _strip_fences(text)
    try:
        return json.loads(cleaned), None
    except json.JSONDecodeError as e:
        last_error: json.JSONDecodeError = e
    start, end = cleaned.find("["), cleaned.rfind("]")
    if start != -1 and end > start:
        try:
            return json.loads(cleaned[start : end + 1]), None
        except json.JSONDecodeError as e:
            last_error = e
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start != -1 and end > start:
        try:
            obj = json.loads(cleaned[start : end + 1])
        except json.JSONDecodeError as e:
            return None, f"grading failed: {e}"
        return ([obj] if isinstance(obj, dict) else obj), None
    return None, f"grading failed: {last_error}"


def _parse_grading(text: str, stderr: str, rc: int, texts: list[str]) -> list[dict[str, Any]]:
    failed_msg: str | None = None
    result: Any = None
    if rc != 0:
        failed_msg = f"grading failed: rc={rc} {stderr[:200]}"
    else:
        result, failed_msg = _try_parse_json(text)
    if failed_msg or not isinstance(result, list):
        if failed_msg is None:
            failed_msg = "grading failed: invalid grader output"
        return [{"text": t, "passed": None, "evidence": failed_msg} for t in texts]
    out: list[dict[str, Any]] = []
    for i, t in enumerate(texts):
        item = result[i] if (i < len(result) and isinstance(result[i], dict)) else {}
        passed = item.get("passed")
        if isinstance(passed, str):
            passed = passed.strip().lower() == "true"
        if passed not in (True, False, None):
            passed = None
        evidence = item.get("evidence")
        if evidence is None:
            evidence = ""
        out.append({"text": item.get("text", t), "passed": passed, "evidence": str(evidence)})
    return out


def _grading_failed(rows: list[dict[str, Any]]) -> bool:
    if not rows:
        return True
    return all(str(r.get("evidence", "")).startswith("grading failed:") for r in rows)


def grade_case(
    case: dict[str, Any],
    output: str,
    *,
    bin_path: str,
    timeout: int | None,
    model: str | None,
    agent: str | None = None,
    grade: str,
    fallback_model: str | None = None,
    transcripts: list[str] | None = None,
) -> list[dict[str, Any]]:
    if grade != "auto":
        return []
    assertions = case.get("assertions") or []
    case_prompt = _expand_run_id(str(case.get("prompt", "")))
    texts: list[str] = [
        _expand_run_id(str(a.get("text", "")) if isinstance(a, dict) else str(a))
        for a in assertions
    ]
    paths = [str(p) for p in (transcripts or []) if p]
    if paths:
        evidence = (
            "You are grading an eval case. The session transcripts "
            "(NDJSON, one JSON event per line, including tool calls and tool outputs) "
            "are at:\n" + "\n".join(paths) + "\n\n"
            "Do NOT read whole transcripts. Instead:\n"
            "1. grep/scan the transcripts for the tool names under test "
            "(list_memories, read_memory, write_memory, edit_memory) and for their "
            "results and errors.\n"
            "2. Read only the matching excerpts around those hits, not the whole file.\n"
            "3. Treat the real tool calls and outputs as primary evidence; do not rely "
            "only on the final answer text.\n\n"
        )
    else:
        evidence = (
            "You are grading an eval case. No session transcript was captured; use the "
            "actual output below as evidence.\n\n"
            f"ACTUAL OUTPUT:\n{str(output)[:8000]}\n\n"
        )
    grader_prompt = (
        "You are a grader, not an orchestrator. Do not emit a task contract or plan. "
        "Return ONLY the JSON array.\n\n"
        + evidence
        + f"CASE PROMPT:\n{case_prompt}\n\n"
        + f"EXPECTED:\n{case.get('expected_output', '')}\n\n"
        + "ASSERTIONS:\n"
        + "\n".join(f"- {t}" for t in texts)
        + "\n\nReturn ONLY a JSON array of objects with keys text, passed, evidence. "
        "No prose, no markdown fences, no explanation before or after. "
        "passed must be true or false. evidence must be a short quote or reason.\n"
    )
    grade_title = f"eval-grade-{case.get('id')}"

    def _grade(run_model: str | None) -> tuple[list[dict[str, Any]], int, str]:
        text, stderr, rc, _, _ = run_opencode(
            grader_prompt, bin_path, timeout, run_model, agent, title=grade_title
        )
        return _parse_grading(text, stderr, rc, texts), rc, text

    rows, rc, text = _grade(model)
    grading_fallback_used = False
    # A grader that timed out or produced nothing has no rows to inspect, so the
    # fallback also arms on a failed parse and on a rate-limited primary model.
    if (
        fallback_model
        and fallback_model != model
        and (rc == 124 or not text.strip() or _is_rate_limited(rc, text) or _grading_failed(rows))
    ):
        retried, _, _ = _grade(fallback_model)
        grading_fallback_used = True
        if not _grading_failed(retried):
            rows = retried
    for row in rows:
        row["grading_fallback_used"] = grading_fallback_used
    return rows


def parse_cases(spec: str, cases: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if spec.strip().lower() == "all":
        return list(cases)
    ids: set[int] = set()
    for part in spec.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            a, b = part.split("-", 1)
            for i in range(int(a), int(b) + 1):
                ids.add(i)
        else:
            ids.add(int(part))
    return [c for c in cases if c.get("id") in ids]


def aggregate(results: list[dict[str, Any]]) -> dict[str, Any]:
    total = len(results)
    passed_count = 0
    per_assertion: dict[str, dict[str, int]] = {}
    for r in results:
        grading = r.get("grading") or []
        if grading:
            all_true = all(g.get("passed") is True for g in grading) and len(grading) > 0
        else:
            all_true = r.get("rc") == 0 and not r.get("error")
        if all_true:
            passed_count += 1
        for g in grading:
            t = g.get("text")
            per_assertion.setdefault(t, {"passed": 0, "total": 0})
            per_assertion[t]["total"] += 1
            if g.get("passed") is True:
                per_assertion[t]["passed"] += 1
    avg = sum(r.get("elapsed", 0) for r in results) / total if total else 0.0
    return {
        "total": total,
        "passed": passed_count,
        "failed": total - passed_count,
        "avg_elapsed": round(avg, 3),
        "per_assertion": per_assertion,
    }


def execute_cases(
    selected: list[dict[str, Any]],
    skill_dir: Path,
    args: argparse.Namespace,
    ts: str | None = None,
) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as ex:
        future_map = {
            ex.submit(
                run_case,
                c,
                skill_dir,
                args.opencode_bin,
                args.timeout,
                args.model,
                args.agent,
                ts,
                args.fallback_model,
                args.max_turns,
            ): c
            for c in selected
        }
        for fut in as_completed(future_map):
            r = fut.result()
            case = next(x for x in selected if x.get("id") == r["id"])
            r["grading"] = grade_case(
                case,
                r["output"],
                bin_path=args.opencode_bin,
                timeout=args.timeout,
                model=args.grader_model,
                agent=args.grader_agent,
                grade=args.grade,
                fallback_model=args.grader_fallback_model,
                transcripts=r.get("transcripts") or [],
            )
            results.append(r)
            if not args.quiet:
                print(
                    f"case {r['id']} done rc={r['rc']} turns={r.get('turns')} {r['elapsed']}s",
                    file=sys.stderr,
                )
                for path in r.get("transcripts") or []:
                    print(f"  transcript: {path}", file=sys.stderr)
    results.sort(key=lambda x: (x.get("id") is None, x.get("id")))
    return results


def write_results_file(
    out_path: Path,
    data: dict[str, Any],
    skill_dir: Path,
    results: list[dict[str, Any]],
    ts: str,
) -> None:
    summary = aggregate(results)
    payload = {
        "skill": data.get("skill_name", skill_dir.name),
        "skill_dir": str(skill_dir),
        "timestamp": ts,
        "summary": summary,
        "cases": results,
    }
    out_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")


def try_write_back(evals_path: Path, results: list[dict[str, Any]]) -> None:
    try:
        fresh = json.loads(evals_path.read_text(encoding="utf-8"))
        by_id = {r["id"]: r.get("grading", []) for r in results}
        for case in fresh.get("evals", []):
            cid = case.get("id")
            if cid not in by_id:
                continue
            gmap = {g.get("text"): g for g in by_id[cid]}
            for a in case.get("assertions", []) or []:
                t = a.get("text") if isinstance(a, dict) else str(a)
                if t in gmap:
                    a["passed"] = gmap[t].get("passed")
                    a["evidence"] = gmap[t].get("evidence")
        evals_path.write_text(json.dumps(fresh, indent=2, ensure_ascii=False), encoding="utf-8")
    except Exception as e:  # pragma: no cover - best effort
        print(f"write-back failed: {e}", file=sys.stderr)


def print_summary(results: list[dict[str, Any]], summary: dict[str, Any], out_path: Path) -> None:
    print(f"{'ID':>3} {'STATUS':<6} {'ELAPSED':>8} {'ASSERT':>8}")
    for r in results:
        grading = r.get("grading") or []
        if grading:
            ap = sum(1 for g in grading if g.get("passed") is True)
            at = len(grading)
            status = "PASS" if (at > 0 and ap == at) else "FAIL"
        else:
            status = "PASS" if (r.get("rc") == 0 and not r.get("error")) else "FAIL"
            ap, at = 0, 0
        print(f"{r.get('id'):>3} {status:<6} {r.get('elapsed', 0):>8.2f} {ap}/{at}")
    print(
        f"\nTotal: {summary['total']} Passed: {summary['passed']} "
        f"Failed: {summary['failed']} Avg elapsed: {summary['avg_elapsed']}s"
    )
    print(f"Run id: {run_id}")
    print(f"Results: {out_path}")


def resolve_runtime_config(args: Any, skill_dir: Path, root: Path) -> None:
    config = discover_config(skill_dir, root, args.config)
    raw_oc = config.get("opencode")
    ocfg: dict[str, Any] = raw_oc if isinstance(raw_oc, dict) else {}
    raw_rc = config.get("run")
    rcfg: dict[str, Any] = raw_rc if isinstance(raw_rc, dict) else {}

    def _pick(cli_val: Any, env_key: str | None, cfg_val: Any, default: Any) -> Any:
        if cli_val is not None:
            return cli_val
        if env_key:
            env_val = os.environ.get(env_key)
            if env_val not in (None, ""):
                return env_val
        if cfg_val is not None:
            return cfg_val
        return default

    args.model = _pick(args.model, "OPENCODE_EVAL_MODEL", ocfg.get("model"), "local/spark-x2.5-4b")
    args.agent = _pick(args.agent, "OPENCODE_EVAL_AGENT", ocfg.get("agent"), None)
    args.fallback_model = _pick(
        args.fallback_model, "OPENCODE_EVAL_FALLBACK_MODEL", ocfg.get("fallback_model"), None
    )
    args.grader_model = _pick(
        args.grader_model,
        "OPENCODE_EVAL_GRADER_MODEL",
        ocfg.get("grader_model"),
        "local/spark-x2.5-4b",
    )
    args.grader_fallback_model = _pick(
        args.grader_fallback_model,
        "OPENCODE_EVAL_GRADER_FALLBACK_MODEL",
        ocfg.get("grader_fallback_model"),
        None,
    )
    # Empty string means "no --agent flag", so the grader runs on the default agent.
    args.grader_agent = (
        _pick(
            getattr(args, "grader_agent", None),
            "OPENCODE_EVAL_GRADER_AGENT",
            ocfg.get("grader_agent"),
            None,
        )
        or None
    )
    args.opencode_bin = _pick(args.opencode_bin, None, ocfg.get("bin"), "opencode")
    args.timeout = _pick(args.timeout, None, rcfg.get("timeout"), None)
    args.workers = _pick(args.workers, None, rcfg.get("workers"), 1)
    args.max_turns = _pick(args.max_turns, None, rcfg.get("max_turns"), 2)
    args.grade = _pick(args.grade, None, rcfg.get("grade"), "auto")


def run_list_free_models(bin_path: str) -> int:
    try:
        proc = subprocess.run([bin_path, "models"], capture_output=True, text=True, timeout=60)
    except FileNotFoundError:
        print(f"opencode binary not found: {bin_path}", file=sys.stderr)
        return 0
    for line in (proc.stdout or "").splitlines():
        if "free" in line.lower():
            print(line)
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="Run skill evals via OpenCode CLI")
    ap.add_argument("--skill", required=False)
    ap.add_argument(
        "--list-free-models",
        "--discover-models",
        action="store_true",
        dest="list_free_models",
        help="List opencode models whose name contains 'free' and exit.",
    )
    ap.add_argument("--eval-set", default="evals/evals.json")
    ap.add_argument("--cases", default="all")
    ap.add_argument("--workers", type=int, default=None)
    ap.add_argument("--timeout", type=int, default=None)
    ap.add_argument("--max-turns", type=int, default=None)
    ap.add_argument("--model", default=None)
    ap.add_argument("--fallback-model", default=None)
    ap.add_argument("--agent", default=None)
    ap.add_argument("--grader-model", default=None)
    ap.add_argument("--grader-fallback-model", default=None)
    ap.add_argument(
        "--grader-agent",
        default=None,
        help="Agent for the grader call; unset or empty uses the default agent.",
    )
    ap.add_argument("--grade", choices=["auto", "none"], default=None)
    ap.add_argument("--config", default=None)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--output", default=None)
    ap.add_argument("--opencode-bin", default=None)
    ap.add_argument("--write-back", action="store_true")
    ap.add_argument("--quiet", action="store_true")
    args = ap.parse_args()

    if args.list_free_models:
        return run_list_free_models(args.opencode_bin or "opencode")

    if not args.skill:
        ap.error("--skill is required unless --list-free-models is given")

    root = find_project_root()
    skill_dir = resolve_skill(args.skill, root)

    resolve_runtime_config(args, skill_dir, root)

    if not args.quiet:
        print(
            f"config: run_id={run_id} model={args.model} agent={args.agent} "
            f"fallback={args.fallback_model} grader={args.grader_model} "
            f"grader_fallback={args.grader_fallback_model} grader_agent={args.grader_agent} "
            f"timeout={args.timeout} workers={args.workers} max_turns={args.max_turns}",
            file=sys.stderr,
        )

    data, evals_path = load_evals(skill_dir, args.eval_set)
    cases = data.get("evals", [])
    selected = parse_cases(args.cases, cases)

    if args.dry_run:
        for c in selected:
            print(f"===== CASE {c.get('id')} =====")
            print(build_case_prompt(skill_dir, c))
        return 0

    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    skill_name = skill_dir.name
    if args.output:
        out_path = Path(args.output)
        if not out_path.is_absolute():
            out_path = skill_dir / out_path
    else:
        out_path = skill_dir / "evals" / "results" / f"{skill_name}-{ts}.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)

    results = execute_cases(selected, skill_dir, args, ts)
    write_results_file(out_path, data, skill_dir, results, ts)

    if args.write_back:
        try_write_back(evals_path, results)

    summary = aggregate(results)
    print_summary(results, summary, out_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
