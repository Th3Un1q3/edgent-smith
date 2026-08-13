# Retro Question Design for AI-Agent Session Retros

Goal: replace the 5 vague questions in `.opencode/commands/sessions/retrospect.md` with evidence-eliciting, non-blamey, AI-specific open questions.

## Framework findings
- Start/Stop/Continue: every sticky maps to a behavior change; action-oriented; low overhead; misses emotional/reflective depth.
- 4Ls (Liked/Learned/Lacked/Longed-for): Learned column uniquely surfaces growth; balances reflection + improvement; needs facilitation to convert to action.
- Mad-Sad-Glad: emotions first, post-incident; less directly actionable.
- Sailboat: forward-looking risks (rocks ahead); DAKI (Drop/Add/Keep/Improve): granular, every item maps to an action type.
- WWW/EBI (What Went Well / Even Better If): positive + improvement framing, avoids blame.
- Match format to context; blend formats; categories are prompts, not rigid structure.

## Open-question principles
- Open-ended invites explanation not confirmation: ask how/what/when, never yes/no.
- Walk-me-through phrasing elicits narrative + reasoning + context.
- Demand concrete evidence: names, events, counts, file paths — not adjectives.
- Neutral framing avoids defensiveness ("What would you do differently if you could do it again?" is the canonical neutral post-mortem phrasing).
- Sequence: what happened -> so what -> now what (evidence, interpretation, commitment).

## Action-item conversion (kollabe + easyagile)
- Limit 1-3 action items per retro; one if follow-through is weak.
- Specificity test: a new team member with no context knows what, who, when.
- Write only after 3 questions answered: who owns it, what exactly, when done.
- Vote on candidate action items, not just problems; track at next retro; rolled-over item = systemic signal.

## AI-agent-specific (robertsahlin AI Retrospective)
- Retro covers the HOW not the WHAT: process over output.
- Route lessons into enforced artifacts: behavioral improvements -> context/workflow files; tech-debt log; feature backlog.
- Enforce lessons as a mandatory review gate (agent blocked until fixes incorporated) — matches harness-management + restart pattern.

## Cached sources
- mem:cache/tavily/retro-frameworks/retrospective-question-frameworks-start-stop-continue-four-l
- mem:cache/tavily/good-open-questions/what-makes-a-good-open-ended-question-interview-research-eli
- mem:cache/tavily/retro-action-items/turn-retrospective-findings-into-action-items-prioritized-si
- mem:cache/tavily/eng-postmortem-questions/software-engineering-postmortem-retrospective-questions-what
- mem:cache/tavily/ai-agent-retro/ai-coding-agent-session-retrospective-reflection-prompt-less
- mem:cache/fetch/kollabe-com/posts-retrospective-formats-compared
- mem:cache/fetch/kollabe-com/posts-retrospective-action-items
- mem:cache/fetch/www-easyagile-com/blog-improve-sprint-retrospective-action-items
- mem:cache/fetch/robertsahlin-substack-com/p-the-ai-retrospective
- mem:cache/fetch/easyretro-io/templates-post-mortem-retrospective