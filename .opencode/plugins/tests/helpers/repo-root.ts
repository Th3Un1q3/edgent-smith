import { existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Markers that only exist at the repository root. `AGENTS.md` alone is not enough
// because every directory in this tree may carry one; the skill directory pins the
// walk to the checkout root.
const ROOT_MARKERS = ['AGENTS.md', path.join('.agents', 'skills')] as const

const isDirectory = (candidate: string): boolean => {
  try {
    return statSync(candidate).isDirectory()
  }
  catch {
    return false
  }
}

export const isRepoRoot = (directory: string): boolean =>
  ROOT_MARKERS.every(marker => existsSync(path.join(directory, marker)))
  && isDirectory(path.join(directory, '.agents', 'skills'))

/**
 * Walk upward from `startDirectory` until a directory carries every root marker.
 *
 * The walk is required under Stryker: the sandbox is copied to
 * `.opencode/.stryker-tmp/...`, which has no `.agents/` directory, so a root
 * derived from the sandbox path would silently point at the copy instead of the
 * checkout. Walking out of the sandbox finds the real root in both environments.
 */
export const findRepoRoot = (startDirectory: string): string => {
  let current = path.resolve(startDirectory)

  for (;;) {
    if (isRepoRoot(current)) return current

    const parent = path.dirname(current)

    if (parent === current) {
      throw new Error(
        `cannot locate the repository root above ${startDirectory}: no ancestor contains ${ROOT_MARKERS.join(' and ')}`,
      )
    }

    current = parent
  }
}

export const REPO_ROOT = findRepoRoot(path.dirname(fileURLToPath(import.meta.url)))
