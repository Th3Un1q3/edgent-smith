import { Effect } from 'effect'

const FAILED = 'synthetic append failed'

/**
 * What a call site does when the append is rejected. The sites disagree by
 * design: the loader must know before writing its token map, the gate enforcer
 * continues after a warning, the state machine reports through its own port,
 * and the tool-limit reminder stays silent.
 */
export type AppendFailurePolicy<E, R>
  = | { readonly _tag: 'log', readonly tag: string }
    | { readonly _tag: 'report', readonly onFailure: (failure: E) => Effect.Effect<void, never, R> }
    | { readonly _tag: 'silent' }

const failed = <E, R>(policy: AppendFailurePolicy<E, R>, failure: E): Effect.Effect<boolean, never, R> => {
  if (policy._tag === 'log') {
    return Effect.logWarning(policy.tag + FAILED, { error: String(failure) }).pipe(Effect.map(() => false))
  }
  return policy._tag === 'report' ? policy.onFailure(failure).pipe(Effect.map(() => false)) : Effect.succeed(false)
}

/**
Appends one synthetic message and reports whether it landed.
*/
export const appendSynthetic = <A, E, R>(
  append: Effect.Effect<A, E, R>,
  policy: AppendFailurePolicy<E, R>,
): Effect.Effect<boolean, never, R> =>
  Effect.result(append).pipe(Effect.flatMap(outcome =>
    outcome._tag === 'Success' ? Effect.succeed(true) : failed(policy, outcome.failure)))
