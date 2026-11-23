import { Effect } from 'effect'

export const TAG = '[instructions-loader] '

export const attempt = <A>(run: () => Promise<A>) =>
  Effect.result(Effect.tryPromise({ try: run, catch: (error: unknown) => error }))
