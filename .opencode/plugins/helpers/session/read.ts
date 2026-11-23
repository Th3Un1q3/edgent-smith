/**
 * One session read for every plugin scope: the `session.get` call, the two
 * identity fields a caller needs, and their narrowing live here, so no call
 * site casts the returned session again.
 *
 * A reader owns its cache and every call states the mode it wants. `cached`
 * serves the reader's stored identity; `fresh` calls through and stores what
 * it gets. A scope that must see a session's current agent asks for `fresh`,
 * so a memo cannot serve an agent the session has since changed.
 */
import { Effect } from 'effect'
import type { Context } from '@opencode/plugin/effect/plugin'
import type { Session } from '@opencode/schema/session'

export interface SessionIdentity {
  readonly agent: string | undefined
  readonly parentID: string | undefined
}

export type SessionReadMode = 'cached' | 'fresh'

const nonEmpty = (value: unknown): string | undefined =>
  typeof value === 'string' && value !== '' ? value : undefined

// The schema brands both ids and declares `parentID` optional; a host payload
// can still carry an empty or absent value, so both are narrowed here once.
const toIdentity = (session: { readonly agent?: unknown, readonly parentID?: unknown }): SessionIdentity => ({
  agent: nonEmpty(session.agent),
  parentID: nonEmpty(session.parentID),
})

export const createSessionReader = (context: Context) => {
  const identities = new Map<string, SessionIdentity>()

  const readThrough = (sessionID: string) =>
    context.session.get({ sessionID: sessionID as Session.ID }).pipe(Effect.map(session => toIdentity(session)))

  const read = (sessionID: string, mode: SessionReadMode) => {
    const cached = identities.get(sessionID)
    return mode === 'cached' && cached !== undefined
      ? Effect.succeed(cached)
      : readThrough(sessionID).pipe(
          Effect.tap(identity => Effect.sync(() => {
            identities.set(sessionID, identity)
          })),
        )
  }

  return { read }
}
