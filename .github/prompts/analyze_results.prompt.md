# Analyze Experiment Results

Use this prompt when you need to analyze the outcome of an experiment.

## Instructions

You have access to:
- The GitHub issue with the experiment hypothesis
- The PR comments with test/lint results
- The eval report (if posted as a comment)

For the experiment, answer:

1. **Did tests pass?** (100% required)
2. **Did lint pass?** (0 errors required)
3. **Which eval cases improved?** List case names.
4. **Which eval cases regressed?** List case names and reason.
5. **Latency change**: did avg latency increase by more than 20%?
6. **Simplicity**: is the change simpler, equivalent, or more complex?

**Overall decision**: ACCEPT or REJECT, with a one-sentence rationale.

Post your decision as a comment on the issue using `gh issue comment`.
