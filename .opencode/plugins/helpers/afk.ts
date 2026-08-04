/**
 * AFK enforcer message constant.
 *
 * Defined here rather than in the plugin entry file so that
 * `afk-enforcer.ts` only exports Plugin-typed values. opencode loads plugin
 * root files by directory scan and exporting non-Plugin values from an entry
 * file prevents the plugin from loading. This is guarded from recurring by the
 * `plugin-export-guard/no-non-plugin-export` rule in `eslint.config.js`.
 */
export const AFK_MESSAGE = '<steering priority="warning" reason="user is away from keyboard — permission auto-denied by afk-enforcer plugin">Permission auto-denied: the user is AFK and cannot approve this request. Do not retry; continue with available tools or stop and report the blocked step.</steering>'
