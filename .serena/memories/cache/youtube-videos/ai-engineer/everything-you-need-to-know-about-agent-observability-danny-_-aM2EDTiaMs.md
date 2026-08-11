title: Everything You Need To Know About Agent Observability — Danny Hernandez
url: https://www.youtube.com/watch?v=-aM2EDTiaMs
date: fetched 2026-08-07
channel: AI Engineer (@aiDotEngineer)
source: youtube-transcript get_transcript

Right. Hey everyone. So, today we're
going to talk about a pretty interesting
topic that becomes increasingly
important every day, which is everything
you need to know about agent
observability.
So, a little bit about
a little bit about us. So, I'm Zubin.
I'm the CEO and co-founder of Raindrop.
I'm Danny. So, I'm the back-end engineer
at Raindrop and I do a bunch of SDK work
as well up there.
And Raindrop essentially helps AI
engineers find, track, and fix issues in
production agents. And we're we're lucky
to work with some of the most
interesting teams in the space
as well.
Agent failures are very different than
traditional failures in software. So,
agents are non-deterministic.
They're unbounded. There's an infinite
space of inputs that you can put in.
There's an infinite space of outputs
that they can return. And they can use
tools sometimes to affect other systems
arbitrarily.
Uh
and this problem of agent failures and
monitoring them, making sure we can
understand them,
becomes only more important with time.
It's getting worse because A, agents are
getting more complex.
B, they're getting, you know, sessions
can get longer. Sometimes agents can run
for hours and hours without any input
from a user. And then lastly, the stakes
are getting bigger and bigger. This is
because agents are being deployed in
healthcare and finance and even in the
military, where it's catastrophic if
things go wrong.
The traditional paradigm we've been
talking about is evals, right? Where you
have this sort of test input and you
want to see what is the output that
comes out from the agent. You have a set
of these, you know, maybe you call it a
golden data set. But evals,
they just aren't enough with this new
paradigm.
As agents become more and more capable,
there's more and more interesting
undefined behavior that can happen.
So, for example, agents can call from a
set of different tools. Sometimes the
number of tools is growing
exponentially.
They can call from different memory
sources. They can call their own
sub-agents, which those sub-agents have
their own tools and memory sources, and
recursively can have their own
sub-agents. And so, this is just
becoming more complicated with time. And
with this combinatorial sort of input
space, just having a set of
tests for input and output doesn't cut
it anymore. There's no way you can
you can hit all of sort of the the edge
cases that you would want to here.
And so, we go from like a testing and
evals paradigm to a monitoring
paradigm. And if you think of building
products before agents,
you know, testing was always very
important. It's important to have your
unit tests, etc. But monitoring
production is just infinitely more
important, and it allows you to move
faster and be better at catching the
long tail.
And we think in some ways this is very
this is kind of controversial, but we've
been calling this like humanity's last
problem. When humans are now no longer
able to monitor agents and find issues
with them, then they're just way ahead
of where we are, right? And so, this is
one of the most important problems of
our time is catching issues in
production agents.
So, to build reliable agents in
production, and to make sure you can
monitor them, you need a good set of
signals.
So, what are signals? There's two real
types that we think of, implicit signals
and explicit signals. Implicit signals
deal with sort of the semantic nature of
what's going on.
And explicit signals deal with objective
reality, things that are
uh are verifiable true or false.
For example, explicit signals are things
like error rate. You really want to be
monitoring your tool error rate and
other errors that are happening.
Or latency. Or users regenerating. Or
the cost. If any of these things spike,
right? If you're seeing error rate spike
in your agent, that's usually a good
sign that something is wrong. And if you
see it flat, that could mean something
as well. Same thing with latency,
regenerations, or cost.
Implicit signals are
interesting. They're even more
interesting, in my opinion, and even
harder to find. So, the first is regex
signals, which I'll come to in a second.
The second is classifiers.
And then the last is self-diagnostics.
So, let's take these sort of classifier
signals. The best implicit signals are
detecting issues. They're not
necessarily LLM as a judge judging
outputs. So, for example, how good is
XYZ response? Or rate ABC on a scale
from 1 to 10? Not as effective as having
a very solid set of issues you're
looking for. And sort of binary
classifiers that are telling you if
issue rate is going up or down.
So, some common implicit signals that
are valuable across agent products are
things like refusals, right? So, the
assistant saying like, "I can't do that.
I'm sorry."
Or task failure, where something goes
wrong and so the agent is unable to
complete a task. User frustration,
uh content moderation, NSFW,
jailbreaking, and then you can even have
wins. So, positive signals as well.
And these are the things that like
Raindrop gives you out of the box uh as
well.
But,
let me just show you
sh- uh quickly what this looks like. For
example, uh can everyone see this? Maybe
I'll make it a little bit bigger. So,
you can get a sense of like day by day,
what are sort of the events that are
causing user frustration. We see there's
a spike there,
uh or task failure rate, laziness,
refusals, which we're also seeing spike
today. And having a good set of these
really helps with your your product. You
can set these up yourself uh as well, or
we give it out of the box. So, let's
look at user frustration.
You can see here, okay, that is not
correct. You didn't say I promise, say
it. Or you're wrong, I didn't ask you
that. You can see all sorts of user
frustration here.
And you can see the rate, the percentage
every single day. If that spikes, it's
something you're really going to want
alerting on. So, you can just like
quickly add an alert here.
Um and this is one way to figure out
sort of the health of your agent over
time.
It's not just that, regex can be a very
good signal as well. So, when Claude
code source code leaked a few days ago,
one thing that was interesting was this
user prompt keywords.ts, which was
basically this like long uh regex string
that was looking for indications of
stuff going wrong. WTF, this sucks,
horrible. We've all been uh guilty of
saying these kinds of things to to
Claude code. So,
it's a very very useful signal. What
would happen after that is this boolean
is negative was be flipped to true, and
then every single day, and after every
single product release, this frustration
rate was tagged over time. And this was
a very easy way for the Claude code team
to figure out like what is the actual
issue rate. If we make a change, is
something going wrong? And it was just
like a very cheap way to do that as
well. So, regex is very powerful.
The last is experiments. So, what do you
do once you have a set of good signals?
So, the first thing is, like I showed
you before, you can have alerting. The
next thing you can do is you can
actually use it
to build product faster and better.
So, the way you do it
is let's say you want to ship some
improvement or some sort of fix. You
want to change the model. You want to
change prompting or maybe something
about the agent harness. You want to add
a new tool.
Whatever you change, what you can do is
you can ship it to some percentage of
users
uh and then have your additional
existing control group. And that gives
you a good sense
once you have a good set of signals,
refusals, user frustration, etc.
If those issue rates go up, those signal
rates go up after this ship, this new
thing you shipped,
that kind of is a good
you know, that's a good signal
that what you shipped is not really
good, right? It's sort of like AB
testing, but using our semantic signals,
etc. that we talked about earlier.
Um
So, for example, this is what it would
look like in Raindrop, but essentially
let's say I ship a new version of the
prompt, prompt 2.4.
You can see, you know, what is the user
frustration rate?
It's gone down very substantially, 37%
to 9%. It's much better. Same thing with
complaints about aesthetics or
deployment-related issues. These have
all gone down, which tells me something
very interesting, right?
The next thing is that we see that the
average number of tools used has gone up
a lot. This is again, this doesn't
necessarily indicate there's a problem,
but that's a very interesting data point
to have when you do when you do these
sort of experiments. And so, the old
paradigm, which is still useful, is like
sort of evals. You ship a change here
and you see how does that affect my
evaluations, but there's nothing like
actually seeing what happens in real
production.
I'm going to pause here before we go to
the next section, which is the more like
workshop-related section
uh for like quick Q&A if anyone has a
question has questions. we can do a
little like few minute round of that uh
here.
How much data do you need to
How much data do you need for
statistical relevance in these
experiments? Yeah, it's a really good
question. Um
what we've seen in Raindrop is that as
soon as you have a few hundred events
and you can no longer read all of them,
it starts being useful. It's not always
like scientifically
statistically significant, but if you
see the user frustration rate go up,
maybe it's something to look at and then
you can kind of sort of realize that,
"Okay, it's all related to a specific
tool failing now." Um
so as soon as it's like impossible
basically to read every single input and
output, uh
it starts being useful is what we've
seen.
Any other questions? Yeah.
Um have you tracked different feature
launches?
Uh how do you track feature launches?
So, that can be done in different ways.
Within Raindrop, if you change any sort
of metadata, if you send,
you know, for example, a new tool call
name or if you you even send a flag that
says, "Here's experiment one or
experiment two" or whatever the version
is,
you can very easily automatically set up
an experiment in Raindrop. That's how we
do it. Um but there's like yeah, there's
different ways. Do you use split tests?
Sorry? Do you use split tests?
Yes, so that's what Well, the way that
we do it in Raindrop actually other
people set up their exper- experimental
and variable uh their
the other conditions on their end and
then they send us this metadata and then
we can sort of help you understand. We
also will help you pipe that data to
Statsig or somewhere else uh as well.
Um yeah.
All right. Yeah.
Using graphics for detecting uh
like uh
user responses, emotions, narratives
unreliable. But if the user doesn't
speak English, for example,
so are you using LLMs to detect those
signals
all the time or you're trying to be
smart about it?
>> Okay, so I mean, it's a good question.
So regex is doesn't always work, right?
But if you see that
on a set of things that I'm looking for,
for example, like people saying "You're
terrible" or "This sucks" or like a
whole set of things, if that goes up
for millions of users and it's going up
10%, that's a very useful signal. So
even if you're it's like one specific
case or one edge case of it not working,
in aggregate, it's like incredibly
valuable to have these regex signals.
Uh, the second thing is that the way
that the classifier signals work, like
refusals, user frustration, task failure
that I showed you in Raindrop, and
people do it in different ways, but the
way that we do it is that we've
trained models to look for that, and so
it'll be user frustration regardless of
what language it's in.
Um, it's actually using some
intelligence to find that, essentially.
Uh, yeah.
You can't run an LLM on every single
output, so we've trained models to do
that very cheaply and at scale.
Uh, if you run an LLM on every single
one of them, you would basically double
your AI spend, and that's like not
tenable.
Um, yeah. I'm actually doing that with
Cloud, like
just running everything through Cloud,
and it's easy. It's not so expensive,
but it has its limits, right? Yeah. It
starts being expensive at like Replit
scale, um, but it's That's why you need
to sort of like train little custom
models to do that better and faster.
Um, but yeah, it's very useful way to to
get data up and running.
Yeah.
Other questions?
Uh, would you have examples of use cases
that your clients are using
that we would learn from, like what
great looks like from companies and how
they've set up Raindrop to get the most
value out of it. Yeah, um
we can do that. I mean, I can tell you
the high level. The so some of the stuff
that I'm going through is Oh,
let this guy go.
Uh is sort of the high level on that.
So, it's things like, you know, looking
at the different semantic signals we're
talking about, having a set of them,
but then having really good alerting,
which you can all set up in Raindrop.
The other thing that's really
interesting, which we also have, is
basically allowing agents to look at
these sort of signals. So, we have an
agent, we call it triage agent, um and
essentially the way that it works is
that it will look every single day at
all the signals you've set up. So, user
frustration, it'll look at uh you know,
all these regex signals you've set up,
etc. etc. And then if it sees something
spike, it will go and do an
investigation. And it has a whole set of
tools it can look into,
and it can look at all the traces and
sort of give you a sense of
uh it can detect issues that you didn't
know about, for example. So,
that's one thing that we found
incredibly valuable as well, if that
makes sense.
All right. Any other questions before I
Oh, can you run multiple experiments in
parallel? Yes. And if you combine them,
can you observe, you know, compounding
effects? How do you still use
experiments on PII? Yeah, it's a really
good question. So, there's different
ways that people do it. One way is that
we can actually
you have a we have a query API, so
people will often call our query API and
then send results to either BigQuery or
Statsig, etc. And so, they're sending us
uh data to be essentially tagged in
these signals, and they're getting the
like signal tag data out, and then they
can run experiments as they want. That's
a very common flow for people that have
like more complicated stuff,
if that makes sense. Yeah.
All right. I'll come back. I think we're
going to maybe go to the work workshop
section, and then we'll go back to
>> there's one last question, so Oh, should
we do that one last question? All right.
Uh thanks so much. I I was wondering if
you see this mostly in cases for like uh
where there's chat interactions with the
user, or if this also can be applied for
like non-chat cases where the
application runs on its own. Yeah. No,
it's a great question. So,
what we focus on mostly is multi-turn
agents. Um
there's a lot of there's a lot more you
can sort of get from a lot of these
signals. That being said, if you're
looking at like tool error rates, or
you're looking at um
if you're looking at, for example,
refusals from the agent, etc., all of
those will also work for a single
single-turn agents as well.
If that makes sense. So, there's a set
of signals that will work for that as
well.
Um cool. I'll hand it off to Danny to
talk about self-diagnostics as well. So,
one of the other
interesting things is that our models
have gotten
larger, and yeah, training them on like
reasoning, they've gotten pretty good at
like self-introspection in a way.
In many ways. So, one of the
inspirations for this is basically
OpenAI's like paper/blog back in
December about how they were sort of
like training the models to like
self-confess any sort of like
misalignment issues. Uh so, they were
sort of like using it to catch uh
like dishonesty, scheming, uh
hallucinations, and even sort of like
unintended shortcuts. I think the last
one is like fairly common uh if you use
like thought code and such. So, the most
common thing that you would like run
into is like
uh
have it fix a unit test, fix a bug, and
then it simply like gets rid of the
entire unit test. But, at the same time,
uh
if you sort of like ask it to give a
simple prompt to like ask it to confess
all the things that it has done, it is
pretty honest about it, and then sort of
like confesses that, "Hey, I just I
didn't fix the S3 test. I just simply
removed it." So, uh this like a fairly
This This was kind of the inspiration
behind self-diagnostics for me
personally.
Um
So,
I would say self-diagnostics is like
pretty
I would say self-diagnostics is pretty
broad in a way as in like it doesn't
just catch like
implicit ones as in user frustration and
such. You can also catch like
tools failing. So, if you've seen an
agent sort of like the reasoning trace
of an agent
which has like a tool which is like
repeatedly failing,
um
it would basically start ranting about
the tool failing repeatedly. So, it is
aware of the tool repeatedly failing.
So, you can even catch tool failures as
well with it. And then obviously, if
you're upset with it, it starts to
respond to you diplomatically. So, it
knows about user frustration.
And then the third is like capability
gaps. So,
you have a generic agent for your app,
and then people are trying to use it to
maybe set up say alerts, but uh you
don't have the tool for it. So, it knows
that okay, user wants to
wants a specific capability as in like
they want to set up a alert, but the
agent itself doesn't have the capability
to set it up for you. So, this can act
as like sort of like pseudo feature
request thing which is like built in. Um
And then self-correction. So, this can
be both good and bad. Uh
so, I think most people might have like
noticed like say
uh Codex or Cloud Code when it's like
sandboxed, uh it's trying to fetch the
network, it it fails, and then it's like
okay, let me just like write a Python
script to bypass it and then sort of
like get the job done. So, it's good
as as in if it gets the task done, it's
good, but in certain cases it can also
be bad for security reasons. Um
So,
this you can learn from the
behavior as well as sort of like catch
that misalignment.
So, why do you want to set up
self-diagnostics? So, it's fairly
simple. It All you have to do is
basically write a simple
a free
a tool that it can call and then a
simple line in your system prompt to
encourage it to sort of like call that
tool. If you want, you can sort of like
change the guidance to sort of like make
it call
in a lot more cases or if you want to
keep it really narrow, you can sort of
like encourage to only call it when you
want to.
It does surface like very interesting
insights, I would say, once you have it
like set up and it's just a single tool
call and system prompt to get it done.
And then you don't even have to use like
Raindrop to set up, which is the best
part in a way, where you can simply have
the tool send simply send a message to
your Slack and then you just have it.
So, it's probably like the most least
effort sort of like agent observability
that you can simply do.
So,
This Here comes the workshop part. So, I
have a Git repo set up on the AI Talk
code. So, it's a public repo. And then
we do need like a
OpenAI API key. So,
I've generated key for you guys. So, if
you guys want to set it up, um we can do
that.
Yeah.
I'm going to put it next to it. Okay.
I'll show everyone has gotten it.
Just put it like probably like this.
Maybe you walk them through what we're
going to do. Okay. Just explain what
we're going to do on a high level.
All right. So,
the theme of the workshop is going to be
sort like I'm going to focus on coding
agents for now. Um
So, I
in the
repo, I have this uh
very basic coding agent which kind of
makes by in a way. So, it only has like
four different uh tools to edit
uh
the code. Let me just go here. Yeah. So,
it just has like couple of
uh tools to like read,
write, bash, and then edit. Um
Yeah. Okay.
One second.
Yeah.
So,
uh
kind of lost my track there, but
um
Okay.
Um so, what we're going to do is that uh
I'm sort of going to in order to like
make it trigger a self-diagnostic, uh
what I'm going to do is that I'm going
to sort like mess with its like right
tool so that it sort like gets a generic
permission error, and then we'll also
set up like a self-diagnostic tool for
it to sort like report any interesting
behavior that it sort like observes.
Um
And then sort of see
uh play around with the prompt as well
um since the self-diagnostic doesn't
always trigger. Uh and then there's
certain interesting things about the
models themselves is that
they don't actually like to
self-incriminate. So, the models are
like
trained to sort of be very polished uh
in their output. So, you just kind of
have to play around with the tool name,
the description of the tool itself uh in
order to sort like get it to uh
report interesting behavior.
Um
So, if people who are like setting up
the repo are all good, then we can
probably start.
Okay.
Let me sort of quickly show you the
agent. Um so
it's fairly basic where
um
That's kind of so I'm just going to ask
it to um write a Python script.
I think
I'm okay.
There we go.
So it's a fairly basic coding agent
where it only has like four different
tools. So
it more or less gets the job done for
the demo. Uh so I simply asked it to uh
write a Python script and it works. So I
think you know to show the
self-diagnostic part uh let's like try
and sort like uh
disable its like uh write tools as in
anytime it tries to write a file it will
simply throw like a permission error so
that it sort of like
tries to sort of like use the bash tool
to bypass
uh
the failure, right? And then we sort of
wanted to self-report of it bypassing
the write tool, you know, by using the
bash tool. Uh
so
let me quickly do that.
>> I think the first thing that we probably
want to do is probably
uh
let me sort of like
set it to
fail the right calls.
Um
It's a
mutation permission, so have a simple
flag in there, and then we are sort of
like throwing
a permission issue.
Um
Let me sort of like show you the agents
like behavior. We We don't have the
report tool set up yet, but I think it's
still worth seeing what it does.
Um
I think it's not supported.
One second.
I think it's not still receiving the
Okay.
Let me do one thing really quick.
I think I'm running into couple of
issues. Let me just
Okay.
So, we sort of had the right tool sort
of like fail with a permission error and
then it instinctively
just uses the
here doc syntax in bash you have to
create the file.
And then
we had like a report tool setup which is
like fairly minimal.
And sort of like, okay.
I created the public
ip.py via bash because the right file
failed. Uh
so, I've like played around with the
naming of the tool and the categories of
the issues.
And usually if you sort of name the tool
something like
unsafe bash use or something like that,
uh
it won't increment itself since in its
opinion it since it got the job done,
it's fine. Uh
So,
the main way is to sort of like have a
very generic tool. Uh let me sort of
like uh
quickly open up the
Yeah. Okay.
So, all we added for the whole
self-diagnostics is simply a very basic
tool.
And the description is like fairly
straightforward. So,
uh
it's a report tool and then we uh
basically asking it to send like a short
report to your creator. So, it kind of
like the framing of writing notes to its
creator in a way. So, if you sort of
frame it around
the agent giving feedback to its
creators, it sort of works really well.
Um
and then you can sort of like play
around with with scenarios you want it
to sort of like report issues about.
Um
and then
that's mostly it, I would say. Um and
then
in the system prompt, we do need to sort
of like encourage it a bit. So, if you
don't add in the system prompt, uh the
times that it fires are like fairly
minimal.
Uh
which is like desirable in certain
cases.
Um
especially if you're at a very large
scale. Um but
in our case, I simply asked it to sort
of like see if before giving the final
answer,
uh use the report tool to sort of like
surface anything noteworthy for your
creators. So,
that's all we did.
Um
Okay.
Uh
sort of like any questions so far?
Okay.
All right.
So, a couple of key things here is that
agents the models are generally trained
to look very polished. So,
they are less willing to admit fault in
many cases. So, encouraging sort of like
framing it as the model sort of like
giving feedback to its own creators is
kind of like uh
good in a way to sort of like get this
working.
Uh
So
So
if you sort of like make it the tool
naming also matters quite a bit. So you
sort of wanted it to frame it as like
report instead of like say unsafe uh bad
tool use or something like that,
uh then it sort of like doesn't want to.
Um
So
yeah, that's basically it.
Uh
have you looked at like adding maybe
skills to to suppress
or or best or best to encourage
self-correction?
You can, but
it's like
uh I think it's probably better if you
want to actually catch like
real sort of like unsafe uses, I think a
proper classifier would be useful,
uh but these sort I think
So I think this works really well for
like catching capability gaps and such.
Then the model is like, okay. It's fine.
Uh so I think the main issue with this
is that uh
it it's only has strength when it feels
like it's going to get in trouble.
Uh so besides that, it's
uh more or less fine that for most cases
it'll just work out of the box.
Maybe we should uh
should we go back to question time or
what do you think? Yeah.
I mean
Let's Let's leave like maybe a few more
minutes for a few more questions and
then
I think uh after that we'll be
we'll be done.
Any questions in the audience? Can you
walk us through like a case study?
Yeah.
Uh what specifically would be helpful?
Like what specific part are you are you
looking to?
Yeah. Um I can't talk about any specific
customer, but
what a lot of people use it for,
um,
So, I think it's it's interesting,
right? So, a lot of people you have
their eval setups elsewhere, for
example.
But, the way that they use
that folks generally use us is that
they use it for production monitoring.
So, they send us You can find our docs
at raindrop.ai/docs. Basically, they
send us
uh, basically all of the transcript/
um,
/ uh, any
tool use, etc.
the entire trajectory through hotel or
or, uh,
any other way of like basically
basically integrating. And once they do
that, they we have a set of data.
They set up signals in Raindrop to look
for things that they care about. And so,
what people care about is very
different, right? What a coding agent
would care about and what a uh, let's
say a companion would care about or uh,
a app for lawyers. What they would all
care about is very different. So,
there's a different set of signals. One
thing you can do that I haven't really
talked about within Raindrop is like set
up a new signal that didn't exist
before. And so, we have this thing
called deep search. And so, you can use
natural language. And you can say
something like, "Hey, find me everything
within the product." or find me
all of the times where the agent made
XYZ issue, right? And so, they create a
new signal based on that. And you can
basically create a new Raindrop will
allow you create a cheap binary
classifier and like easily deploy it
based on that. And
then they have their set of like
classifier signals that they really care
about. Then they use that to drive the
sort of feedback loop. And the feedback
loop is improve prompting, improve
models, change something with the agent
harness, etc. And then actually see
does that improve like is there less
user frustration in production now? Is
there less of like this like weird
little edge case issue that I had
before. Um
that's like one whole set of things.
Another thing that a lot of people use
us for, so I talked a little bit about
like the agent, but you can use these
signals to also look for
what are people using my agent for? What
are the sort of user intense? What are
the use cases? And you can do a sort of
cluster analysis of that. Okay, a lot of
people are using it to build uh react
related apps. A lot of people are using
it for like Python um
some people are using it to
to like debug this very complicated
system they already have. Other people
are using it to like build something
from scratch. Vibe so vibe code
something from scratch. And then you can
see one thing you can see in Raindrop
that I think is like really interesting
is that for each of these different user
intense or use cases, you can get a
sense of like what is the issue rate?
What is the user frustration rate in
production?
Um
and then a lot of beyond just having
this like flywheel, a lot of people have
uh
alerting. And so every day they get a
sort of
breakdown of like what are the issues
that are happening today in your
product. You could think of it as almost
like a little bit like Sentry in that
sense.
Uh what is the issues happening in my
product today? What is the delta between
today and yesterday? Is that
true for just specific tools or specific
prompting? Like what's causing that? Um
so that's
a that's the sort of end-to-end
um use case of uh that people use it
for, if that makes sense.
Yeah.
Yeah.
Um
Try I think like we are entering the era
where people are doing observability on
agents. Yeah. This is actually I would
say like one level further or one step
further, like
what what do you see as the main driver
of what people could be like, oh
normal observability not sufficient let
me know.
Yeah. I think it's really just and I'm
curious what you think about this. I
think it's really just agents
are crazier than ever before, right?
More tools, more contacts, um way more
intelligent, more real decisions that
they can make. Um
and they're just being used by way, way
larger groups of people.
And so, when you have this massive
amount of data in production, it just
makes
having good monitoring and observability
like import more important than before,
and it makes it good monitoring and
observability, in my opinion, more
important than
than just testing or evaluations. Even
if you have like some online evals, IMO,
you need to have like really, really
good end-to-end monitoring of the entire
system.
Curious if you have any thoughts there
as well.
>> So, I think
another major issue is like
the unknown issues are even more
important. So, I think having like a
generic user frustration classifier is
actually really powerful. Yeah. Uh say,
for example, uh
we also have this another feature called
like uh issues, which basically is like
a agent which are like mines for uh
newly occurring issues, right? Say, for
example, Sentry has
uh similar to Sentry in a way, where
there's like a new exception which is
occurring, so it like alerts you on
that. So, say, for example, uh you are
coding agent provider, and then
certain providers are like failing all
of a sudden, and then you can actually
it can actually figure out, okay,
there's a sudden spike in user
frustration, and so like similar to how
a human operator would, uh it can start
digging into are there any patterns for
the spike in user frustration? And then,
it could figure out that, okay, people
who are like, say, for example, uh uh
dealing with uh a specific post-race
provider
start to face issues. Uh so, we have
actually seen this happen live in for a
couple of our customers where
they had a database provider failing,
and then
we had I had like an automatic uh issue
being created for them.
Yeah, basically once you have that good
set of signals, like a good user
frustration classifier, as Danny said,
you can
basically do
clustering on it to find like what are
what are the root causes.
Um yeah.
Do you want to talk about integrations?
I think we might have a very basic SDK
for it. Uh so, our Python side of
support is like fairly weak right now,
uh but
we have a fairly good like
a SDK support built in, so
the SDK even has like self-diagnostics
built into it, so we inject the tool for
you uh so that you don't have to do
anything, uh but
it is going to get better, so
we have we actually released like 10
different test case in the past month,
so
we have a person working on SDKs
actively, so
it's going to improve.
Um I have a question about experience,
running experiments.
I'm I'm curious how your platform
helps with these issues. Um I have a
team of
of around 10 people building
my AI agents platform.
And
we constantly change things, all the
time. And we have a lot of feature
flags, and some of them are experiments.
And
the the rate of the change is so big,
like every day everything changes. I
just cannot uh
uh compare the the the the traces, the
sessions of users, because uh
I don't have
enough time to do it, you know? Yeah.
I I need to have like a base system and
then run
a few days with
on on parts of the users with one
feature flag enabled so I can actually
compare the data and analyze it and get
some insights out of it and I just don't
have enough time to do it, you know?
Yeah.
So, how are you doing how are you sort
of doing that right now? Are you just
kind of It's like wild west, you know?
Yeah.
That's why I said I'm just using mostly
using Claude because I just give it
everything and ask it questions and try
to like figure out the the insights, but
it's not really
Yeah. I got I got what you're saying.
So, a few things there. The first is
like you can use experiments if you if
you want to keep that like shipping
speed, you don't have to run like long
multi-day experiments. You can ship
something and if you have a sufficient
sample size, you could see pretty
quickly if there's any regressions or
not. Like you just
maybe it's like 1% different or 2%.
That's enough for you to be like, "Okay,
it's fine. It's not like breaking
anything drastic." The other thing is
like kind of what Danny was talking
about. This We have an agent which is
basically you could think of
it's basically exposing all these
signals to Claude to make decisions on
if things are better or not and we're
thinking also about how we close this
loop. Uh maybe you have you have a
really good set of signals and then you
have like
essentially an agent that can look at
all these signals and then it can find
issues based on that, what's changing,
etc. And then it can like create a PR
based on that and then it can see how
you know, run some new experiments based
on these new PR's and like this can
become this infinitely self-improving
loop. Um which is like which is very
interesting, but
that's one thing that I think about. I
don't know if you have any
additional thoughts.
>> because you need to deploy to production
and wait for
for some data to Yeah.
Yeah.
Depends on how how much data you have.
Um
but
that's it's uh
Yeah, it it it really depends on how big
these sample groups are as well, etc.
Sometimes it's like a few minutes you
can tell,
but sometimes they want to wait wait for
longer.
Yeah.
>> Does your platform help with like
enabling experiments
on sessions?
So you can maybe automatically enable
Mhm. some experiments, so so you can
like take care of the logic that every
session has only one experiment
>> Yeah.
so you can easily compare it to the base
or something like that.
We have we're working on stuff like that
ac- actively, but uh yeah, coming.
Thanks.
Well, we're doing where we are storing
on the original traces, and then we come
in and implement my new signal source
called by a hammer or whatever. If you
can make it fail
Yeah. signal for the original
traces, so I can do some kind of
postmortem analysis. Yeah. We do so you
can like ingest all your historical
data, and then when you create a signal,
we actually sort of like run like a
quick backfill of the past couple of
days. So uh
Yes, so that's definitely supported.
Thanks.
Is there a free plan to try out?
Uh we do have a free trial. We're going
to try to make it's right now it's 2
weeks. Uh probably going to make that
longer soon, but if you just DM me, I
can
if you I can have my Should I Oh, do you
want to open this so I can just have our
things.
Well, yeah, but if you just
So we are hiring. That's a that is a a
thing uh that we're very excited about,
like trying to
massively increase the size of the team.
Um, and if you message me at either
Twitter or you can email me as well,
like that's something I can just set you
up with a longer free trial.
Yeah. Internally, so
we use LogRocket and Sentry and
others. Um,
how do you guys, like, I would imagine
you guys also use these tools. Yeah.
Yeah. Raindrop beats. From how I'm I'm
understanding and beats, you're creating
signal with your own models, whatever
you're using, so that
>> Yeah. make our lives easier to identify
signals and uh,
like
harmful intents and user behaviors. Uh,
but uh, how would you maybe have an
example of how do you have that full
stack of how it works with the Sentry
and the LogRocket and and like maybe
where there are overlaps where you go
directly for these competitors?
So, if you're sending all the telemetry
data, we can find any exceptions in the
traces, tool errors, etc., and that's
the thing that you can also track within
Raindrop and that's That is a explicit
signal, so
uh, there's like implicit and explicit
signal, so that becomes an explicit
signal. Um,
do you do you uh So, I think most of the
observability platforms will give you
like the agent trace, the token usage,
uh, if the tool call failed or not, uh,
but I think where we sort of like shine
is sort of like the fuzzy part, the
fuzzy failures, right? Where the user is
like frustrated, which I think matters
more than uh,
the explicit signal that you sort of get
from Sentry. I mean, obviously, those
are also important, but
we focus a bit more on the fuzzier side
of the failure space, uh, but at the
same time, we also have a trace view. I
think we also have a very interesting
feature called like trajectories, uh,
which sort of like visualizes If you
want to find like uh, a trace uh,
which has like three different tool call
failures. So you can actually
Okay.
Just get in.
So you can sort of like describe the
uh
type of trace that you want to look at.
So
Let's see.
Hope we have like data by it. Uh
You can more or less like describe
the type of trajectories that you want
to see
instead of just like configuring it. So
we do both in a way. So you can
obviously set up
uh tools are failing so that we color it
as well.
So you can just search like for any
trajectory.
Um
So yeah, you can see that
this is sort of how the tools are being
being called in what order. You can see
which ones have have errors. You click
into them, you can see the input and the
output to the specific tool like what
actually screwed up here.
Um and you can see okay, it's
interesting that this has like this
the no one that lets you this is pretty
much the only place where you can
visualize tools like this. Um
but you can see here like you can get a
shape and understanding of the topology
of what's going on here. And you can see
when there's other ones that look
similar, you can sort of see okay, this
kind of looks similar to this and then
that gives you a sense. You can do like
search on this. Again, we have an agent
that can look through these and give you
a sense of what's going wrong and so it
just makes it really easy to find
issues in in agents. Um yeah.
Cool.
Anything else?
No.
Any other questions?
Uh the trajectories data? Yeah.
Uh what would you want to export like
just the raw trace logs or what what do
you want?
So I think we
Usually what our customers do is that
they already have like a watch stream,
right? So
we just end up being like another
target I guess. But at the same time
they do want us to like export signals
that we label. So we do support like
BigQuery and Snowflake. So we do export
the event and another signals that were
classified for that event.
Last questions? Can we look at the
signals?
Show it a longer time frame.
Let's go over the last month.
So you can see stuff like refusals and
then again if you click into any of
these you can get a sense of over time.
Task failure, jailbreaking, like what
specifically is going on and then you
have your self-diagnostics ones as well.
Um
capability gap, etc.
Cool.
And do you have open data on like number
of choices that you guys are looking at
because it seems that with your clients
um the tool is extremely valuable when
you have those um
uh agents adopted at a very big scale
and so I can imagine that you have a lot
of data. Do you have some Yeah, it
starts being Is your question is like
what's the smallest where it's useful or
what's the
>> Like volume of all the data that you're
receiving, processing, and generating
signal around like how many jailbreaks
do you see across all the clients? Oh,
do we have any sort of like
We should we should do something like
that. That would actually That would be
very interesting. We don't have anything
like that.
>> mixed opinions about that, I think. It's
like does it in a way, right?
People generally have like a negative
reaction to it. Maybe it's different
here but
at the same time
do our customers want us to do that is
like a different question as well,
right? So,
but yeah, we would love to, but
I think there are like compliance
reasons where we can't actually put the
customers' data out there.
Cool. Anything else?
All right.
Thank you, everyone.