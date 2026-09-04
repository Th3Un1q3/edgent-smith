---
id: profile-about
type: about
hotness: 1.0
ttl: 90d
claim_ids: []
L0: "profile: persistent operator traits & identity"
L0_table:
  - id: profile/preferences/interaction-style
    L0: "operator prefers concise, verified, cache-first outputs"
---
# Profile

Persistent traits and long-term identity of the operator/agent in this workspace. Stores stable facts that transcend sessions (role, mission, constraints).

## Scope
- Stable operator traits, mission, org constraints, long-term goals.
- Not session-specific events — those go to mem:events/about.
- Preferences style biases go to mem:profile/preferences/interaction-style, not here.

## Boundaries (out of scope)
- Session-scoped interactions — mem:events/about.
- Entity profiles of external companies/people — mem:entities/about.
- Atomic verifiable claims — mem:claims/about.

## Related Domains
- mem:profile/preferences/interaction-style — style biases derived from profile.
- mem:entities/about — external entity profiles.
- mem:events/about — temporal events involving the profile.
