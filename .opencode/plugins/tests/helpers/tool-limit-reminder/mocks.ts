import { vi } from 'vitest'

import { shell, tlrConfig } from '@tests/helpers/tool-limit-reminder/state'

// This module exists only for its registrations and therefore exports nothing;
// a side-effect module is the shape the exported-module purity rule expects.
vi.mock('@plugins/config/harness', () => ({
  harnessConfig: {
    plugins: {
      get 'tool-limit-reminder'() {
        return tlrConfig.present
          ? {
              factor: tlrConfig.factor,
              padding: tlrConfig.padding,
              limits: tlrConfig.limits,
              ignoreTools: tlrConfig.ignoreTools,
              review: tlrConfig.review,
            }
          : undefined
      },
    },
  },
}))

// `bun` is aliased to the repo shim (no `$`); this mock supplies the export shell.
vi.mock('bun', () => ({
  $: (strings: TemplateStringsArray) => {
    shell.commands.push(String(strings))

    const promise = Promise.resolve({ exitCode: shell.exitCode, stdout: '', stderr: '' })
    const shellPromise = promise as typeof promise & { nothrow: () => unknown, quiet: () => unknown }

    shellPromise.nothrow = () => promise
    shellPromise.quiet = () => promise
    return promise
  },
}))

// Real writes must never reach `.tmp/session-review` during tests.
vi.mock('node:fs/promises', () => ({ mkdir: vi.fn(), writeFile: vi.fn() }))
