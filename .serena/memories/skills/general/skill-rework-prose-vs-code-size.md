# Skill Rework: Measure Prose vs Code Size Separately

Snippet-heavy workflow files have a higher size floor than prose-only siblings and should not be judged against sibling averages. The browser-automation-devtools workflow (rework 2026-08-13) stayed at ~560 lines while its siblings average ~67 (refinement-discovery 51, scripting-workflow 114, setup 35): ~400 lines are load-bearing code snippets (worked `evaluate_script` JS, truncation examples) that cannot shrink without destroying the file's function as a snippet library.

When sizing a rework target, count PROSE lines and CODE lines separately; only prose is a shrink candidate. A workflow that doubles as a snippet library is judged by snippet completeness, not line count — staying 5-10x the sibling average is expected, not a rework failure.

Source: file state observed 2026-08-19; rework context provided by operator.