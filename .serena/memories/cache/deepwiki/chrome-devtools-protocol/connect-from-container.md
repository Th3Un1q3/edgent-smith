# deepwiki ask_question answer
source: deepwiki ask_question (repoName: microsoft/vscode)
query: How to connect to a browser running on the host machine from inside a container?
fetched: 2026-08-06

You are asking about how to connect to a browser running on the host machine from inside a container, specifically within the context of the VS Code integrated browser. The codebase provides mechanisms for handling remote connections and proxying browser requests in remote workspaces. 

The core idea is that when VS Code is running in a remote environment (like a container or Codespace), the integrated browser can be configured to proxy its requests through the remote connection to access resources on the remote host. 

Here's how it works:
*   **Remote Proxy for Browser Requests**: The `workbench.browser.enableRemoteProxy` setting, when enabled, allows browser requests in remote workspaces to be proxied through the remote connection.  This enables web pages opened in the integrated browser to access resources available on the remote host. 
*   **Localhost URL Rewriting**: When opening a URL in the integrated browser from a remote workspace, if the URL points to `localhost`, it might be rewritten to a forwarded local address.  This is crucial because the integrated browser, running locally on the host, wouldn't be able to directly reach the remote's `localhost` without this rewriting.  The `rewriteRemoteLocalhostUrl` function handles this rewriting.  A notice is also provided to the user if such a rewrite occurs. 
*   **Tunnel Proxy**: A tunnel proxy is applied to the page's session when a page needs to load as if from a remote machine (e.g., forwarded `localhost` in a remote workspace or container).  Credentials for this proxy come from the extension host.  The `BrowserViewMainService` acquires and releases this tunnel proxy for each browser view. 
*   **Dev Container Configuration**: For development containers, the `.devcontainer/README.md` and `.devcontainer/devcontainer.json` files show how VNC is used to access a desktop environment running inside the container, which can then display applications, including browsers, running within that environment.  While this is a way to interact with a browser *inside* the container, the integrated browser feature described above focuses on the containerized VS Code accessing a browser on the *host* or a remote machine.

In summary, to connect to a browser running on the host machine from inside a container using the integrated browser, you would enable the `workbench.browser.enableRemoteProxy` setting. This allows the integrated browser to proxy requests through the remote connection, and `localhost` URLs will be rewritten to ensure connectivity. 

## Notes
The `extensions/simple-browser/src/extension.ts` file mentions `enabledHosts` including `localhost` and `127.0.0.1` , and `src/vs/workbench/contrib/browserView/common/browserView.ts` prepends `http://` to bare `localhost` authorities . These snippets are related to handling `localhost` URLs but are not directly about the remote proxying mechanism for connecting a browser *from* a container *to* the host.

View this search on DeepWiki: https://deepwiki.com/search/how-to-connect-to-a-browser-ru_1acf5209-74be-431f-b8d0-b7aa0679980e
