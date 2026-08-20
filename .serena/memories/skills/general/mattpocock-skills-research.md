# mattpocock/skills Research Summary

First research on the mattpocock/skills library (fresh topic — no prior memory; source: skill-quality research campaign).

- 224k stars, MIT licensed; positioning: "skills for real engineers".
- 35 skills; median SKILL.md under ~600 words — progressive disclosure (root stays lean; detail pushed to references).
- Description dialects: user-invoked skills get a human one-liner description; model-invoked skills get trigger-rich descriptions.
- "Done when:" completion criteria and hard gates close each skill; failure-mode-driven design (each rule exists because an observed failure mode caused it).
- Composability via explicit Skill-tool calls (one skill invokes another as a tool); "sprawl is the failure mode" — adding unrelated rules degrades a skill.
- Leading words + positive prompting; no-op pruning (rules that never change behavior get cut).
- Honest limits: "It's working if" states how the author verifies the skill works.

Related: mem:skills/general/mattpocock-skill-anti-patterns; mem:skills/general/skill-quality-advisory-verdict.