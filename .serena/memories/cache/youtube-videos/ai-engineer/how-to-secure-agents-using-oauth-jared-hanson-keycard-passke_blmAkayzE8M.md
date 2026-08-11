title: How to Secure Agents using OAuth — Jared Hanson (Keycard, Passkeys)
url: https://www.youtube.com/watch?v=blmAkayzE8M
date: fetched 2026-08-07
channel: AI Engineer (@aiDotEngineer)
source: youtube-transcript get_transcript

[Music]
Thanks a lot everyone. Thanks for coming
out. Uh we're going to talk about a
topic that I consider one of the most uh
important topics uh for what we're doing
with AI and agents, which is how to
secure agents using OOTH. Um I'm Jared
Hansen. I'm the co-founder of a new
company called Keycard where we're
building identity and access management
platform for AI and agents. I'm also the
creator of Passport.js for any of the
node uh developers in the audience very
popular o framework and previously I was
at Ozero where I built a lot of their
core identity infrastructure and then
and then at octa
uh let's get into it. So I think we're
all super excited about what's happening
with LLMs and AI powered applications.
uh you know we can bring these things
into our daily lives and they automate a
lot of the tasks for us and and simply
put agents that are more connected are
more useful. Uh so let's connect these
agents to more systems. But but hold on
a second because today we face an
impossible choice. Uh we can give agents
broad-based access and accept security
risks or we can limit their capabilities
and sacrifice business value. Uh, and
this is exemplified pretty well in how
we set up uh, MCP servers today, which
is we go get API keys that are typically
longived and broadly scoped. We paste
them into some configuration files and
environment variables and and let our
agents run with them. Now, if we
continue this pattern for hundreds or
thousands of agents, we've got a pretty
big security problem on our hand. Uh,
luckily, we we know how to fix this. We
know how to transition away from static
secrets uh, to dynamic access using
OOTH. Now, show of hands, how many
people are familiar with OOTH in the
crowd? I'll say quite quite a bit. So,
I'll I'll burn through this quickly. Uh,
but just uh as a quick introduction, um
I'm not going to lie to anyone like OOTH
is a relatively complicated protocol,
especially when you consider all the
extensions. But the princip principles
behind it are fairly straightforward and
easy easy to understand. Uh what it is
is a protocol for applications which we
call clients in OOTH to request access
to APIs which we call resource servers
and and these requests are mediated by
what's known as an authorization server.
If you've ever used anything like
Calendarly and connected it to your
Google calendar API, you've experienced
OOTH in the real world. Uh what's
happening there is Calendarly sends a
request over to Google saying, "Hey, I'd
like access to this person's Google
calendar." uh Google C- Google's
authorization server then you know
ensures that you're logged in prompts
you for consent uh that you want this
access to occur and if you agree to it
uh Google sends what's known as an
access token over to Calendarly and then
Kalanley can take that access token and
go about accessing your calendar. Uh
there's a few other interesting bits
going on here like refresh tokens which
basically allows these access tokens to
be shortlived and rotated pretty quickly
while still maintaining the the
authorized connection. Uh and in OOTH we
call these types of flows that involve
user delegation uh authorization code
flows and they typically happen via
browser based interfaces that that
you've seen when you've used these types
of applications. Now one thing that gets
kind of confusing for people is that
OOTH is oftent times used to implement
things like signin with Google or signin
with uh Facebook. Uh and this is
confusing because we refer to OOTH as an
authorization protocol or a delegated
authorization protocol specifically. So
what's what's going on here when we use
it for signin? Well, this is really just
a special case where the API gets
replaced with a user info API that just
returns claims about the user who logged
in. So their ID, their name, their email
address, etc. And we kind of use
authorization to back our way into
authentication. Um, and this became like
such a common pattern that people used
with OOTH that it got formally
standardized as open ID connect which is
just an identity layer on top of OOTH uh
that standardizes the response format of
that user info API. Uh, it also does a
couple things that are kind of confusing
like introduce more terminology which
identity people are prone to do. Uh, we
call the authorization server now an
identity pro identity provider in in the
scope of open ID connect and
applications are known as relying
parties. Don't get hung up on the
terminology. It's it's all the same
thing.
Uh one other thing that open ID connect
does is it introduces an ID token. This
is simply a JSON web token which is a
cryptographically signed statement about
who the user is. Uh this overlaps a lot
with the user info API. You can think of
it as sort of an optimization that the
application can verify itself without
making API requests. It also serves some
functions in like ongoing session
management between applications and
authorization servers, but that's kind
of beyond the scope of introductory
material here. Uh in the real world,
these things get deployed together.
We'll typically run authorization and
authentication flows uh in line uh so
that you know we know who the user is
who logged in as well as get access to
things like their Google calendar.
Uh one thing to call out that is
important here is that there's three
roles in Oath. Uh the client uh and the
resource server I think are all
relatively straightforward. We
understand that from client server
architectures. The client requests act
uh resources and the resource server
responds with the data. Uh what gets
different is that we introduce this
authorization server in the middle that
mediates this access. Uh and it mediates
it by issuing tokens. uh issues tokens
back to the client which holds them and
then presents them to a resource server
and the resource server's job is to
verify those tokens. Now what's what's
the benefit of this sort of model? Uh
the main benefit uh flows to the APIs.
They don't have to care about anything
to do with authentication anymore. So
verifying user password or doing step-up
authentication, running the consent
flows, they hand all that job off to the
authorization server and it gets kind of
abstracted away by the token uh that the
API can verify what has happened. Um
there's also some benefits that we can
like centralize policy uh and then
deploy ecosystems of apps and APIs all
kind of protected by a central location
and and build out the the ecosystems
that we all know today.
Uh how do we apply this to MCP and
agents in in particular? Well, it it
should be pretty simple. Uh now our
applications get replaced by a chatbot
or agent like claude. Uh that we want to
connect to MCP servers. Uh we the MCP
clients and the MCP servers should get
authorized via OOTH by you know the
controlling authorization server in the
middle. This should be pretty simple,
right? Well, nothing with OOTH is ever
so simple. So let's take a look at the
state of authorization in MCP. Uh we're
going to look at at where it started,
where it is now, and and then where it's
going in the future.
So the first version of MCP, uh it's a
pretty young protocol. It's like seven
months old to the day, I think. Uh the
first version I like to call the NOOTH
version. It didn't have any
authorization in it at all, uh which
they admitted in the spec. It was really
a way to get something out there
primarily for uh local MCP servers. uh
there was some notion of remote MCP
servers uh but again no authorization
but this kind of spurred discussion
people saw the promise of MCP and and
started discussing how to add
authorization to it. Uh now we have the
latest draft of the specification uh
which was published in late March. I
like to refer to this as OOTH the first
attempt and for anyone who has ever done
OOTH implementations the first attempt
is always pretty poor. Uh, and that is
the case with this version of the
specification of MCP. Uh, I don't
actually recommend anyone read the
authorization part of the MCP
specification as it is today because
you'll walk away with a pretty
misinformed view of what OOTH is. But as
a quick recap, what it does, it says,
okay, MCP clients got to implement the
client side of of OOTH. That all makes
sense. And then it also says MCTP
servers. You need to implement all all
of OOTH 2 including authentication,
token issuance, etc. Now, OOTH has three
roles. Where's where's the third role
here? What happened to the OOTH server?
Well, it got collapsed into the MCP
server, which which is a bit odd. Uh and
people started noticing this. So, 5 days
after the specification was released, uh
a blog post went viral. Uh this one from
Christian Posta saying the MCP
authorization spec is a mess for the
enterprise. Uh and he states you know
the problem here is that it treats the
MCP server as both a resource server and
authorization server. Uh Aaron Perky who
does a lot of great OOTH standards work
uh followed this up with another blog
post that went viral titled let's fix
OOTH and MCP where he noted that you
know a bunch of the confusion that was
happening was because the diagram show
that the MCP server itself is handling
authorization.
Now then this kind of culminated in a in
a PR to the specification where uh
people proposed let's let's fix this
problem. Let's just shift uh the MCP
server to be an OOTH OOTH resource
server and everything will be good. This
is a super interesting PR to read.
There's like 400 some comments on it.
It's not even the only PR there. Uh but
just kind of a example of how people
just picked up on this problem and ran
with it. Now, I'm not usually one to say
I told you so, but all the way back in
January of this year, I commented on the
uh as a review for the specification. I
was like, "Hey, I recommend we model MCP
servers as as resource servers from an
OOTH perspective." I'm not quite sure
where where that got lost. It it didn't
get picked up, but in any case, uh we
fixed this problem. And one of the
reasons I'm here is to tell us all more
about OOTH things that we need to pay
attention to in order to avoid this
problem in the future.
Uh so, okay, the next attempt in draft
all this feedback has been incorporated
and the MCP spec is kind of like fixing
its issues. Um, and the draft version of
the specification models o all of OOTH
pretty cleanly and pretty nicely. Uh,
the OOTH authorization server is a
totally separate entity. And this is
really beneficial for all of you
building MCP servers because your job
gets a whole lot easier. All you have to
do is verify the tokens that come in
over HTTP and hand off all the other
responsibility to the OA server.
So, we're back to a pretty good place uh
with respect to OOTH and MCP and in
particular how we authorize connections
between MCP clients and MCP servers.
So, let's talk about the future. If if
this is all we do with OOTH, we're not
even scratching the surface of what we
need in order to fully secure AI and AI
interactions. So, what else are we going
to need? Uh we're going to burn through
this here pretty quick. The first is
agentto agent uh communication. So what
we've seen with OAS so far as it's
applied to MCP like I said that's
referred to as the authorization code
flow and it's particularly relevant for
when we want to do end user delegation.
Uh but there's a whole bunch of other
flows in OOTH uh that are relevant in
particular client credentials and this
applies when we want agents to
communicate with other agents or other
MCP servers on their own behalf not on
behalf of a user. So this is one thing
to pay pay attention to. The next, this
kind of begs the question, agent
identity. Uh, what should we do about
this? Well, if anyone's ever done OOTH
development, you you're probably
familiar with this type of flow is you
want to build an application. Uh, you
want to integrate with an API. You go to
some developer portal, create a new
application, get a client ID and secret,
and then somehow configure your uh
application with that those credentials.
Uh, this is a bunch of friction. This
obviously won't apply well to uh MCP
which is trying to be a standard pro
protocol and you want to bring tools and
agents together that that may not be
aware of each other. Uh you can't do
this if you presuppose some sort of
registration process. So what does MCP
do? Uh well it picks up what is known as
dynamic client registration. Uh what
this does is allows applications and
agents to request credentials at runtime
rather than like ahead of time in manual
registration. Uh so an agent says hey
like this is who I am give me a client
ID and secret the server does it and the
agent goes about the rest of its ooth
flow. Now this specification has been
around for about 10 years and in
practice has seen like no meaningful
adoption and one of the implications
behind this is it like makes all agents
anonymous because the registration
request itself is uncredentialed. This
makes it hard to build trust in agents.
It's probably not super viable in my
opinion.
So what should we be looking at instead?
Well, there's many cases where we just
want to use public clients that we don't
really care about verifying their
identity. In this case, there's an
emerging specification called push
client registration uh which introduces
this kind of like well-known string to
identify a like public client. Uh we can
just use this well-known string and we
skip the whole registration song and
dance and then the need to store the
resulting state. Uh this is but a lot
more simpler. It also has the capability
to carry uh certain client metadata in
the request if if that's necessary. So
this is something we should look in for
cases where public clients apply.
Uh but what about clients that we
actually want to authenticate and verify
their identity? Well, my proposal here
is that we should start looking at uh
using URLs in PKI for identity. Um, this
lets us reuse the existing identifiers
that people already associate with the
apps they're using and and can repurpose
them into the agent world. This looks
like in practice we'd have a URL such as
uh, you know, agent.com to be used as a
client identity in OOTH flows and then
through the magic of uh, cryp
cryptography and key sets, we can
authenticate these agents by having them
sign uh, jot assertions or HTTP message
signatures that we can then verify with
with the corresponding public keys.
All right, this dub dovetales into agent
add astation. Uh, we've connected our
agents to the resources that we're
using, but then that agent turns around
and sends all that information up to an
LLM. This seems like something we should
probably have some awareness of and
control over. Uh, so in kind of
protected environments, we can sort of
get by like treating the LLM as just
another API, which often it is. uh and
this is a technique we could apply but
it has limited uh capabilities when we
look at like edge deployed agents such
as on the desktop or mobile devices
where we don't really control their
software environment. So there's a bunch
of interesting work going on in the IET
app now with respect to like remote
addestation and supply chain uh security
where we can start to ad attest to the
state of the device and the software
running on it and know what LLM our data
is going to wind up in and then
incorporate that into OOTH authorization
flows.
Next up transactional authorization what
we've done to date in OOTH uh is uh
introduce scopes. This is a whole lot
better than passwords which OOTH kind of
replaced back in the day uh in the sense
that now we can do more fine grain
permissions such as like read versus
write access. Um but in practice these
end up being a little bit too coar
grained for a lot of use cases and
oftentimes a little bit longer lived
than than we might like. Uh in in agent
interactions we're going to have to be
increasingly transactional. So imagine
use cases where you want agents to do
financial trans transactions or
commercial transactions. We're going to
want to authorize things on a
transaction basis potentially with uh
specific amounts or or financial
budgets. So we're going to have to look
at moving to more dynamic access in this
respect. There's a proposal that's
actually like a specification at this
point called rich authorization requests
which is which is worth looking into um
and something that we can take
inspiration from or either adopt
directly for these these use cases.
Next up we have chain of custody. This
is uh particularly interesting to me. Uh
what we talk about with MCP really
covers the first leg of this. On the on
the lefth hand side we have authorized
connections between agents and MCP
servers. But what happens on the right
side is completely unspecified in terms
of like the security pro profile. So how
do we protect an MCP server that calls
another API within the same domain? In
particular, there's a technique called
OOTH token exchange that I recommend
everyone look into. Uh special case of
this is MCP servers to third party APIs.
In this case, uh we should look into
identity chaining across domains. uh and
its corresponding specification the
identity assertion grant which lets us
do cross domain authorization in the
back end. Somewhat outside the scope of
OOTH is other internal infrastructure
that people should be aware of as they
look to deploy these agents. And then
the culmination of this is really
agentto agent flows where uh I don't
know how much of this is happening in
practice today but people see the
promise of it. Imagine big graphs of
agents talking to other agents on other
servers. We're going to need endto-end
visibility as the authorization flows
along these graphs.
Finally, async interaction. Uh I think
one of the key things to look at here is
like OOTH typically assumes a user is
sitting in front of a browser and
relatively static, but as we kick off
flows, users might walk away and agents
do work in the background. They're going
to need a way to reach out to the user
and say, "Hey, I need a bit more access
than I've been permissioned." How do we
think about bringing more like real-time
interactions via channels like SMS or
push notifications rather than just
browser based flows?
And then a hot topic today, uh there's a
bunch of interesting work going on in
the voice voice track at at the
conference. Uh as AI starts to interact
with us via voice and video or
completely in the background, how do we
think about security in those respects?
This is really the frontier of of
security and inter interaction. But
there's a lot of prior art in various
real-time communities around SIP, XMPP,
XMPPP, WebRTC that uh I think is very
interesting for us to all look at.
So there's a lot here. Let's let's go
build this stuff. It's all important for
us uh to to achieve a safe and secure AI
future. Uh this is what we're building
at Keycard. Uh we're building an
identity access management platform that
lets you connect your co-pilots, custom
agents, and thirdarty agents to all your
apps, services, and infrastructure all
using standards compliant protocols,
ADA, MCP, and OOTH.
If building this stuff is interesting to
you, we are hiring hiring. So get in
touch with me. And if you're if it's not
interesting to you, but you know you
want to secure your agents, get in touch
with us, too. We're looking for partners
that are building uh so that we can work
with you to secure secure your agents.
Uh the website site is keycard.ai and I
will be around the rest of the
conference. Thanks.
[Music]