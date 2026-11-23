export const causeText = (cause: unknown): string => cause instanceof Error ? cause.message : String(cause)
