import type { Skill } from '@opencode/schema/skill'

/**
The host's prompt call takes skill attachments, not names; an absent or empty
list leaves the call byte-identical to a plain text prompt.
*/
export const skillAttachments = (skills: readonly string[] | undefined): { readonly skills?: ReadonlyArray<{ readonly id: Skill.ID }> } => {
  const names = skills ?? []

  return names.length === 0 ? {} : { skills: names.map(name => ({ id: name as Skill.ID })) }
}
