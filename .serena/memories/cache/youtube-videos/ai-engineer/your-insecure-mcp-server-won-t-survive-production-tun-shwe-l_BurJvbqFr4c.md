title: Your Insecure MCP Server Won't Survive Production — Tun Shwe, Lenses
url: https://www.youtube.com/watch?v=BurJvbqFr4c
date: 2026-04-08
channel: AI Engineer
source: youtube

Hey folks, thank you for joining us for
this session on why your insecure MCP
server won't survive production.
My name is Tin Shway and I lead AI at
Lenses and day-to-day I'm an AI engineer
and you can connect with me here on
LinkedIn.
And I'm Jeremy Fronae. I work on AI
engineering at Lenses.
First, a quick note on where we work.
Lenses is a data operating fabric that
sits between your agents and
Lenses is the de facto streaming data
layer for providing trusted real-time
context to agentic AI.
Companies work with us because we have
governance, security and large scale at
the top of mind.
Here are a selection of our customers
which gives us exposure to lots of
different industry use cases at large
scale.
And we are here today of course because
we have an open source MCP server that
we're applying our learnings to from the
field. So, please give us a star to
follow the project.
And here's what we'll cover in this
session. The takeaways we want you to
have are the ways of thinking about
designing MCP servers and in fact any
interface to make it robust for agentic
AI systems. And since this is a talk
about MCP, we'll ensure you have tips on
how to approach securing your MCP
service for production.
I'll cover the first few sections and in
his sections Jeremy will go over the
OAuth flows.
So, let's go straight into why most MCP
servers aren't great.
I like the way Jeremy Lowin, who is the
creator of Fast MCP, put it. Um he said
that agents deserve their own interface
that is optimized for their use cases.
To approach designing for agents through
a product engineering lens.
I want to take that approach one step
further.
A badly designed MCP server is also a
badly secured one.
Poor design and poor security compound
each other.
Jeremy put forward three dimensions in
how humans and agents differ from one
another and to consider these three
dimensions when you're designing for MCP
or any agentic interface.
The extra layer I wanted to emphasize is
security that each one casts a security
shadow.
First, there's discovery.
When you use the new API, you pull up
the docs, you scan through them once,
you find the three end points that you
need and you never look at those docs
again.
An agent can't do that.
Every time it connects to an MCP server,
it enumerates every single tool and
reads every single description. And
that's expensive in tokens.
But here's the security set shadow.
Every one of those tool descriptions is
a surface for tool poisoning.
Attackers can embed hidden instructions
inside descriptions that are invisible
in the UI, but the model will follow
them without question.
More tools means more surface area for
injection.
Second is iteration. If your script
fails, you run it again. It takes a
second. When an agent retries, it sends
the full conversation history over the
wire.
And here's its security shadow.
An agent iterating over a poorly scoped
MCP server is broadcasting your data
with every retry.
The full conversation history goes over
the wire including any sensitive data
returned by previous tool calls. Each
round trip is a chance for data leakage.
Third, context. You and I have decades
of memories and experiences and
intuition. An agent has roughly 200,000
tokens and that's it.
The security shadow is detailed in
OWASP's MCP top 10 list which I
recommend you all to go and read. And
there it's listed as number 10, context
injection and oversharing.
If your server dumps unfiltered data
into that limited window, you're handing
off PII, credentials, internal system
details to a model that can be tricked
into exfiltrating them.
An agent has to load all the context in
before it can make a decision.
It makes it suitable for finding
specific things, but it comes at the
cost of latency and context bloat. So,
you think of it as finding a needle in a
haystack.
If some of that hay is poisoned, the
agent just won't notice.
So, you should think about curation.
Curate the MCP tools available to the
agent and aim to expose the smallest
amount of information.
The less you expose, the less can be
attacked. And here, less is more.
Next, I'll go over what I consider five
key rules for secure agentic design. Uh
to think with your product engineering
hat on and to apply it to MCP servers.
The thing I want you to take away from
this section is that good MCP design and
good MCP security are the same
discipline. If you get the design wrong,
no amount of OAuth will save you.
I've got five principles here and they
all give you protection against the
OWASP MCP top 10 before you write even a
single line of OAuth code.
So, number one,
shrink the attack surface by design.
Think in terms of outcomes. The idea
here is to squash all the fine-grained
operations or underlying API calls into
a single coarse-grained operation that
produces a desired outcome.
Every tool you expose is a door.
Don't give the agent access to delete
users when all it needs is to check an
order.
Consolidate related operations behind a
single tool call with a well-defined
outcome. So, you have one permission
check, one audit log entry, one place to
enforce authorization. So, think fewer
doors with fewer locks to manage.
Number two, constrain your inputs at the
schema level.
You've got to accept the top-level
primitives like the enums, that will be
the best approach. Um dictionaries are
also fine as long as they're not nested
and to introduce more strictness, you
could use a typing library like
Pydantic.
The aim is to reject free-form nested
payloads to avoid command injection
flaws where the root cause is almost
always unconstrained string arguments
that get passed downstream to a shell, a
query engine or an API. Constrained
inputs are easier to validate and harder
to exploit.
Number three, treat your documentation
as a defensive layer.
Tool poisoning is number three on the
OWASP MCP guide and it works by
embedding malicious instructions in tool
descriptions that are invisible in the
UI, but executed by the model.
If you don't write clear, complete
instructions, an attacker-controlled
tool description in a neighboring MCP
server can shadow yours.
If your documentation is complete and
unambiguous for every tool, it crowds
out the space that a poisoned
neighboring server would try to fill.
Number four,
return only what the agent needs.
Oversharing data in tool responses is
number 10 in OWASP's MCP guide and it
turns the agent's context window into a
liability.
PII, internal identifiers, credentials,
system details, all sitting in the
context, they're all just one prompt
injection away from exfiltration. So,
strip your payloads to the minimum. If
the agent doesn't need a piece of data
for its immediate task, then don't
return it.
And number five,
minimize the blast radius. Scope
permissions at the tool and resource
level, not the session level. Use the
MCP read-only annotation for
non-destructive tools so that clients
can enforce boundaries or if an MCP tool
is intended to have read-only access,
then consider turning it into an MCP
resource.
Also, remember that every tool you
remove is an attack vector that you
eliminate.
And you're building an interface, not a
tool. So, this is the mindset to go in
with.
An agent will use anything you provide
it with confidence, so you have to
provide that trust layer.
So, now you've designed your server
well. You followed the five principles.
Now you need to actually deploy it and
this is where most teams hit what I call
the security cliff.
If you're running MCP in standard IO
mode, life is pretty comfortable. It's a
local process, a single user, no no
network exposure, no authentication
needed. Your MCP host talks directly to
the server process on your machine. It's
a walled garden and it works beautifully
for single-player developer
productivity.
But production requires something
completely different.
You need the streamable HTTP transport.
Um this enables remote deployment,
multiple clients connecting to the same
server. You can horizontally scale and
you can centralize your governance. And
this is really where MCP becomes
genuinely valuable to an organization
where you go from one developer on one
laptop to a shared capability that an
entire team or entire fleet of agents
can use.
MCP becomes the single interface that
all clients can use without having to
worry about whether they're the latest
version of an API or considering the
resources needed to scale.
The problem is there's no gradual
on-ramp. You go from zero security
surface to a huge list of concerns all
at once. You're suddenly needing OAuth,
token management, CORS configuration,
TLS, rate limiting and more. And you
need it all at once. So, there's no
halfway house because you can't do a
little bit of production. You're either
behind the wall or you're standing out
in the open.
And you can't just stay local and hope
for the best. Stack lock ran low tests
on standard IO transport and the results
were brutal. 20 out of 22 requests
failed with just 20 simultaneous
connections. Standard IO falls over the
moment you add concurrency. So, if you
want to scale out, you have to cross the
chasm.
And how do you start crossing that
chasm? I'm going to hand it over to
Jeremy to continue.
Yes, so implementing an authorization
server for MCP isn't that simple.
Let's look at the list of RFCs to
implement.
With the core flow, the OAuth client
discovery, and the metadata, and the
management of the token life cycle, we
already have more than 10 specifications
to implement.
Now, let's say we read all these RFCs,
and I'm ready to implement an
authorization [clears throat] server for
MCP.
What does the enterprise grade
authorization look like?
So, let's start by reviewing the local
versus remote MCP server setups and
their respective OAuth flows.
Tune talked about the walled garden, the
local MCP server
running over standard IO with an API
key.
Let's look at the flow diagram.
The MCP server runs on my machine.
The client connects via standard IO.
The user must set the key as a parameter
in the MCP client config.
And the parameter will be stored as an
environment variable
passed by the MCP server with its
request to the external service.
That might be good for local setups, but
I need to provision, store, and maintain
the key.
This key is long-lived, is rarely
rotated, and it isn't scoped to the
specific actions that my client perform.
Even worse, these keys are often shared
across systems.
So, the key is stored in a config file,
an environment variable, and it isn't
verified by the MCP server.
Now, let's look at a remote MCP server.
In this case, the MCP server runs on a
remote server.
The client connects via HTTP.
The user must set the key in the HTTP
authorization header. Again, we can see
the MCP client config here on screen.
So, phase one is the generation of the
token and the configuration of a client.
On step two, runtime,
we can see the client performing a
request, attaching this API key in the
authorization header.
This API key is validated or not by the
MCP server itself, and will be passed
through
to the upstream API, where it will be
this time verified. Whether the API key
is validated or not, we'll get a 200
response or 401 response, in which case
the user will need to rotate the token
manually.
That's how a majority of remote MCP
servers are configured today.
The key is long-lived, it isn't scoped
to the specific action of my agent,
either. The key is stored in a config
file, and it isn't always verified by
the MCP server.
Either the key is simply passed through
to the API, creating a confused deputy
vulnerability, where malicious clients
obtain authorization without the proper
user consent,
or sometimes the key might be mapped to
another key and token
for the API access itself.
Now, we have a single shared credential
serving many users. That credential is
even more powerful, harder to revoke per
user, and if leaked, it compromises
everyone.
This approach works for long-lived,
unscoped credential setups. It still
represents more than 50% of the MCP
servers out there.
But what we see the ecosystem moving
towards is short-lived, scoped tokens
via OAuth 2.1.
We even see token exchange for least
privilege access.
Traditional OAuth assumes you know your
clients up front.
You register them in a developer portal,
you get a client ID, and you move on.
This works when you have five to 10 apps
connecting to your service.
But with MCP,
this flow breaks completely.
Think about what MCP's architecture
actually looks like.
Any client, Cloud Desktop, Cursor, VS
Code, a CLI tool, a random agent,
can discover and connect to any MCP
server at runtime.
Pre-registration requires too much
effort in a highly viable setting.
It's an unbounded number of clients
connected to an unbounded number of
servers.
You can't ask every developer to
manually register their app with every
MCP server they might ever want to talk
to.
So, that's where the dynamic client
registration comes in.
In this case, we still have an MCP
server running on a remote server,
but now it's protected by an OAuth
authorization server.
The client can self-register itself
against the authorization server,
and will get a new client ID on every
registration.
So, on phase one, the discovery,
our MCP client, in this case Cursor,
will perform a request on {slash} MCP
against the MCP server.
We can see the MCP server returning a
401 response because we do not have a
token to pass yet,
but it also passes a WWW-Authenticate
header containing the resource metadata
that can be used by our client in order
to discover the MCP server and its
metadata.
The document itself looks a bit like
this.
It describes the resource we're trying
to access and the authorization server
protecting it.
This lets our client point at the
authorization server itself and
discover, this time, the metadata
exposed by the authorization server
itself.
Now that our client knows how to
authorize itself for an MCP server
access, it needs to register itself
against the authorization server.
That is done via a request, a post
request on {slash} register.
As we mentioned earlier, the
authorization server will generate and
persist on disk a new client ID and
return it to the client.
Now, we know who we're talking to.
Next, it's time to authorize our client
against the authorization server.
And for that, the MCP spec is mandating
to use the PKCE, the proof key for code
exchange protocol. So, our MCP client is
first generating a code verifier and a
code challenge
that it does pass through a request to
{slash} authorize
in order to obtain
an authorization code.
Our authorization server will validate
this request and the code challenge.
And since we don't have a running
session yet for this user, it will
redirect the user to its identity
provider, so that's your single sign-on
form, in order for the user to log in.
Upon successful log in, the user will be
redirected to a consent page where they
can grant different scopes
to their client.
Now that we issued a valid authorization
code for client, it's time to use it in
order to get a token, an access token.
Does that by sending a request on
{slash} token and passing the
authorization code and the code verifier
that we generated for the PKCE protocol
earlier.
Authorization server will validate
the PKCE challenge and the authorization
code,
and it will then mint a brand new token.
In this case, we're using JSON web
tokens
in order to return an access token for
client to now use the MCP server.
The final step is actually to
use the MCP server.
This is when your MCP client is going to
perform a tool call, for example.
We can see it will pass the access token
we just issued
in the authorization as the bearer
value.
Our MCP server will validate this token,
check the valid scopes,
and it will now
perform the token exchange flow in order
to change this delegation token
for a session token.
This means our MCP server now is
actually a OAuth client
for a new resource server,
our API,
but it's using the exact same
authorization server in order to get a
token.
So, that is the token exchange flow that
is defined in RFC 8693.
And as we complete the flow,
our MCP server can use this new session
token in order to perform an API call,
bypassing
the token in the authorization header.
So, DCR solves the self-registration,
the dynamic registration of the client,
so that our user doesn't have to go and
pre-register, pre-generate uh static
credentials, and set it on the client,
but it does have its own problems.
First, every time a user connects a
client to an MCP server,
a new registration is created.
Registrations are not portable, so using
Cloud on Windows and then on macOS
creates two distinct client
registration.
DCR is vulnerable to phishing attacks
because it doesn't provide a reliable
way to verify client identities.
Anyone can post to that endpoint, the
{slash} register endpoint, including
attackers.
Finally, the server is just trusting
whatever metadata the client
self-asserts.
It means a malicious client can claim to
be Cloud,
and the server has no way to know
otherwise.
So, the MCP community had to come up
with a better way to let clients
self-register.
And that is CIMD, the client ID metadata
document.
Here in this case, we still have an
authorization server in front of our MCP
server,
but the client owner exposes the client
ID on a public URL.
This will let our MCP server fetching
the client ID during the authorization.
Let's have a look at the diagram.
So, phase one is still the discovery.
Our client hits the MCP server without a
token,
gets a 401 response, and uh the resource
metadata URL. It can follow this URL,
discover the MCP server, and it will get
to discover the authorization server.
But this time, the authorization server
isn't mentioning it needs a slash
register request.
It means the client, the MCP client, can
go straight to the authorization phase.
We generate again the PKCE code
verifier, and we perform a slash
authorize request. But this time, our
client passes its unique ID, and we can
see it here. It's actually a valid URL
where the metadata for the client is
being exposed.
This lets our authorization server fetch
this metadata,
and register a new client with a unique
ID
that is a URL that is exposed by the
client owner.
And we can move to the authentication
phase.
Again, the authorization server will
redirect to the identity provider, wait
for a valid login on our user's side,
present a consent screen
uh for the user to grant some scopes,
and
we are ready to issue
the delegation token and the session
token
for a token use by the MCP server.
So here, CIMD has no growing database of
client registration to maintain.
Proving that you control
https://cloud.ai
is meaningful,
unlike proving that you can post on the
registration endpoint.
The redirect URIs that are explicitly
bound to the client in its metadata
document are making it harder for
attackers to sneak in malicious
callbacks.
And the authorization server can
selectively allow or deny clients.
So, in summary, DCR is a good start, but
it does create problems.
CIMD is a leap forward, and it is the
preferred approach since November 2025.
But becoming enterprise grade
requires adding other layers of security
and confidence.
For permissions,
OAuth scopes gets you part of the way
there,
but it's scoped to the session.
True enterprise grade role-based access
control means scoping permissions at the
individual tool and resource level, not
just the session.
Data masking is how you deal with the
PII fields such as email,
phone, and national insurance numbers.
They may need to be masked before the
agent sees them, because agents should
never be exposed to data that they have
no business handling.
You will need to log what's happening in
each interaction.
Which agent called which tool, with what
parameters, and what data was returned.
For compliance with regulations such as
the EU AI Act, regulators will expect
this level of transparency and detail
for autonomous AI systems.
Finally, you'll need to be able to
observe the full request.
This means the client request validation
through the execution,
data retrieval, and the generated
response.
If you cannot trace what an agent did
end to end, you cannot govern it.
Tracing for agent AI follows the same
principles as distributed system
observability, but applied to autonomous
decision-making.
Thanks very much, Jeremy, and thank you
all for tuning in to this session. We'd
love to know how your journey with
productionizing MCP services is going,
so please leave us a comment or send us
a message. You know where to find us.
And please do check out our MCP server
and give us a star. So, hopefully we'll
see you again soon. Thanks, and bye.
Thank you.