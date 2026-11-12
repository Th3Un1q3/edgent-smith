# Reverse Engineering Timestamp

## Run Record

- Date: 2026-11-12
- Commit: f50f410532776a9c10dd7d9b5c3133a06ba80b3e

## Scope of Analysis

```yaml
scope_version: 1
kind: full
intent: 261112-quality-gate-synthetic
fingerprint: 97157f6b738e9226e6019528c4b0dc5ba530d0bb
analyzed:
  paths:
    - ./
  components:
    - Edge Agent Runtime
    - Model Configuration Registry
    - Evaluation Runner
    - CLI Service Agents
    - Experiment Runner Scripts
    - Conductor Workflows
    - CI Gate Runner
    - Task Runner Recipes
    - Agent Utils Scripts
    - OpenCode Plugin Host
    - Quality Gate Enforcer
    - Instructions Loader
    - Goal Continuation
    - Tool Limit Reminder
    - Workflow Subtask Plugin
    - Harness Configuration
    - Project Instruction Set
    - OpenCode Harness Agents
    - Copilot Custom Agents
    - AI-DLC Quality Gate Plugin
    - DevContainer Environment
    - DSH Harness Configuration
    - MCP Gateway Catalog
shallow:
  paths:
    - agents/edge_tracing.py
    - cli/commands/
    - cli/services/
    - evals/cases/
    - evals/claims/
    - evals/entities/
    - scripts/
    - tests/
    - .agents/skills/
    - .dsh/settings.yaml
    - .dsh/cordis.patch.yml
    - .dsh/child-runtime/
    - .github/prompts/
    - .github/copilot/
    - docs/
    - aidlc-plugins/quality-gates/contributions/
    - automa-workflows/
    - templates/untrusted-code-sandbox/
    - stubs/zstandard/
```
