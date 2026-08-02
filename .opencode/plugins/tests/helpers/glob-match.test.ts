import { describe, it, expect } from 'vitest'

import { isGlobMatch } from '@plugins/helpers/glob-match'

describe('isGlobMatch', () => {
  it.each([
    ['foo', 'foo', true], ['foo', 'bar', false], ['foo', 'foobar', false], ['', '', true], ['', 'a', false], ['a', '', false],
    ['a*b', 'aXb', true], ['a*b', 'ab', true], ['a*b', 'aXYZb', true], ['a*b', 'a/b', false],
    ['*.ts', 'foo.ts', true], ['*.ts', 'a/foo.ts', false], ['src/*', 'src/bar', true],
    ['a**b', 'ab', true], ['**', 'copilot', true], ['**', 'src/foo.ts', true],
    ['**/dir', 'a/dir', true], ['**/dir', 'a/b/dir', true], ['**/dir', 'dir', true], ['**/dir', 'other', false], ['**/dir', 'a/dir/extra', false],
    ['a?b', 'aXb', true], ['a?b', 'a/b', false], ['a?b', 'ab', false], ['a?b', 'aXXb', false],
    ['a.b', 'a.b', true], ['a.b', 'aXb', false], ['a+b', 'a+b', true],
    ['src/**/*.ts', 'src/foo/bar.ts', true], ['src/**/*.ts', 'src/bar.ts', true], ['*.md', 'README.md', true],
    ['copilot*', 'copilot', true], ['copilot*', 'copilot-agent', true], ['**/*.ts', 'dir/file.ts', true],
  ])('%s vs %s → %s', (p, s, expected) => expect(isGlobMatch(p, s)).toBe(expected))
})
