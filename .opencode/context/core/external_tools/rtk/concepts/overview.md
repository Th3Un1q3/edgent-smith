# Overview of rtk

**rtk** is a high-performance CLI proxy designed to reduce LLM token consumption by 60–90% on common development commands like `git status` or `ls -la`. It works as an auto-rewrite hook that intercepts and optimizes command output.

## Key Features
- **Token Reduction**: Condenses verbose outputs into highly efficient summaries.
- **Zero Dependencies**: Single Rust binary for high performance.
- **Multi-tool Support**: Optimized for Git, AWS CLI, Docker, Prisma, etc.

## Installation Pattern
For persistence in this project's DevContainer environment:
1. Add the installation command to `.devcontainer/setup-dev.sh`.
2. Example configuration (in `~/.config/rtk/config.toml`):
   ```toml
   [tee]
   enabled = true
   mode = "failures"
   ```

## Reference Documentation
For more details, refer to the [official rtk repository](https://github.com/rtk-ai/rtk).
