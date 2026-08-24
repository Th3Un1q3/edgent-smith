[music]
Hey uh let's get started. Uh good
morning everyone. I'm Udai. I'm here
with my colleague Adam. We'll talk about
our journey towards manage software
factory. And in the beginning in the
first part of the talk I'll talk about
the key building blocks that we are
investing in. And later Adam's going to
talk about how we take all of these
blocks to build an end to-end cohesive
solution for our engineers. To set some
context, we have few thousand engineers
across 12 global tech sites. Over the
last year, all of the investments we
made in agentic AI have led to more than
70% of our PRs now either by local or
cloud agents. And all of this led to
twice the number of lines of code per
engineer year-over-year. And this
extends way beyond coding and we see it
in every aspect of the engineering life
cycle today.
And we are also accelerating toil at a
toil reduction at a massive pace. We
handled more than 250 automated
migrations
9 million lines of code automatically
for our engineers.
And before even the building blocks um
you know one all the investments we made
over the last six years on moving to
monor repos moving to basil all of that
also laid a really solid foundation for
us to accelerate this.
So the first I'll cover all of these six
building blocks and Adam's going to talk
about a specific example and show how
that feature can be built end to end uh
with all of these and all of these are
in various stages of maturity and
rollout within Uber. But we want to give
everyone a sneak peek of what we are up
to.
So let's go to the building blocks the
six building blocks one by one. The
first one is model gateway. This is one
of our earlier investments. The three
things that we wanted to en ensure was
no PII ever leaves our parimeter to any
of the vendor by default and any
guardrail that we add here the latency
of that is strictly bounded and every
request that goes through this whether
it's uh and we need to be able to
attribute per user per project and per
team. So [snorts] we have a model
gateway. We made sure all of our
internal use cases, our coding
hardnesses, our external use cases, they
all go through one single OpenAI
anthropic compatible endpoint. It goes
through a series of middleares. The
first one is identity and authentication
using Spire. Uh we have a data
anonymizer that redacts 20 plus PII
types. We have a AI guard that has five
specialized models that handles various
parts of safety and policy that we want
to ensure. And all of that runs under
100 milliseconds. We also are investing
in all kinds of caching and token
optimization strategies at this layer.
And every request that goes through
this, we are able to attribute to a
specific project in our catalog. And we
can attribute per caller, per user, per
team both in real time but also in our
data lake. This enables us to create all
kinds of spend years and guardrails in a
holistic way across our portfolio.
We also use this layer for capturing
audit log session traces which are then
plugged into our benchmarking and all
kinds of self-improvement loop efforts.
And for an engineer at Uber, you take
the vanilla client, you set the project
ID and we and we take care of everything
else. Today we have 800 plus projects
internally going through this
cumulatively handling more than 100
million model requests per day. This
includes both the frontier models and
also open source models whether that is
hosted in our infrastructure or some of
our vendors.
The next is how do we provide tools to
all of these models. Last year when we
started on this journey we had thousands
of internal APIs but none of them are
agent accessible out of the box and we
had so many other SAS tools and each one
of them have different way to
authenticate different way to set up
which is a lot of hassle for for
everyone and once you end up with enough
MCPs they'll all add up to and and have
a massive token tax similar to model
gateway we have an MCP gateway that
handles whole bunch of middleares for
for engineers And we have an automated
crawler that looks at our internal APIs
and projects all of these into MCPS with
one single config change. And we do the
same thing even for our SAS MCPS whether
it's Google, Slack, Jira, all of this,
they go through the MCP gateway. We h we
host them, we do the token exchange. So
for all the engineers, they go through
one single entry point, one common way
to install any MCPS. This simplified a
lot for all of our engineers and
employees.
And then the whole bunch of token
optimization strategies. We initially
had direct MCP pattern. Earlier this
year we created Omni MCP which is one
single MCP that you install which can
discover and invoke any MCPS within the
gateway. And couple of months ago we
projected all of these MCPS into CLI
pattern so that even the response
doesn't eat up in your context. And of
late we also have a code mode skill
which is autoinstalled which on the fly
creates Python scripts to hyper optimize
some of the top MCP token consumer
consuming use cases
and all of this led to like now we have
thousand plus MCP tools and uh just with
these optimization efforts we've saved
more than 40% fleetwide savings.
So once we have the models and the
tools, we need a place to run all of
this. For many years we had devpod which
is our cloud remote environments. We we
we had this because we had like large
mono repos with millions of lines of
code and this is how engineers work at
Uber. And now we took what we had with
devots and we agentified that. Now we
need some environment for agents to run
for longer period of time. They need to
be quick. They need to be isolated. We
can install any number of them and they
need to be globally available across all
of our sites.
So we have a pre-provisioned Kubernetes
balloon pods. When an agent requires a
new environment to run, it can take one
of that which is already
pre-provisioned. It has all of the
repositories already snapshotted. The
search index is already built. So the
agents can start working within a matter
of seconds.
The next thing we noticed is the the the
roles of engineers are getting blurred.
We used to offer a dev port per language
flavor for Go, Java, Android and so on.
Now we need agents to work across
repositories and engineers also to work
across repositories. So we have a mega
dev port that has all of the
repositories in one one common place and
this is what we use for our autonomous
coding agents now. And even for our
non-engineer employees, we are providing
a simple way for them to get started
with any of the agent harnesses in
matter of seconds.
Then now we get to knowledge part of it
and we jumped on this bandwagon earlier
this year. Uh we started noticing
engineers building tons of skills across
many repositories. Um one three problems
we noticed was there's a lot of
duplication same skill being built by
different engineers in different
discovery and configuration was a huge
hassle and a lot of skills were of
superpar quality. So what we built an
entire life cycle around skills. So we
have core core skills and domain
specific skills. All of that go into a
managed skills marketplace. We have
2,500 skills there right now. Um and it
goes through a whole bunch of lint
checks, automated reviews which ensures
a baseline skill quality for any skills
that we have. And we also simplified the
installation and discovery. So there is
one single command to discover and
install any plug-in in our ecosystem.
And based on the engineer personas, we
even autoinstall some of the default
skills. So the agents automatically can
pick up the right skill. You don't even
have to even install them.
And of late, we started working on
collecting traces and comments and
capturing continuous evals so that we
can go give feedback back to the skill
authors for skill improvements. And this
is an area of big investment for us
right now. and we have 2,500 skills and
cumulatively more than 20,000 skill
executions per day across our fleet.
The next piece of knowledge is context
graphs. Uh we we started noticing in our
execution traces agents spending lot of
time even trying to find basic context
especially in our large monor repos. You
need to identify where the service is
located, what are the dependencies, um
who owns it, what kind of patterns I
need to follow. And all of this context
is gathered across scattered systems
across Uber. There's 20 to 30 different
systems. Each needs its own skill
skills, its own MCP to gather the
context. And this burns tokens. This
adds a lot of latency and it creates
more unpredictable outcomes.
So we have one context graph. We took
all of the information of how Uber runs
into one context graph. This has 150
unique node and edge types. We have 40
million entries there right now. It
captures all the way from how our mobile
apps are built to our back end to our
data lake. All the design docs, Jira,
incident bugs, everything is connected
and this enables agents to quickly find
the right context within our ecosystem.
We are now plugging all of our skills
and use cases into the graph whether
it's our on call RCAs whe it's a
planning or data analysis or security
scans and we see across all of this they
we are improving uh the skills by a lot
and I'm just showing a very simple
example of asking a simple question of
how many mobility trips in India are are
cash this needs to understand the
concepts of each of these which tables
what kind of cities you need to create
for this SQL with and without graph we
see massive improvement in tokens, turns
and latency and we see that across any
earlier val that we did within our
infrastructure
and the last thing is how do we package
all of this for everyone in the company
to use. So we have uh our AI assistant
called Cortana. All of the things that I
mentioned so far, whether it's skills,
MCPS and context graph, they're all
plugged into that in every surface
possible whether it's on Slack, CLI,
web. So anyone in the company, they can
ask a simple question. It can look up
the context graph, invoke any skill,
check any code, check any code in any
codebase and give an answer across any
of these surfaces.
And now we started allowing employees to
even personalize that. You can hook up
your custom skills, custom prompt and
hook it up into your team Slack channel
so that it it knows all of the things
about that team and works like a the
that teammate.
And this this is a simple example of how
you can invoke the same question before
in Slack. Um and all of the employ more
like one or more people can even
collaborate on the same Slack channel.
And we have the just in the last one
month 300 unique personas created and
more than 20,000 sessions per day. I'll
now pass on to Adam who'll talk about
how we take all of this and build uh
take and ship a feature end to end.
>> All right. Thank you, Ud. All right. And
as Ud said, we've got those building
blocks. We're going to use those to
power our software factory. So, we're
going to take a feature here and show it
going end to end through this.
All right. First up, right, we need to
have an idea, right? A good idea
probably for this moment would be
something around the World Cup, right?
Would it be awesome if you were a writer
and you were leaving a busy stadium if
there was a better pickup location to
get you away from the crowd? So, that's
the idea, right? We have our idea. We're
jamming on it in Slack here. Let's tag
in Cortana, right? That's our AI
assistant to help us with that idea.
Cortana with that context graph can help
us determine whether this is a good
business opportunity to go after. So, we
can go here from Slack and now open
Cortana into a web interface.
And you'll see an example here of what
that business research could look like,
right? What other largecale venue events
have happened before? What are some
stadiums that would make sense here?
From there, we start to think about the
product requirements, right? This should
be probably just a North America rollout
since that's where the stadiums are. We
can even then bring in Cortana to help
us think about uh the Figma designs. We
can create some initial mock-ups, right?
Do two variants here. We want to run an
experiment A and B. So the the button
strings here are different between the
two. So we'll test those two variants
and see which one performs better.
Now we'll start to think a little bit
about the design and Cortana 2 can help
us think about what code changes we need
to happen, right? What can we leverage
that's in the app already? what screens
and what can we leverage on the back
end. Right? So this process before could
take a long time. It could take weeks to
get everyone aligned. Now we can
compress this into a very short amount
of time now. Right? And get to a
prototype here very quickly.
All right. So now we got to go build
this. So we we hand off from that
Cortana agent to what we have at Uber.
We have a Minion agent. It's a Uber's
cloud coding agent solution.
All right. So you can use Minion in an
interactive mode or you can run it in an
autonomous mode as well. So I'm going to
show you what this looks like. Um UD
mentioned the dev pod building block. So
this is powered by that dev pod. So it's
got a full build environment and it can
work across repos. So we're doing
backend changes and the front end
changes here too as well. We're going to
see Minion kind of progress here and
it's going to stop at just creating a
draft PR and it's not going to push it
to CI yet. The reason being is that we
were seeing um uh that this was great
for doing like toil sort of workloads
but to build more advanced like endtoend
features we really need to be able to
validate uh the feature first and we
want to prevent a lot of extra load
coming on to CI. So if we can validate
sooner before we push to CI um that
would be a big benefit.
So that's what we're going to see here
next on validation. Right? In the SDLC,
we have an inner loop. We have the outer
loop. Of course, we can have these be
aensified where we're shifting more
checks now to happen in this inner loop.
Right? So, some of the checks that
initially happen that we've had there
previously is like this the static
analysis sort of checks. When those are
detected, now we fix those. But we can
shift things to happen in inter loop.
Things like visual validation. So, we
can launch an simulator with a skill,
grab a screenshot from the simulator,
compare it to the Figma specs. We can
also bring up the service and our
backend staging environment and compare
the front end and the backend
integration together.
So now that we've moved a um now that
we've done uh that part uh we move to
the outer loop where CI uh typically
happens errors can still happen on CI
right uh so self-healing CI is something
that we've implemented here where we can
fix a lot of the issues that you hit on
CI code review is another thing that
happens in the outer loop but this is
another thing that we've shifted we've
moved parts of code review to happen in
the inner loop right the outer loop code
review can have a powerful model use
reasoning a skill to do a deeper review.
And in the interloop, we can have a
smaller model that runs uh faster with a
with a with a medium model.
Now, another key thing here, right, is
this if this is an autonomous diff
coming from minion, we want to give a
human reviewer some confidence that this
diff has gone through a lot of
self-improvement already, right? That
not just touching that initial
generation that happened, but all these
other steps have happened. And so on the
PR, you will have a table attached that
says all these different checks that it
went through, including the screenshots.
All right, so we've got a lot more code
coming through the software factory now,
right? Let's talk about maintenance.
Right, maintenance is even more
important. Um, what we have set up now
is we can actually enroll our feature or
skill into u our feature or ser uh
service into maintenance uh skills. So
these are uh some examples of those
skills that we have. Uh feature flag
cleanup, right? We had two variants of
that world cup uh modal.
Now that the the B variant is no longer
needed, we can have that scheduled on a
loop. So the key thing here is that this
is actually a managed loop that you go
to, right? We don't want thousands of
loops being set up across the company
without any bounds. You have a managed
surface that you go to to set up the
loop. So it runs on Sunday when we know
we have better uh CI capacity available.
U we also don't want to overwhelm
engineers that Monday morning with a
bunch of extra diffs. We want to control
how many diffs they're seeing on Monday
as well. Another cool key thing here is
that when that ski uh skill runs and
makes those diffs, those diffs will get
comments and either get landed or not
landed. That's all good label data that
we can use to improve the skill itself.
And then at a kind of monthly cadence,
we're looking to see what skills can we
now learn um from in our incident
reviews and turn those into new
maintenance skills that we can apply to
all of our services.
All right, so you've seen uh these parts
of the SDLC that we've identified.
There's other parts too like monitoring.
Have you seen the uh building blocks
that you can use to power those and the
architecture underneath them? One of the
other things that we're really thinking
about now is bottlenecks, right? We're
now we're putting more strain on our
infrastructure. So we're trying to
anticipate where our CI capacity needs
to be and make the right foundational
investments there. There's only so many
experiments that we can feasibly run as
well. So that's another bottleneck. And
then lastly too, right, decision-
making, right? It's not about you know
can we build we know we can probably
build it now it's more of a question of
should we build it all right so that's
what we have for you today and the next
talk is going to be actually from Uber
as well and if you want to learn more
about our agentic code review aa and
will be presenting that next uh in this
room thank Thank you.
>> [music]