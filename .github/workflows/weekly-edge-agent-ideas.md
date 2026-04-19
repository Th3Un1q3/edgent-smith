---
name: weekly-edge-agent-ideas
description: Weekly exploration of recent ML papers and summarization for edge agent architecture.
on:
  schedule: weekly
permissions:
  contents: read
  issues: read
  pull-requests: read
tools:
  web-fetch:
  cache-memory: true
  github:
    toolsets: [default]
safe-outputs:
  jobs:
    push-to-main:
      description: "Commit updated docs/ideas.md to main"
      runs-on: ubuntu-latest
      permissions:
        contents: write
      inputs:
        file_path:
          description: "Path to the file to update"
          required: true
          type: string
        file_content:
          description: "Base64-encoded file content (UTF-8)"
          required: true
          type: string
      steps:
        - name: Checkout
          uses: actions/checkout@v4
          with:
            fetch-depth: 0
        - name: Extract push_to_main item
          id: extract
          run: |
            set -euo pipefail
            if [ ! -f "$GH_AW_AGENT_OUTPUT" ]; then
              echo "no_item=true" >> $GITHUB_OUTPUT
              exit 0
            fi
            FILE_PATH=$(jq -r ".items[] | select(.type==\"push_to_main\") | .file_path" "$GH_AW_AGENT_OUTPUT" | head -n1)
            FILE_CONTENT=$(jq -r ".items[] | select(.type==\"push_to_main\") | .file_content" "$GH_AW_AGENT_OUTPUT" | head -n1)
            if [ -z "$FILE_PATH" ] || [ "$FILE_PATH" = "null" ]; then
              echo "no_item=true" >> $GITHUB_OUTPUT
              exit 0
            fi
            echo "file_path=$FILE_PATH" >> $GITHUB_OUTPUT
            echo "file_content=$FILE_CONTENT" >> $GITHUB_OUTPUT
        - name: Write file
          if: ${{ steps.extract.outputs.file_path }}
          env:
            OUT_FILE_PATH: ${{ steps.extract.outputs.file_path }}
            OUT_FILE_CONTENT: ${{ steps.extract.outputs.file_content }}
          run: |
            set -euo pipefail
            mkdir -p "$(dirname "$OUT_FILE_PATH")"
            echo "$OUT_FILE_CONTENT" | base64 --decode > "$OUT_FILE_PATH"
        - name: Commit and push to main
          if: ${{ steps.extract.outputs.file_path }}
          env:
            OUT_FILE_PATH: ${{ steps.extract.outputs.file_path }}
          run: |
            set -euo pipefail
            git config user.name "github-actions[bot]"
            git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
            git add "$OUT_FILE_PATH"
            if git diff --cached --quiet; then
              echo "No changes to commit"
            else
              git commit -m "Weekly Edge Agent Ideas — ${{ github.run_number }}"
              git push origin main
            fi
network:
  allowed:
    - huggingface.co
    - github
---

# Weekly Edge Agent Ideas

You are an AI agent that explores recent machine-learning research and summarizes insights relevant to our edge agent architecture.

## Your Task

- Fetch the Hugging Face monthly papers index for the current month (for example: https://huggingface.co/papers/month/2026-04). Compute the current year-month dynamically and use the index page for the current month.
- From that index, consider up to the top 12 papers added this month. For each paper:
  - Fetch the paper page and any linked PDF/arXiv page.
  - Extract title, authors, abstract/summary, and links.
  - Produce 3 concise technical insights (bullet points).
  - Provide 2 short notes about applicability to our edge agent architecture (latency, model size, memory, communication, safety, tooling/MCP patterns).
  - Suggest 1 pragmatic next step (e.g., "prototype quantized model", "add benchmark", "write a small integration example").
- Use `cache-memory` to avoid re-processing papers already seen. Store processed paper IDs in `/tmp/gh-aw/cache-memory/seen-papers.json`.
- If there are new, relevant items, update `docs/ideas.md` by producing the updated file content and emitting a `push_to_main` safe output item with these fields:
  - `file_path`: `docs/ideas.md`
  - `file_content`: Base64-encoded UTF-8 content of the updated `docs/ideas.md` file.
  The `push_to_main` safe output will commit and push the updated file directly to the `main` branch. If direct push is not permitted by repository policy, call `create-pull-request` instead as a fallback.
- If nothing new or relevant is found, call the `noop` safe output with message "No new ideas this run." and do not open a PR.

## Output Format

- Top-level heading with the run date.
- For each paper:
  - `### Title` — [paper link](url)
  - Authors: ...
  - Key insights: (3 bullets)
  - Applicability: (2 bullets)
  - Recommended next step: (1 bullet)

## Safe outputs

- Emit `push_to_main` with `file_path` and `file_content` (base64) to commit changes directly to `main`.
- If direct push is blocked by repository policy, the agent may emit `create-pull-request` as a fallback.
- If there is nothing to add, call `noop`.

## Usage

To validate and compile locally:

1. `gh aw compile weekly-edge-agent-ideas`
2. `gh aw run weekly-edge-agent-ideas` or trigger manually via the GitHub UI.
