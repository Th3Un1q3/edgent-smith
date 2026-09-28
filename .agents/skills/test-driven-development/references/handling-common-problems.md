# Reference: Handling Common Test Problems

Load this reference when a test is hard to write or the design gets in the way. Each row points at the code change that fixes the problem, not a workaround.

| Problem | Guidance |
|---|---|
| Can't figure out how to test it | The interface may be unclear. Design the API you wish existed, then write the test against that API. Ask your human partner if stuck. |
| Need too many mocks | Code is tightly coupled. Apply dependency injection or restructure so the subject has fewer direct dependencies. |
| Test setup takes longer than the test itself | Extract shared fixtures into a dedicated helper file. If still long, the interface may be overcomplicated. |
| Can't identify what to assert on | Look at what changes: return value, state, or side effect (file written, network call made). Assert on that observable change. |
| Test needs private internals | The public surface likely does not express the behavior. Test through the public interface, or split the unit until it has one. |
