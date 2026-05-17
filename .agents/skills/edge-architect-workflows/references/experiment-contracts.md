# Reference: Experiment Contracts

Use this reference when the task is to create and submit exactly one experiment.

## Experiment Spec Output Contract

Return exactly one Markdown experiment spec in plain text.

- The first line must be an H1 starting with `experiment:` followed by a short title.
- Include these headings exactly:
  - `Hypothesis`
  - `Motivation`
  - `Type`
  - `Mutation surface`
  - `Implementation Instructions`
  - `Validation(code, prompts, tasks)`
  - `Anticipated missteps and fallbacks`
  - `Sources`
  - `Notes`

## Experiment Submission Contract

Submit the finished experiment exactly once with:

```bash
just autoresearch experiment create --title "<title>" --description "<markdown body>"
```