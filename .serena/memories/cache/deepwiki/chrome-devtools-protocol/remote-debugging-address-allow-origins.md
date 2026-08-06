# deepwiki ask_question answer
source: deepwiki ask_question (repoName: microsoft/vscode)
query: What do --remote-debugging-address and --remote-allow-origins do?
fetched: 2026-08-06

The `--remote-debugging-address` and `--remote-allow-origins` command-line arguments are used to configure remote debugging for VS Code's webview and browser-related components. The `--remote-debugging-port` argument is used to specify the port for remote debugging, as seen in the `testRemoteAgentHost.sh` script . While `--remote-debugging-address` and `--remote-allow-origins` are not explicitly defined in the provided snippets, they are standard Chromium command-line switches that control the address to listen on for remote debugging connections and the origins allowed to connect, respectively.

## `--remote-debugging-address`

This argument specifies the IP address or hostname that the debugging server should listen on. If not specified, it typically defaults to `127.0.0.1` (localhost).

## `--remote-allow-origins`

This argument controls which origins are allowed to connect to the remote debugging port. This is a security feature to prevent unauthorized access to the debugging interface. You would typically specify a comma-separated list of allowed origins.

## Usage Context

These arguments are relevant in scenarios where you need to debug browser-based components of VS Code, such as webviews or the integrated browser, especially in remote development environments. For example, the `testRemoteAgentHost.sh` script uses `--remote-debugging-port` to enable debugging for the Sessions app . This allows tools like `ab` (presumably a debugging client) to attach to the running application for inspection and debugging .

## Notes

The provided codebase snippets do not directly define or parse `--remote-debugging-address` or `--remote-allow-origins`. However, the presence of `--remote-debugging-port` in a test script  strongly suggests that VS Code leverages Chromium's remote debugging capabilities, which include these related arguments. These arguments are part of the Chromium command-line interface, which Electron (the framework VS Code is built on) uses.

Wiki pages you might want to explore:
- [VS Code Architecture Overview (microsoft/vscode)](/wiki/microsoft/vscode#1)
- [Remote Extension Host Server (microsoft/vscode)](/wiki/microsoft/vscode#13.1)

View this search on DeepWiki: https://deepwiki.com/search/what-do-remotedebuggingaddress_3554d7b7-72ed-49c0-aaca-a2c49298c845
