# Capability Fallbacks

## Capability fallbacks

The core workflow assumes the harness can spawn separate reviewers for test runs and can open a browser. Where the environment cannot spawn a separate reviewer, a human performs the pass. Adapt the mechanics accordingly:

**Running test cases**: Where separate reviewer runs are unavailable, for each test case read the skill's SKILL.md, then follow its instructions to accomplish the test prompt yourself. Do them one at a time. This is less rigorous than independent runs, but the human review step compensates. Skip the baseline runs — just use the skill to complete the task as requested.

**Reviewing results**: Where the environment cannot open a browser, skip the browser reviewer entirely. Instead, present results directly in the conversation. For each test case, show the prompt and the output. If the output is a file the user needs to see (like a .docx or .xlsx), save it to the filesystem and tell them where it is so they can download and inspect it. Ask for feedback inline: "How does this look? Anything you'd change?"

**Benchmarking**: Where separate reviewer runs are unavailable, skip the quantitative benchmarking and focus on qualitative feedback from the user.

**The iteration loop**: Same as before — improve the skill, rerun the test cases, ask for feedback — just without the browser reviewer in the middle. You can still organize results into iteration directories on the filesystem if you have one.

**Description optimization**: Where the optimization loop cannot run, have the user review and adjust the description by hand.

**Blind comparison**: Where separate reviewers are unavailable, skip it.

**Packaging**: The `package_skill.py` script works anywhere with Python and a filesystem. Where the environment cannot deliver files to the user, the user downloads the resulting `.skill` file from the output path.

**Updating an existing skill**: The user might be asking you to update an existing skill, not create a new one. In this case:
- **Preserve the original name.** Note the skill's directory name and `name` frontmatter field -- use them unchanged. E.g., if the installed skill is `research-helper`, output `research-helper.skill` (not `research-helper-v2`).
- **Copy to a writeable location before editing.** The installed skill path may be read-only. Copy to `/tmp/skill-name/`, edit there, and package from the copy.
- **If packaging manually, stage in `/tmp/` first**, then copy to the output directory -- direct writes may fail due to permissions.

---

## Headless environments

Where the environment has no browser or display, write the review viewer to a standalone HTML file with `--static <output_path>` and give the user the path to open in their own browser. The viewer's "Submit All Reviews" button then downloads `feedback.json`; read it from there. Generate the eval viewer before revising the skill yourself — get examples in front of the human first. `package_skill.py` needs only Python and a filesystem.
