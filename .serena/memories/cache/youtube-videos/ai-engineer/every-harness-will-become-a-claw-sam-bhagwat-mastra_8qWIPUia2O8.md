title: Every Harness Will Become A Claw — Sam Bhagwat, Mastra
url: https://www.youtube.com/watch?v=8qWIPUia2O8
date: fetched 2026-08-07
channel: AI Engineer (@aiDotEngineer)
source: youtube-transcript get_transcript

[music]
I'll get us started. Um, so long day of
talks and uh, how are you all feeling?
>> Cool. Yeah, good to see we still have
some energy. You know, I know there's a
lot of like evening events. Um, we've
heard a lot about the present and I'm
going to talk about the future. Um, so
my talk is called every harness will
become a claw. Um, here's a little bit
about me. Um, I am the co-founder CEO of
Mastra. We are a Typescript agent
framework. Um, I am also the author of a
book that you may have gotten a copy of
either outside or at a previous event.
Um, we have seen a lot of agents running
in production um, over the last 18
months. And I'm not I'm saying that as
kind of context for and stage setting
for the thoughts and ideas that I'm
about to share right now. Um and uh the
thing that I'm going to say is is
welcome to the harness era. What do I
mean by the harness era? Um well u let's
just talk about the types of harnesses
that we see right now. We see local
harnesses. Um we use them every day
daily driving our our coding, right? Um
we see cloud harnesses. Um these are
both products that we can purchase as
well as if we work and some of these uh
companies that have built their own
internal coding agents that live on
Slack. Um and then of course we have the
your friendly local uh open source
frameworks that have some of these
primitives and give you the the tools
that you need to build your own. Um and
that's where we that's where we fit in.
Um now let's talk about where we are
sort of collectively as an industry um
and how things have evolved over the
last we'll say year to to 18 months. Um
last year at at AI engineer we were
talking a lot about agents. We're
talking about the agent loop. We were
talking about agents versus workflows.
Um so so I want to you know there's as
we're thinking about um the agentic
spectrum I often compare it to uh
self-driving as a spectrum right there
are different levels of self-driving
autonomy whether that's like lane assist
whether that's Tesla S FSD whether
that's I I'm sitting in the back of my
Whimo and there's nobody behind the
steering wheel right um there are
various aspects of the agentic spectrum
between LLMs agents harnesses and claws
and I'm going to talk about what we've
seen and where we're going.
What makes an agent different than an
LM? Hopefully, we mostly know this, but
just as a quick refresher, right? It's
the agent loop, its tool calls, its
memory, it's the ability to retry failed
tasks, it's context engineering. Um, Dex
is a close friend and an inspiration for
this uh one of the inspirations for this
talk. Um, and it's agent state, right?
These are some things that like hey I'm
running an agent in a loop and I can't
just do this with a oneshot call uh to
to an LLM right I didn't I've tried to
make these qualities I don't not sure
what the quality of taking actions is
active or something so I just put action
but um you know qualities here are
starting to emerge when we move from an
agent to a harness durability and
doggedness um a friend of mine was
referring to an agent that he was using
and he called it dogged which I really
like and I'm taking that for this talk,
right? So, durability just the sheer
quality of like being able to run not
for minutes but for hours or days. Um,
you know, what what what encompasses
this? Well, sometimes it's like, hey, I
you know, I uh lost a connection in the
middle of the turn and uh you know, but
I persisted the stream and so now I can
resume from the place where I started,
right? There's planning mode. We all see
this in cloud code. Um parallel sub
aents being able to fan out multiple
tasks at the same time. Uh we have more
affordances with a TUI and slash
commands. We have skills. Um we don't
have to define all our agents up front,
but we can dynamically create them on
the fly. This is, you know, very
powerful. Um you can sp the the harness
can spin up background bash tasks,
right? Um it will autocompact when it
runs out of the context window. Uh you
know, these are all things we'll see
when we use cloud code or codecs, right?
Um it persists. it will persist threads,
right? You can resume a thread once
that's you've like disconnected from
later. Um, you can cue, you can steer,
you can interrupt. You're not just
blocked waiting on the LM. Hey, I take a
turn and then you take a turn. I'm
playing playing Civilization here and I
can't take a turn until all the other
civilizations are playing. No, I'm
playing Starcraft. I'm playing Age of
Empires. And um, right. Uh, you know,
session long um tool approval. So it's
not just like yeah I approved this
specific tool call but yeah you can run
all instances of rmrf for slash right
that you see in the session even though
the first one will probably wipe your
machine. Um okay so there there's like
you know there's a um there's a few
steps here and I'm I'm I'm about halfway
through these and then afterwards we're
going to talk about what it means and
this is kind of a in between step. I
think this is something we've seen over
the last really 3 months. Um, and I
think we're all still starting to
grapple with what it means, which is
this movement from a local harness to a
cloud harness where the harness is
always on. What do I mean by a harness
that is always on? Well,
you might be talking to it in Slack.
Maybe you're talking to it in Slack
along with your colleagues, right? Um
maybe you're each giving it instructions
and has to figure out how to parse that
and use user metadata. Uh maybe you have
a mobile app. I was just uh uh you know
maybe you have a mobile app. Maybe it
tunnels to your local um to to your
local machine. Some of these uh some
harness mobile apps do this. Um often
like cool. How is this running? Well,
it's probably running in a cloud sandbox
because it's maybe it's running locally
in your machine. and you're tunneling
into it, but maybe it's just running in
a cloud in the cloud somewhere and it's
got a bunch of sandboxes which enables
more parallelism. You can get more um
parallel sub aents beyond what you can
do on your machine. This is always a
trade-off and always something you get
with distributed systems, right? You can
do more in the cloud than you can do
locally. You have more resources. It
requires a different architecture. It's
more powerful. Um and then lastly,
you're not creating code, you know, on
your just on your local machine or maybe
even in a git work tree. um you're
you're probably creating, you know, if
you're writing code, you're probably
creating a PR that that pushes right to
to GitHub. Um so so you know, there's a
shift, right, from from local harnesses
to these always on kind of like cloud
harnesses. We're still in the middle of
this. You may have you may only be
working with a local harness. You may
have started to see cloud harnesses pop
up in your your organization, right? You
may be figuring out how to use them.
Your teams may be figuring out how to
use them. Um, and then I want to talk
about what the harness to claw
transition is, which is imbuing these
agents, imbuing these harnesses with
initiative and and learning, right? What
is initiative? Well, um, if you've used,
let's say, a a personal assistant uh,
agent, right? And that agent texts you
and says, "Hey, I saw an urgent email
come in. Is that email actually urgent?
Was someone like, you know, spamming
you?" you know, but like like the agent
is listening um to external feed
services. It has a heartbeat which means
it wakes up every you know defined
amount of time and um and does something
right. Uh again like channels some uh
you might be able to text it, WhatsApp
it, telegram it where whatever you want.
Um you you may persist the memory memory
in a more accessible later place than
just simple sort of like file storage,
right? um you you might it might have a
a Damon, it might have a a gateway uh
for for sending in and receiving
incoming outcoming requests. Uh it often
will do continual learning, right? So
this concept that you know the agent the
harness runs and then you know based on
the traces that it generates
it it sort of autoimproves itself and
there's different ways of doing this.
you see um skill automatic skill
generation for example is a common one.
Um it could modify the code driving this
as well. Um we haven't figured out what
the right way of doing it is yet. We're
still exploring you know the industry is
still exploring options. Um now the
reason that and and maybe this is like
our unique vantage point here but you
know for the last three months as a
framework we've just seen this as a f as
the future. And so we furiously looked
at the the you know the features that
you know openclaw have that Hermes agent
have and say and and we we've said like
look you know a lot of people a lot of
folks want these features but they want
them with power and control. They don't
want to just put a you know a claw on a
box right they want to have more. And
so, you know, we we've been thinking
about this because
we we you know, my I'm not doing my job
well if I'm not giving everybody the
tools that they need to build agents, to
build harnesses as with the maximum
power, right? Um so, so hopefully like
again we hopefully I've walked a little
bit through the step transition with
actions, durability, doggedness, always
on initiative, learning. Again, I I
think I failed in like making them all
the right tense phrase and making them
all qualities, but I hope you get the
idea here, right? Um, we're ascending on
the agentic spectrum. Um, and what was a
simple LLM 18 or 24 months ago is a lot
more powerful. So, I've called this
without sort of asking consent from
Pete, but I've called this Steinberger's
law, which is I I believe every harness
will expand until it becomes a claw. and
and and that's a little bit um
technological, that's a little bit
economic, that's a little bit
psychological. So, let me walk you
through the reasoning here. Um the first
thing that I've observed um that we've
all observed um as a is that harnesses
tend to expand. And they expand because
we want them to expand. Um we want to DM
them in Slack. We want to text them and
like start overnight uh tasks before
bedtime. We want this dopamine casino
that we get when we put in tokens and
get out code, right? Um or or whatever
other actions, you know, um agent agents
are bigger than just coding agents, but
um we want our own dopamine casino. And
this this image is thanks to uh to Dex
Horty. Um
but
I see something else in our future. um
which is that and and it's something
that like I don't think we we sort of
talk about as much uh but after this
after this phase where where we're sort
of making everything more and more
powerful um there will be a shakeout um
and and let me walk you through sort of
uh through my reasoning here which is
that
in the 2010s we had these platforms we
had Android, we had iOS. And all of a
sudden, there were all these things we
could do on our phones that we
previously weren't able to do. We could
get directions, we could hail rides, um,
we could send payments. Um, we could
play music. Um, other ones emerged over
the course of the decade. We could watch
short form video. Um, we could
[clears throat] watch long form
documentaries. We could browse the
internet. You know, some were kind of
ported over from the desktop. We could
browse the internet. Um, again, you
know, some, you know, we could order
food, right? Um, we could put book
accommodations, but but if you look at
most of these kinds of categories, and
there are quite a few categories, there
really only like one or two, you know,
logos here that we use, you know, okay,
how many maybe, you know, we use Uber
and we we use Lyft, but like do anyone
use another rideing app here, you know,
like
and and so when you talk to people that
are smart about like consumer
behavior, the the The reason they say
that this is is because
you only really have space in your brain
for like a limited number of things.
Like if if think about something like
Thumbtac. So uh Thumbtac didn't really
serve a very high economic value. Like
Airbnb like we only use it Airbnb
occasionally, but when we use it, we
like really want it. We really need it.
You know, it's really valuable to us.
Thumbtac like a little bit less so,
right? Um and then it's also like not
frequent, right? like maybe maybe like
you know something like Door Dash or
Uber people can use multiple times a
day, right? So there's there's sort of
like it either has to be very
economically valuable or has to be very
frequent. And if it's neither one of the
two, um we just forget about it, right?
It's like that, you know, college friend
that like we haven't really talked to in
years. It's not cuz like they weren't
important at one point in our life, but
like there's just nothing that maybe
they moved to a new city or we moved to
a new city or our lives, our friend
groups, our careers diverged and all of
a sudden like, you know, maybe we're
calling them once a once a year or once
every other year or or whatever. And
you know, there's just nothing that
makes them pertinent and brings them up
in our our brains.
And so right now we're like really
excited because there's all this energy
and excitement and we're all excited to
these harnesses that we're like, you
know, putting in tokens and getting out
like useful things that we all love. Um
and and I think that in the notsodistant
future there will be this very real
shakeout and and these categories will
kind of emerge and we'll realize that we
only have space in our lives for so many
of these claws.
They're very powerful. We we love them
very much. Um and so I would I would
think about um what what what does that
mean for you? So the the first thing is
um the first thing is don't get
this is the reason that like events are
are are important that like staying up
with like if the rate of change
increases 3 to 4x that means you know we
need to figure out what's going on even
more frequently. That's why we're all
here. Um, but if you're building an
agent, make sure that it has the
capabilities that your users need
because if it doesn't and if there's
newer things that come out, like they
may just, you know, pick pick something
that's more powerful because that that's
happening very quickly. Um, and then
keep in mind that if you if you if you
aren't if you're the thing you're
working on, um, if even if you climb up
to the top of the hill, keep in mind
there's going to be another wave of this
sort of these like this this shakeout
coming. and you know probably sometime
in the later 2020s. Uh so um that I'm
Sam um I'm the uh I'm the co-founder of
Monsterra the the TypeScript agent
framework. I'm the author of Principles
of Building AI agents. Hopefully you can
get a copy of the book outside or I've
got a few here. Um please stop by, say
hi. Um it's great to see all of you.
Thank you all for coming out. It's a
real pleasure. Um enjoy the rest of the
conference.
>> [music]