tool: fetch
url: https://github.com/ChromeDevTools/chrome-devtools-mcp
date: 2026-08-06
source: fetch

Contents of https://github.com/ChromeDevTools/chrome-devtools-mcp:
<p>GitHub - ChromeDevTools/chrome-devtools-mcp: Chrome DevTools for coding agents · GitHub</p>

Skip to content

## Navigation Menu

Sign inAppearance settingsSign in

Sign upAppearance settings

You signed in with another tab or window. Reload to refresh your session. You signed out in another tab or window. Reload to refresh your session. You switched accounts on another tab or window. Reload to refresh your session. Dismiss alert
### Uh oh!

There was an error while loading. Please reload this page.

ChromeDevTools / chrome-devtools-mcp Public

* Notifications You must be signed in to change notification settings
* Fork 3.4k
* Star 48.6k
BranchesTagsOpen more actions menu
## Folders and files

| Name | | Name | Last commit message | Last commit date |
| --- | --- | --- | --- | --- |
| Latest commitHistory 1,060 Commits 1,060 Commits | | |
| .claude-plugin | | .claude-plugin |
| .cursor-plugin | | .cursor-plugin |
| .gemini | | .gemini |
| .github | | .github |
| docs | | docs |
| scripts | | scripts |
| skills | | skills |
| src | | src |
| tests | | tests |
| .gitattributes | | .gitattributes |
| .gitignore | | .gitignore |
| .npmrc | | .npmrc |
| .nvmrc | | .nvmrc |
| .prettierignore | | .prettierignore |
| .prettierrc.cjs | | .prettierrc.cjs |
| .release-please-manifest.json | | .release-please-manifest.json |
| AGENTS.md | | AGENTS.md |
| CHANGELOG.md | | CHANGELOG.md |
| CONTRIBUTING.md | | CONTRIBUTING.md |
| LICENSE | | LICENSE |
| README.md | | README.md |
| SECURITY.md | | SECURITY.md |
| eslint.config.mjs | | eslint.config.mjs |
| gemini-extension.json | | gemini-extension.json |
| package-lock.json | | package-lock.json |
| package.json | | package.json |
| puppeteer.config.cjs | | puppeteer.config.cjs |
| release-please-config.json | | release-please-config.json |
| rollup.config.mjs | | rollup.config.mjs |
| server.json | | server.json |
| tsconfig.json | | tsconfig.json |

## Repository files navigation

# Chrome DevTools for agents

Chrome DevTools for agents (chrome-devtools-mcp) lets your coding agent (such as Antigravity, Claude, Cursor or Copilot) control and inspect a live Chrome browser. It acts as a Model-Context-Protocol (MCP) server, giving your AI coding assistant access to the full power of Chrome DevTools for reliable automation, in-depth debugging, and performance analysis. A CLI is also provided for use without MCP.

## Tool reference | Changelog | Contributing | Troubleshooting | Design Principles

## Key features

* Get performance insights: Uses Chrome DevTools to record traces and extract actionable performance insights.
* Advanced browser debugging: Analyze network requests, take screenshots and check browser console messages (with source-mapped stack traces).
* Reliable automation. Uses puppeteer to automate actions in Chrome and automatically wait for action results.

## Disclaimers

chrome-devtools-mcp exposes content of the browser instance to the MCP clients allowing them to inspect, debug, and modify any data in the browser or DevTools. Avoid sharing sensitive or personal information that you don't want to share with MCP clients.

chrome-devtools-mcp officially supports Google Chrome and Chrome for Testing only. Other Chromium-based browsers may work, but this is not guaranteed, and you may encounter unexpected behavior. Use at your own discretion. We are committed to providing fixes and support for the latest version of Extended Stable Chrome.

Performance tools may send trace URLs to the Google CrUX API to fetch real-user experience data. This helps provide a holistic performance picture by presenting field data alongside lab data. This data is collected by the Chrome User Experience Report (CrUX). To disable this, run with the --no-performance-crux flag.

## Usage statistics

Google collects usage statistics (such as tool invocation success rates, latency, and environment information) to improve the reliability and performance of Chrome DevTools MCP.

Data collection is enabled by default. You can opt-out by passing the --no-usage-statistics flag when starting the server:

```
"args": ["-y", "chrome-devtools-mcp@latest", "--no-usage-statistics"]
```

Google handles this data in accordance with the Google Privacy Policy.

Google's collection of usage statistics for Chrome DevTools MCP is independent from the Chrome browser's usage statistics. Opting out of Chrome metrics does not automatically opt you out of this tool, and vice-versa.

Collection is disabled if CHROME\_DEVTOOLS\_MCP\_NO\_USAGE\_STATISTICS or CI env variables are set.

## Update checks

By default, the server periodically checks the npm registry for updates and logs a notification when a newer version is available. You can disable these update checks by setting the CHROME\_DEVTOOLS\_MCP\_NO\_UPDATE\_CHECKS environment variable.

## Requirements

* Node.js LTS version.
* Chrome current stable version or newer.
* npm

## Getting started

Add the following config to your MCP client:

```
{ "mcpServers": { "chrome-devtools": { "command": "npx", "args": ["-y", "chrome-devtools-mcp@latest"] } } }
```

Note

Using chrome-devtools-mcp@latest ensures that your MCP client will always use the latest version of the Chrome DevTools MCP server.

If you are interested in doing only basic browser tasks, use the --slim mode:

```
{ "mcpServers": { "chrome-devtools": { "command": "npx", "args": ["-y", "chrome-devtools-mcp@latest", "--slim", "--headless"] } } }
```

See Slim tool reference.

### MCP Client configuration

### Your first prompt

Enter the following prompt in your MCP Client to check if everything is working:

```
Check the performance of https://developers.chrome.com
```

Your MCP client should open the browser and record a performance trace.

Note

The MCP server will start the browser automatically once the MCP client uses a tool that requires a running browser instance. Connecting to the Chrome DevTools MCP server on its own will not automatically start the browser.

## Tools

If you run into any issues, checkout our troubleshooting guide.

* Input automation (10 tools)
  
  + click
  + drag
  + fill
  + fill\_form
  + handle\_dialog
  + hover
  + press\_key
  + type\_text
  + upload\_file
  + click\_at
* Navigation automation (6 tools)
  
  + close\_page
  + list\_pages
  + navigate\_page
  + new\_page
  + select\_page
  + wait\_for
* Emulation (2 tools)
  
  + emulate
  + resize\_page
* Performance (3 tools)
  
  + performance\_analyze\_insight
  + performance\_start\_trace
  + performance\_stop\_trace
* Network (2 tools)
  
  + get\_network\_request
  + list\_network\_requests
* Debugging (8 tools)
  
  + evaluate\_script
  + get\_console\_message
  + lighthouse\_audit
  + list\_console\_messages
  + take\_screenshot
  + take\_snapshot
  + screencast\_start
  + screencast\_stop
* Memory (12 tools)
  
  + take\_heapsnapshot
  + close\_heapsnapshot
  + compare\_heapsnapshots
  + get\_heapsnapshot\_class\_nodes
  + get\_heapsnapshot\_details
  + get\_heapsnapshot\_dominators
  + get\_heapsnapshot\_duplicate\_strings
  + get\_heapsnapshot\_edges
  + get\_heapsnapshot\_object\_details
  + get\_heapsnapshot\_retainers
  + get\_heapsnapshot\_retaining\_paths
  + get\_heapsnapshot\_summary
* Extensions (5 tools)
  
  + install\_extension
  + list\_extensions
  + reload\_extension
  + trigger\_extension\_action
  + uninstall\_extension
* Third-party (2 tools)
  
  + execute\_3p\_developer\_tool
  + list\_3p\_developer\_tools
* WebMCP (2 tools)
  
  + execute\_webmcp\_tool
  + list\_webmcp\_tools

## Configuration

The Chrome DevTools MCP server supports the following configuration option:

* --autoConnect/ --auto-connect If specified, automatically connects to a browser (Chrome 144+) running locally from the user data directory identified by the channel param (default channel is stable). Requires the remote debugging server to be started in the Chrome instance via chrome://inspect/#remote-debugging.
  
  + Type: boolean
  + Default: false
* --browserUrl/ --browser-url, -u Connect to a running, debuggable Chrome instance (e.g. http://127.0.0.1:9222). For more details see: https://github.com/ChromeDevTools/chrome-devtools-mcp#connecting-to-a-running-chrome-instance.
  
  + Type: string
  + Default: false
* --wsEndpoint/ --ws-endpoint, -w WebSocket endpoint to connect to a running Chrome instance (e.g., ws://127.0.0.1:9222/devtools/browser/). Alternative to --browserUrl.
  
  + Type: string
  + Default: false
* --wsHeaders/ --ws-headers Custom headers for WebSocket connection in JSON format (e.g., '{"Authorization":"Bearer token"}'). Only works with --wsEndpoint.
  
  + Type: string
  + Default: false
* --headless Whether to run in headless (no UI) mode.
  
  + Type: boolean
  + Default: false
* --executablePath/ --executable-path, -e Path to custom Chrome executable.
  
  + Type: string
  + Default: false
* --isolated If specified, creates a temporary user-data-dir that is automatically cleaned up after the browser is closed. Defaults to false.
  
  + Type: boolean
  + Default: false
* --userDataDir/ --user-data-dir Path to the user data directory for Chrome. Default is $HOME/.cache/chrome-devtools-mcp/chrome-profile$CHANNEL\_SUFFIX\_IF\_NON\_STABLE
  
  + Type: string
  + Default: false
* --channel Specify a different Chrome channel that should be used. The default is the stable channel version.
  
  + Type: string
  + Choices: canary, dev, beta, stable
  + Default: false
* --logFile/ --log-file Path to a file to write debug logs to. Set the env variable DEBUG to \* to enable verbose logs. Useful for submitting bug reports.
  
  + Type: string
  + Default: false
* --viewport Initial viewport size for the Chrome instances started by the server. For example, 1280x720. In headless mode, max size is 3840x2160px.
  
  + Type: string
  + Default: false
* --proxyServer/ --proxy-server Proxy server configuration for Chrome passed as --proxy-server when launching the browser. See https://www.chromium.org/developers/design-documents/network-settings/ for details.
  
  + Type: string
  + Default: false
* --acceptInsecureCerts/ --accept-insecure-certs If enabled, ignores errors relative to self-signed and expired certificates. Use with caution.
  
  + Type: boolean
  + Default: false
* --experimentalPageIdRouting/ --experimental-page-id-routing Whether to expose pageId on page-scoped tools and route requests by page ID (useful for concurrent agent sessions).
  
  + Type: boolean
  + Default: false
* --experimentalDevtools/ --experimental-devtools Whether to enable automation over DevTools targets
  
  + Type: boolean
  + Default: false
* --experimentalVision/ --experimental-vision Whether to enable coordinate-based tools such as click\_at(x,y). Usually requires a computer-use model able to produce accurate coordinates by looking at screenshots.
  
  + Type: boolean
  + Default: false
* --memoryDebugging/ --memory-debugging, -experimentalMemory Whether to enable memory debugging tools.
  
  + Type: boolean
  + Default: false
* --experimentalStructuredContent/ --experimental-structured-content Whether to output structured formatted content.
  
  + Type: boolean
  + Default: false
* --experimentalIncludeAllPages/ --experimental-include-all-pages Whether to include all kinds of pages such as webviews or background pages as pages.
  
  + Type: boolean
  + Default: false
* --experimentalScreencast/ --experimental-screencast Exposes experimental screencast tools (requires ffmpeg). Install ffmpeg https://www.ffmpeg.org/download.html and ensure it is available in the MCP server PATH.
  
  + Type: boolean
  + Default: false
* --experimentalFfmpegPath/ --experimental-ffmpeg-path Path to ffmpeg executable for screencast recording.
  
  + Type: string
  + Default: false
* --categoryExperimentalWebmcp/ --category-experimental-webmcp Set to true to enable debugging WebMCP tools. Requires Chrome 150+ with the following flag: --enable-features=WebMCP
  
  + Type: boolean
  + Default: false
* --chromeArg/ --chrome-arg Additional arguments for Chrome. Only applies when Chrome is launched by chrome-devtools-mcp.
  
  + Type: array
  + Default: false
* --blockedUrlPattern/ --blocked-url-pattern Restricts browser's network access by blocking specified URL patterns (uses https://urlpattern.spec.whatwg.org/). Silently detaches from targets with blocked URLs upon connection, and blocks runtime requests (including navigations and subresources). Accepts an array of patterns.
  
  + Type: array
  + Default: false
* --allowedUrlPattern/ --allowed-url-pattern Restricts browser's network access by allowing only specified URL patterns (uses https://urlpattern.spec.whatwg.org/). Requires Chrome 149+. Silently detaches from targets with unallowed URLs upon connection, and blocks runtime requests (including navigations and subresources). Accepts an array of patterns.
  
  + Type: array
  + Default: false
* --ignoreDefaultChromeArg/ --ignore-default-chrome-arg Explicitly disable default arguments for Chrome. Only applies when Chrome is launched by chrome-devtools-mcp.
  
  + Type: array
  + Default: false
* --categoryEmulation/ --category-emulation Set to false to exclude tools related to emulation.
  
  + Type: boolean
  + Default: true
* --categoryPerformance/ --category-performance Set to false to exclude tools related to performance.
  
  + Type: boolean
  + Default: true
* --categoryNetwork/ --category-network Set to false to exclude tools related to network.
  
  + Type: boolean
  + Default: true
* --categoryExtensions/ --category-extensions Set to true to include tools related to extensions. Note: This feature is currently only supported with a pipe connection. autoConnect, browserUrl, and wsEndpoint are not supported with this feature until 149 will be released.
  
  + Type: boolean
  + Default: false
* --categoryExperimentalThirdParty/ --category-experimental-third-party Set to true to enable third-party developer tools exposed by the inspected page itself
  
  + Type: boolean
  + Default: false
* --performanceCrux/ --performance-crux Set to false to disable sending URLs from performance traces to CrUX API to get field performance data.
  
  + Type: boolean
  + Default: true
* --usageStatistics/ --usage-statistics Set to false to opt-out of usage statistics collection. Google collects usage data to improve the tool, handled under the Google Privacy Policy (https://policies.google.com/privacy). This is independent from Chrome browser metrics. Disabled if CHROME\_DEVTOOLS\_MCP\_NO\_USAGE\_STATISTICS or CI env variables are set.
  
  + Type: boolean
  + Default: true
* --screenshotFormat/ --screenshot-format Override the default output format used by take\_screenshot when the caller does not specify one. JPEG and WebP are ~3-5x smaller than PNG, which helps reduce context size in AI conversations. Unset preserves the existing default ("png").
  
  + Type: string
  + Choices: jpeg, png, webp
  + Default: false
* --screenshotQuality/ --screenshot-quality Override the default compression quality (0-100) used by take\_screenshot for JPEG and WebP when the caller does not specify one. Lower values mean smaller files. Ignored for PNG. Unset preserves the Puppeteer default.
  
  + Type: number
  + Default: false
* --screenshotMaxWidth/ --screenshot-max-width Maximum width in pixels for screenshots. If the captured image is wider, it is downscaled (preserving aspect ratio) before being returned. Reduces context size in AI conversations. Unset means no resize.
  
  + Type: number
  + Default: false
* --screenshotMaxHeight/ --screenshot-max-height Maximum height in pixels for screenshots. If the captured image is taller, it is downscaled (preserving aspect ratio) before being returned. Can be combined with --screenshot-max-width; the smaller scale factor wins. Unset means no resize.
  
  + Type: number
  + Default: false
* --slim Exposes a "slim" set of 3 tools covering navigation, script execution and screenshots only. Useful for basic browser tasks.
  
  + Type: boolean
  + Default: false
* --redactNetworkHeaders/ --redact-network-headers If true, redacts some of the network headers considered sensitive before returning to the client.
  
  + Type: boolean
  + Default: false
* --allowUnrestrictedPaths/ --allow-unrestricted-paths If set, disables the default path restriction that applies when the MCP client does not negotiate the roots capability. By default, file-writing tools are restricted to the OS temp directory when no roots are configured. Use this only when connecting a trusted local client that does not implement MCP roots and requires access to paths outside the temp directory.
  
  + Type: boolean
  + Default: false

Pass them via the args property in the JSON configuration. For example:

```
{ "mcpServers": { "chrome-devtools": { "command": "npx", "args": [ "chrome-devtools-mcp@latest", "--channel=canary", "--headless=true", "--isolated=true" ] } } }
```
### Connecting via WebSocket with custom headers

You can connect directly to a Chrome WebSocket endpoint and include custom headers (e.g., for authentication):

```
{ "mcpServers": { "chrome-devtools": { "command": "npx", "args": [ "chrome-devtools-mcp@latest", "--wsEndpoint=ws://127.0.0.1:9222/devtools/browser/<id>", "--wsHeaders={\"Authorization\":\"Bearer YOUR_TOKEN\"}" ] } } }
```

To get the WebSocket endpoint from a running Chrome instance, visit http://127.0.0.1:9222/json/version and look for the webSocketDebuggerUrl field.

You can also run npx chrome-devtools-mcp@latest --help to see all available configuration options.

## Concepts

### Concurrent sessions

Most MCP clients start one Chrome DevTools MCP server per conversation. If your client shares a single server instance across concurrent agents or subagents, start the server with --experimentalPageIdRouting. This exposes pageId on page-scoped tools so each agent can route tool calls to the tab it is working with.

```
{ "mcpServers": { "chrome-devtools": { "command": "npx", "args": [ "-y", "chrome-devtools-mcp@latest", "--experimentalPageIdRouting" ] } } }
```

If you run multiple independent MCP client sessions and want each session to launch its own temporary Chrome profile, also pass --isolated. This avoids sharing the default Chrome DevTools MCP user data directory between those server instances.

### User data directory

chrome-devtools-mcp starts a Chrome's stable channel instance using the following user data directory:

* Linux / macOS: $HOME/.cache/chrome-devtools-mcp/chrome-profile-$CHANNEL
* Windows: %HOMEPATH%/.cache/chrome-devtools-mcp/chrome-profile-$CHANNEL

The user data directory is not cleared between runs and shared across all instances of chrome-devtools-mcp. Set the isolated option to true to use a temporary user data dir instead which will be cleared automatically after the browser is closed.

### Connecting to a running Chrome instance

By default, the Chrome DevTools MCP server will start a new Chrome instance with a dedicated profile. This might not be ideal in all situations:

* If you would like to maintain the same application state when alternating between manual site testing and agent-driven testing.
* When the MCP needs to sign into a website. Some accounts may prevent sign-in when the browser is controlled via WebDriver (the default launch mechanism for the Chrome DevTools MCP server).
* If you're running your LLM inside a sandboxed environment, but you would like to connect to a Chrome instance that runs outside the sandbox.

In these cases, start Chrome first and let the Chrome DevTools MCP server connect to it. There are two ways to do so:

* Automatic connection (available in Chrome 144): best for sharing state between manual and agent-driven testing.
* Manual connection via remote debugging port: best when running inside a sandboxed environment.

#### Automatically connecting to a running Chrome instance

Step 1: Set up remote debugging in Chrome

In Chrome (>= M144), do the following to set up remote debugging:

1. Navigate to chrome://inspect/#remote-debugging to enable remote debugging.
2. Follow the dialog UI to allow or disallow incoming debugging connections.

Step 2: Configure Chrome DevTools MCP server to automatically connect to a running Chrome Instance

To connect the chrome-devtools-mcp server to the running Chrome instance, use --autoConnect command line argument for the MCP server.

The following code snippet is an example configuration for gemini-cli:

```
{ "mcpServers": { "chrome-devtools": { "command": "npx", "args": ["chrome-devtools-mcp@latest", "--autoConnect"] } } }
```

Step 3: Test your setup

Make sure your browser is running. Open gemini-cli and run the following prompt:

```
Check the performance of https://developers.chrome.com
```

Note

The autoConnect option requires the user to start Chrome. If the user has multiple active profiles, the MCP server will connect to the default profile (as determined by Chrome). The MCP server has access to all open windows for the selected profile.

The Chrome DevTools MCP server will try to connect to your running Chrome instance. It shows a dialog asking for user permission.

Clicking Allow results in the Chrome DevTools MCP server opening developers.chrome.com and taking a performance trace.

#### Manual connection using port forwarding

You can connect to a running Chrome instance by using the --browser-url option. This is useful if you are running the MCP server in a sandboxed environment that does not allow starting a new Chrome instance.

Here is a step-by-step guide on how to connect to a running Chrome instance:

Step 1: Configure the MCP client

Add the --browser-url option to your MCP client configuration. The value of this option should be the URL of the running Chrome instance. http://127.0.0.1:9222 is a common default.

```
{ "mcpServers": { "chrome-devtools": { "command": "npx", "args": [ "chrome-devtools-mcp@latest", "--browser-url=http://127.0.0.1:9222" ] } } }
```

Step 2: Start the Chrome browser

Warning

Enabling the remote debugging port opens up a debugging port on the running browser instance. Any application on your machine can connect to this port and control the browser. Make sure that you are not browsing any sensitive websites while the debugging port is open.

Start the Chrome browser with the remote debugging port enabled. Make sure to close any running Chrome instances before starting a new one with the debugging port enabled. The port number you choose must be the same as the one you specified in the --browser-url option in your MCP client configuration.

For security reasons, Chrome requires you to use a non-default user data directory when enabling the remote debugging port. You can specify a custom directory using the --user-data-dir flag. This ensures that your regular browsing profile and data are not exposed to the debugging session.

macOS

```
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-profile-stable
```

Linux

```
/usr/bin/google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-profile-stable
```

Windows

```
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="%TEMP%\chrome-profile-stable"
```

Step 3: Test your setup

After configuring the MCP client and starting the Chrome browser, you can test your setup by running a simple prompt in your MCP client:

```
Check the performance of https://developers.chrome.com
```

Your MCP client should connect to the running Chrome instance and receive a performance report.

If you hit VM-to-host port forwarding issues, see the “Remote debugging between virtual machine (VM) and host fails” section in docs/troubleshooting.md.

For more details on remote debugging, see the Chrome DevTools documentation.

### Debugging Chrome on Android

Please consult these instructions.

## Known limitations

See Troubleshooting.

## Integrating as a browser subagent

If you are developing agentic tooling and want to provide an integrated browser subagent as part of your product, we recommend building on top of Chrome DevTools for agents.

For a reference implementation, see the Gemini CLI browser agent documentation.

## About

Chrome DevTools for coding agents

npmjs.org/package/chrome-devtools-mcp
### Topics

browserchromechrome-devtoolsdebuggingdevtoolsmcpmcp-serverpuppeteer
### Resources

ReadmeApache-2.0 license
### Contributing

Contributing
### Security policy

Security policyActivityCustom properties
### Stars

48.6k stars
### Watchers

238 watching
### Forks

3.4k forksReport repository
## Releases

## Used by

## Contributors

## Languages

## Footer

© 2026 GitHub, Inc.You can’t perform that action at this time.