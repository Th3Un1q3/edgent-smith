tool: fetch
url: https://raw.githubusercontent.com/ChromeDevTools/chrome-devtools-mcp/main/src/bin/chrome-devtools-mcp.ts
date: 2026-08-06
source: fetch

Content type text/plain; charset=utf-8 cannot be simplified to markdown, but here is the raw content:
Contents of https://raw.githubusercontent.com/ChromeDevTools/chrome-devtools-mcp/main/src/bin/chrome-devtools-mcp.ts:
#!/usr/bin/env node

/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

process.title = 'chrome-devtools-mcp';

import {version} from 'node:process';

const [major, minor] = version.substring(1).split('.').map(Number);

if (major === 20 && minor < 19) {
  console.error(
    `ERROR: \`chrome-devtools-mcp\` does not support Node ${process.version}. Please upgrade to Node 20.19.0 LTS or a newer LTS.`,
  );
  process.exit(1);
}

if (major === 22 && minor < 12) {
  console.error(
    `ERROR: \`chrome-devtools-mcp\` does not support Node ${process.version}. Please upgrade to Node 22.12.0 LTS or a newer LTS.`,
  );
  process.exit(1);
}

if (major < 20) {
  console.error(
    `ERROR: \`chrome-devtools-mcp\` does not support Node ${process.version}. Please upgrade to Node 20.19.0 LTS or a newer LTS.`,
  );
  process.exit(1);
}

await import('./chrome-devtools-mcp-main.js');
