title: Your Agent Didn't Fail. Your Harness Did. — Vinoth Govindarajan
url: https://www.youtube.com/watch?v=BInpv7lGp1o
date: fetched 2026-08-07
channel: AI Engineer (@aiDotEngineer)
source: youtube-transcript get_transcript

[music]
Thank you for choosing to spend this
session with me. My goal today is
simple.
I want to convince you all that most of
the production failures are not most of
most of the agent failures are not model
failures. Those are harness failures. So
let's start with one production
incident.
The user saw the reply. The system
forgot it happened. This is a failure
shape I want to start with. Not a
hallucination, not a crash, not a bad
answer. The user visible edge looked
healthy while the durable record had a
hole.
In this example, the user asked the
customer the agent to remember a refund
for a customer. The assistant said it
recorded the fact for the next turn. The
interface looked normal. No red screen,
no obvious failures. But the next turn
cannot reconcept the fact. The user
experienced success. The system
inherited incomplete reality.
Why this matters? The crash is annoying,
but at at least it gives you a boundary.
You know some you know something
stopped. You usually see an error. You
can often start from last known good
point. Silent success gives you a lie.
Delivery can succeed while the
persistent fails. The user has no reason
to doubt the reply. The operator has no
obvious alarm. The next turn can still
sound confident
because the model is coherent but it is
coherent over a broken history.
That is why agent reliability matters.
and agent relity cannot stop at model
quality.
Hi, I'm Ben. I work on core data and AI
infrastructure at OpenAI.
Before that, I worked on distributed
systems at Apple and Uber. Outside of
the work, I write the agent stack where
I try to explain how the production AI
and data systems work under the hood.
I'm daughter of OpenClaw and this is not
a openclaw product pitch.
This is a pure system design talk. I'm
using open claw as a public case study
because
its issues code docs makes the harness
around the agent unusually visible.
Here's a production contract for the
talk. A model proposes the harness
commits and the receipts proves it. The
model can may suggest a message, a tool,
a edit or an command. But model is not
the production boundary. The harness
owns the state transition, the authority
check, the ordered commit and the
receipt is the evidence that survives
the term. Open clause is the case study
and the contract is the takeaway.
If you remember only three things from
this talk, make it these. Own the state,
order the mutation and prove the action.
A fact needs only one owner and one
replay path. Shared mutable state needs
one ordered commit path and transcript
is not the proof. A transcript tells you
what the agent said. A receipt tells you
what the system allowed, attempted,
executed and what the user visible edge
confirmed.
To create a simple mental model, I
created this car analogy of the harness.
The model is the engine.
It matters a lot. But nobody buys a
production car by just looking at the
horsepower alone. You also care about
steering, brakes, road rules, dashboard,
and a black box. The model gives you
capability, but the harness gives you
control. A powerful engine with no
brakes is not autonomy. It is a
liability with good acceleration.
Here
is the harness blueprint I wanted to uh
discuss today. Every agent we know of
like personal agents such as open claw
or Hermes, coding agents such as codeex,
cursor, open code or cloud code uses the
same underlying architecture.
Events enter from many surfaces a chat,
web hook, timer or heartbeat or another
external system. The control plane maps
the events to a session key and the
session key determines the state
boundary. The session lane gives you one
active writer for that mutable state.
The runtime calls the models and tools.
Tools act through approvals and policies
and audit rail becomes the run receipt.
This is the blueprint event session key
throttle tools audit. The blueprint is a
talk and the incident of the proof that
each boundary matters.
context is assembled
uh in agent runtime
does not usually remember in human
sense. It is stateless.
The harness rebuilds the working state
for the each turn. The working set may
include the transcript, session state,
memory, policy, tool definitions.
[clears throat] The model only sees what
the harness supplies. If one input is
missing or stale, the answer may still
sound coherent. Coherence does not
proves the working set was complete.
These failures are not new. We already
know about timeouts, retries, item
potency, locks, ordering, and state
ownership. What change is the agent
setting?
Now these failures sit around a
probabilistic planner with dynamic
plans. It's rebuilding the context for
every turn. there are more event sources
and it can act through more action
surfaces. So these failures are familiar
agents makes them easier to trigger and
harder to explain. That's why agent
harness matters.
Let's talk about the first failure mode.
This is the same failure mode I started
this talk with.
The user sees a success. The source of
truth cannot replay it. Delivered is not
remembered.
In this stateole open claw issue, a
telegram reply could succeed while the
router turn was not written to the
active context or transcript. The user
saw the response. The log looked
healthy.
But the next turn had no durable record
of the next change. A successful send
proves transcript. It does not prove the
future context. That distinction matters
because the model can answer fluently
over an incomplete record.
The missing boundary was not
intelligence. It was the state
ownership.
By owner, I do not mean a person. I mean
the system of record whose persistent
state becomes the truth.
A calendar event belongs to the calendar
system. A support status belong to the
ticketing system. While a code change
belongs to a workspace or repository on
a conversation turn belongs to a session
transcript and a user preference belongs
to a memory store.
Storage tells you where the bytes live.
Ownership tells you who can reconstruct
the reality.
A replay is not a reliable memory until
until a named owner can replay it. A
system has to persist the turn. It has
to name the owner or system of record
and it has to make the replay possible.
The question is simple. For every fact
the agent might use later, who owns it
and how would you replay it? If no owner
can replay the fact, this the system did
not reliably remember it.
Once we know who owns the state, the
next question is who's allowed to change
it and in what order?
Two correct rights can still produce one
wrong outcome. and last writer wins is
not a consistency model.
In this overlapping writer open claw
issue describes a load modify save race.
Two callers loads the same old state.
Each changes a different record. The sil
the second save silently erases the
first. The user may see a dismissed
commitment return or receive a duplicate
follow-up. Neither writer is malformed.
Both operations are locally correct. The
missing boundary is civilization around
the commit.
The invariant is not no concurrency.
That would be too slow and it would miss
the point. You can fan out sub agents.
Parallel reads are fine. Independent
retrieval is fine. Many sessions can
also run at once. The rule is narrower
and simple. One ordered commit path for
one mutable state boundary.
This mechanism may be a Q, a mutx, a
transaction or a lock. You can use locks
or mutx across the sessions and cues or
transactions within a session.
Be conservative of the commit time and
not across the whole system.
Users do not see cues or locks. They see
behavior.
A last correction feels forgetful. A
stuck lane feels dead. And completion
before delivery feels confused.
Ordering is a product feature because
users experience ordering books as
personalities.
Now let's talk about time in production.
Silence cannot be neutral. Let's review.
Uh the next uh failure mode is life
cycle failure mode. The run waits for an
event that cannot arrive. Silence is not
a terminal state.
In this dangling tool call issue, the
session contains a tool call but no
matching tool result.
A process may have died. The connection
may have dropped. A timeout might have
happened before the results were
recorded. The exact cause uh matters for
debugging. The production failure is
much simpler. The run is waiting for a
event that will never arrive.
New messages cue behind that silence. To
the user, the agent simply looks stuck.
Runs needs deadlines and cancellation. A
deadline bounds the weight. Watchdog
makes the stuck work visible. Tools
needs time modes and error results.
Channels needs recovery commands that do
not wait behind the stuck work they are
trying to fix.
Every external boundary needs an ending.
Success, failure, timeout, cancel, or
max attempts.
Most importantly, the receipt records
the terminal outcome. So the next step
does not have to guess. Bound the work
before the work bounds you.
Now let's uh we can move on from state
to authority because a chat becomes
risky when it becomes an action.
Capability is not execution. The model
can request an action. Requestability is
not authority. Approval needs a shape.
In this approval drift issue, expired
approved call back was stated as
retraable. The state call back state
durable served restarts and blocked
later channel work. The battle click
existed. The valid authority did not.
This is the mistake. Treating approval
as a vague memory that the human was
near the system or clicked yes. Approval
as a scoped execution state, it must
stay bound to the action it authorized.
An expiration must terminate rather than
loop.
A useful approval object answers who
approved in what session and run for
which tool and for which arguments and
for how long and with what outcome.
It also point to the receipt. If those
fields fall off during a retry replay or
a channel call back the harness can no
longer prove the action was being
executed is the action being approved.
The general lesson is simple. Capability
is not execution.
Least privileges narrows the tool
surface. Scoped credentials ensures the
right identity is used for the action.
Approval and audit decides what happens
before and after the execution.
The model can reason about the boundary
but it should not be the boundary. The
model can request but the still the
system decides.
Finally, even if the tool says success,
the user visible B may disagree.
Internal component reports success. The
user visible surface shows nothing. This
is the inverse of the opening incident.
We saw
in this missing edging edge proof issue.
The message tool reported success for a
web chat or TUI run, but the message did
not render. Normal assistant reply still
appeared. The tool proved that the
internal path accepted the request. It
does not prove the user saw the result.
That difference change the conversation.
The agent may later say, "I already sent
it." And the user may truthfully say, "I
never saw it." Internal success is not
external proof.
Proof is a chain, not a claim. Model
proposed something. Policy allowed or
denied it. Execution attempted it. User
visible edge confirmed or failed to
confirm the outcome. The receipt
preserves the chain. A transcript
records what the agent said. The tool
results records what one component
claimed.
A receipt records what the agent can
verify at the boundary that matters.
Let me recap all the incidents. Here are
the file failure shapes you you to look
for. A state hole, overlapping writers,
dangling tool call, approval drift, and
missing edge proof. For each one, let's
ask the same question. What did the user
see? Which boundary it broke? And what
would the receipt have caught?
Here is the audit I want you to run when
you get back to your team. Pick one
agent system, not all of them. One
trace one production, one real
production path and ask for the receipt.
The audit has five questions. What woke
it up? What state did it inherit? Which
authority did it use? What executed? And
what evidence survived? These
questions expose squashalty. They turn a
fluent conversation into an inspectable
production run.
First, what woke it up? A user message,
web hook, timer, tool result, sub agent,
or a replay. Name the trigger and its
identity. Without that, you cannot
reason about dduplication, order, or
authorization.
Second, which state did it inherit?
transcript, session state, memory
snapshot, policy version, and tool
surface. The model only reasons over the
working set the harness assembled.
Third, which authority did it use?
Record the actor, session, tool, run,
arguments, scope, and lifetime. A model
request is not permission. Authority
should bind to a one pending action.
Fourth, what executed?
Record the tool or API call, arguments,
attempt number, item potency key, and
external results. This is a side effect
boundary, not the poor summary of what
the agent intended.
Fifth, what evidence survived? Did the
ticket get updated? Did the message got
rendered? Did the file got changed? Did
the calendar event exist? The receipt
should end at the boundary the usual the
user usually cares about.
Now let's apply the opening incident.
The same order to the opening incident.
What woke it up a user message? What
state it owned? That was the broken
boundary. What executed the channel
send? What evidence survived delivery?
What did not survive the durable turn?
Delivery survived while the state did
not. That gap is the harness failure.
The agent uh do did not need a better
model. The model did not need a better
prompt. The system needed a better
harness with complete receipt.
Let me recap the same three things I
asked you to remember from the start of
my talk. Own the state, order the
mutation and prove the action.
A better model helps inside the turn.
Ownership, ordering, life cycle,
authority and proof keep the system sane
across turns.
A model proposes the harness commits and
the receipts receipt proves it. Once
text can become an action, the useful
question changes. Do not only ask
whether the model can reason. Ask
whether the system can own the state,
order the mutation, bound the work,
constraint authority, and preserve
evidence.
A loop can answer a turn and harness can
serve up production.
If you want to go deeper, scan the QR
codes. The first points to the agent
open AI agents SDK where all these um
harness are already built in so that you
can use to build your own agents and
second points to the agent stack where I
write about the production agents
systems in more detail. I'll be at the
open booth after this talk if you want
to talk about your harness design. Thank
you.
[applause]
[music]