/**
 * Type declarations for Bun runtime modules.
 * Standard tsc does not resolve 'bun' or 'bun:fs' without these shim declarations.
 */

declare module "bun" {
    interface GlobScanResult {
        match(target: string): boolean
        scan(options?: { cwd?: string; dot?: boolean; absolute?: boolean }): AsyncIterable<string>
    }

    class Glob implements GlobScanResult {
        constructor(pattern?: string | string[])
        match(target: string): boolean
        scan(options?: { cwd?: string; dot?: boolean; absolute?: boolean }): AsyncIterable<string>
    }

    const BunGlobal: any

    export default BunGlobal
    export { Glob, type GlobScanResult }
}

declare module "bun:fs" {
    import * as nodeFs from "node:fs"
    export = nodeFs
}
