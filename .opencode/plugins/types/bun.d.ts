/**
 * Minimal Bun runtime type declarations for the OpenCode plugin codebase.
 *
 * This fallback is used because `@types/bun`/`bun-types` is not installed in
 * `.opencode/node_modules`. It declares only the shapes currently used by the
 * plugins (primarily file I/O). If Bun types are added as a dependency later,
 * this file can be removed in favour of adding `"bun"` to `tsconfig.json`.
 */
declare namespace Bun {
  interface BunFile {
    json(): Promise<unknown>
    text(): Promise<string>
  }

  function file(path: string, options?: BlobPropertyBag): BunFile

  interface Glob {
    match(path: string): boolean
  }
  export const Glob: new (pattern: string) => Glob
}

declare const Bun: typeof Bun
