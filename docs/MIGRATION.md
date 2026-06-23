# Migration Guide: From Cloud Assistants to Sovereign Agentic Systems

## Introduction
This document outlines the transition from cloud-based AI assistants (e.g., GitHub Copilot) to a sovereign, offline agentic development setup using OpenCode. The primary driver for this migration is the need to overcome context flooding issues and ensure privacy by moving from proprietary, cloud-dependent models to a locally hosted, isolated agentic environment.

## Architecture Overview
The current system is built upon four essential pillars designed to provide a performant and reliable local development experience.

### 1. Local LLM and Backend
To avoid the performance bottlenecks of large, unoptimized models, the system utilizes efficient local inference engines. 
- **Core Stack**: LM Studio with quantized models (e.g., Gemma 4) provides hardware acceleration and faster generation compared to standard Ollama setups for specific consumer-grade hardware.
- **Optimization**: The architecture focuses on avoiding "quantization mismatch" to ensure memory efficiency without sacrificing logical reasoning capabilities.

### 2. System Resources
Effective agentic workflows require high system responsiveness and efficient resource allocation.
- **Virtualization**: Moving away from heavy container runtimes like Docker Desktop towards more efficient solutions (e.g., Apple Virtualization Framework or OrbStack) allows for better memory reclamation and side-by-side performance of the host OS and the agentic environment.

### 3. Agentic Architecture
The system employs an incremental context discovery mechanism to manage the limitations of local models.
- **Core Stack**: OpenCode paired with advanced workflow management (e.g., OpenAgentsControl) allows for structured task execution and robust error handling, avoiding the "lazy" behavior often observed in smaller models.

### 4. Tooling Gateway
A specialized gateway facilitates interaction between the agent and various MCP (Model Context Protocol) servers.
- **Core Stack**: The Docker MCP Gateway enables "Code Mode," allowing agents to chain multiple tools in a single execution cycle, truncate responses to prevent context flooding, and focus on relevant search results.

## Key Challenges & Solutions

### Challenge: Context Management and Plugin Conflicts
A significant conflict arises between high-capability plugins like `oh-my-opencode` and context management tools such as `@tarquinen/opencode-dcp`. When both are active, they can enter a circular dependency loop that causes massive context bloat and confuses the agent.
- **Solution**: These configurations must be carefully managed via `opencode.jsonc` to ensure that tool descriptions and context extensions do not overwhelm the model's reasoning window.

### Challenge: Model Behavior (Laziness)
Smaller, locally hosted models often exhibit "laziness," such as failing to complete complex tasks or giving up immediately upon encountering the first error instead of troubleshooting.
- **Solution**: The system implements "pushes"—structured instruction patterns that explicitly guide the agent to verify task completion, use specific skills, and utilize correct filepaths.

## Troubleshooting & Best Practices

### Managing Model Interaction
- **Use "Pushes"**: When working with smaller models, use explicit instructions to enforce rigor (e.g., "Ensure all TODOs are addressed" or "Verify the file path before executing").
- **Monitor Context**: Watch for context flooding. If an agent's performance degrades, it may be due to excessive tool descriptions or accumulated conversation history.

### Managing Environment and Plugins
- **DevContainer Isolation**: Utilize DevContainers to maintain a clean, reproducible environment. If plugin conflicts or configuration errors arise, rebuilding the container is often more efficient than manual uninstallation.
- **Plugin Configuration**: When troubleshooting agent behavior, review `opencode.jsonc` to ensure that plugins like `oh-my-openagent` are not causing unintended context bloat.
