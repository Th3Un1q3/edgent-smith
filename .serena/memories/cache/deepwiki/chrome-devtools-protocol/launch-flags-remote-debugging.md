# deepwiki ask_question answer
source: deepwiki ask_question (repoName: microsoft/vscode)
query: How to launch Chrome with --remote-debugging-port and connect from another machine?
fetched: 2026-08-06

You are asking how to launch Chrome with the `--remote-debugging-port` flag and connect to it from another machine. The provided codebase context, specifically within the `microsoft/vscode` repository, offers insights into how VS Code itself launches and interacts with Chromium-based debug targets using the Chrome DevTools Protocol (CDP) .

To launch Chrome (or a Chromium-based application like VS Code's Electron shell) with remote debugging enabled, you need to pass the `--remote-debugging-port` command-line argument . For example, in the context of launching VS Code for development and automation, the `launch.sh` script uses this flag .

To connect from another machine, the `--remote-debugging-port` needs to be exposed on a network interface accessible from that machine. By default, it often binds to `127.0.0.1` (localhost), meaning it's only accessible from the same machine . To make it accessible from other machines, you would typically need to:

1.  **Launch Chrome with `--remote-debugging-address=0.0.0.0`**: This flag tells Chrome to listen on all available network interfaces, making it accessible from other machines on the network. This specific flag is not explicitly shown in the provided snippets, but it's a standard Chromium command-line argument for remote access.
2.  **Ensure Network Accessibility**: Firewall rules on the machine running Chrome must allow incoming connections on the specified `--remote-debugging-port`.
3.  **Connect using the IP Address and Port**: From the other machine, you would then connect to `http://<IP_ADDRESS_OF_CHROME_MACHINE>:<PORT>/json/version` to access the CDP endpoint.

The `microsoft/vscode` codebase demonstrates how to launch a VS Code instance with remote debugging enabled and then connect to it locally using `@playwright/cli` . The `launch.sh` script, for instance, launches Code OSS with `--remote-debugging-port` and then waits for the CDP endpoint to become responsive by attempting to `curl` the `/json/version` endpoint on `127.0.0.1` .

While the provided code focuses on local connections, the principle for remote connections remains the same: launch with the debugging port and ensure network access.

## Notes

The provided snippets primarily illustrate how VS Code's internal development and testing tools launch and interact with its own Chromium-based renderer process for debugging and automation. The `launch.sh` and `launch.ps1` scripts are used to launch Code OSS with various debugging ports, including `cdpPort` for the renderer, `extHostPort` for the extension host, `mainPort` for the main Electron process, and `agentHostPort` for the agent host process . The `debugExtensionHostAction.ts` file also shows actions within VS Code to debug the renderer and extension host, which internally use a "chrome" debug type for the renderer . The `debug-server-ready/package.json` file defines configurations for debugging with Chrome or Edge, but it doesn't directly address remote connections from another machine .

Wiki pages you might want to explore:
- [Core Architectural Layers (microsoft/vscode)](/wiki/microsoft/vscode#1.2)

View this search on DeepWiki: https://deepwiki.com/search/how-to-launch-chrome-with-remo_29aee0eb-a2cf-4e7a-933f-ee14d3cd78e7
