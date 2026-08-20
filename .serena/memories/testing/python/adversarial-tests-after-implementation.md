# Adversarial Tests After Implementation

Tests written after implementation still pay off when they are adversarial. Round-trip tests against `render_html` (JSON.parse the embedded payload fed hostile content) caught two real bugs a straight implementation pass missed: boilerplate heading leaking into summaries, and the invalid `\!--` JSON escape.

Lesson: post-hoc tests should probe hostile inputs and round-trips, not just happy paths. Related: `mem:testing/python-patterns`.