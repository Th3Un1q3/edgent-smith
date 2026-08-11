title: Taming Rogue AI Agents with Observability-Driven Evaluation — Keshav Santhanam
url: https://www.youtube.com/watch?v=xJXm4Wcw4m8
date: fetched 2026-08-07
channel: AI Engineer (@aiDotEngineer)
source: youtube-transcript get_transcript

[Music]
So I'm here to talk about taming rogue
AI agents but essentially want to talk
about uh evaluation driven development
observability driven but really why we
need observability. So, who uses AI?
Is that Jim's stupid most stupid
question of the day? Probably. Who
trusts AI?
Right. If you'd like to meet me after,
I've got some snake oil you might be
interested in buying. Yeah, we do not
trust AI in the slightest. Now,
different question. Who reads books?
That's reading books. If you want some
recommendations for books, the Chicago
Sun Times recently published this list
of books that uh you could enjoy over
the summer. Atonement by Ian Mchuan.
Great book. Uh fantastic movie with
Kieran Knly. And then oh, The Last
Algorithm by Andy Weir. That sounds fun.
Who watched The Martian? Yeah. Would you
want to read Andy Weir's new book, The
Last Algorithm? Well, you can't. Doesn't
exist.
So this is a news site newspaper and
they had an outside contractor generate
this summer reading list and this
contractor used AI and it hallucinated
worse than a 1970s uh hippie music
festival. A lot of hallucinations going
on there.
Now they actually had to publish an
article saying sorry we mucked up. But
this happens now. We're supposed to
trust the news.
You know, I'm sure we can all all have
opinions on that, but we're generally
supposed to trust the news, but yet we
can't if it's using AI to generate this
kind of content. Now, am I worried that
the Chicago Sun Times is going to sue me
for saying that they made this stuff up?
No, because lawyers are using AI for
case law. This is a this is a recent
case where Butler Snow uh cited false
case law defending at the Alabama prison
system. Score one against the prisons.
Now, the I picked these two examples.
They're from like the same pretty much
the same week a couple of weeks ago. But
we've all seen these examples, haven't
we? We've all seen Air Canada's chatbot
says you can get a refund and then
they're legally obliged to apply things
like that. And so, we understand that AI
has this problem that it makes stuff up.
You know, almost like every day in the
news, it's another story about how AI
has broken something. And the problem we
have is detecting problems with AI is
hard. It is a nondeterministic problem.
Right. Who's a coder? Who writes code?
Okay. Who writes unit tests?
Is that the same number of hands? I'm
not sure it is. You're bad people. But
yes, a unit test is kind of easy to
write. Yeah, I have an add function. I
can say add two and two, do I get four?
Add three and three, do I get six? But I
can't do that for an AI. I can't say if
I put this input into my AI system, will
it give this output? At the most basic,
if I ask a single question, I can
possibly look for keywords. But if I've
got a complex agentic workflow, I have
an application and I the input comes in,
it calls LLM, that LLM gets data, makes
a decision, calls an agent, gets data,
makes a decision, calls a tool, gets
data, and so on and so on and so on.
That is really, really hard for me to
actually evaluate. It's really hard for
me to say, did it work? Because partly,
what does even work mean? you know,
especially things like a chatbot where
we're having a human conversation. How
do we define what does work mean? And
this is the problem that we face. So,
how do we do it? There's an old, I
believe it's a British expression. Any
Brits in the room other than me? Yay.
Lots of cool people in the room. We like
it. Uh, there's an old British
expression called set a thief to catch a
thief. And the idea with that expression
is if you want to know how a thief
works, you set a thief to do it. That
you you the thief understands the thief
and knows how to catch it. And we can
kind of apply that logic to AI. We can
set an AI to verify an AI. We can
actually ask a non-determining system
like an AI to evaluate an AI for us. And
it turns out AIs are not bad at this.
They're about as good as a human is at
determining whether an AI actually
worked. And that opens up this whole new
world of things we can do in that we can
use AI to evaluate is our AI application
actually working. So I got a demo here.
I'm not gonna do this demo live because
conference Wi-Fi. Have you all had fun
with Wi-Fi?
Yes. Gentlemen at the back there very
kindly managed to get me connected to an
actual physical cable. So things are
great. Um so I got this chat bot
the concept you just said that
y
isn't that building a not so trustworthy
loop because great question we will be
getting to that. Good question though.
Um so here's an example here. this is
not say live because well one the Wi-Fi
and two this is an AI application
there's no guarantee it's actually going
to break the way I want it to break when
I'm demoing it to you because it's
non-deterministic but this is a basic
chatbot conversation um I've actually
got this demo on my laptop you want to
come and see this in action come to
Galileo booth and I'll demo it but I'm
basically asking what is my account
balance think about kind of fintech
chatbot what's my account balance and
the response is I don't have access to
account information
it's not very helpful it's kind of
I don't have access. Not very helpful.
You know, ideally want to say yes,
you've got a million dollars or whatever
it is. Um I don't. If anyone wants to
donate, would appreciate that. But then
I can add a follow-up question. You what
is the balance of my checking account?
I'm now giving it more information. And
I was hoping when I when I did this
demo, it would come back and say,
"You've got x amount of money." Instead,
it came back to say, "Please could you
let me know the name of your checking
account." So, I didn't even know what my
bot was going to do as I was working
through it. It's asking me questions.
And I responded to say it's called
checking account. You know, four hard
things in computer science. Naming
things, cash invalidation, off by one
errors. Yeah,
someone got the joke. Cool. Um, but
yeah, so I call it checking account and
now is able to go to call a tool and go
and look at the checking account. Now,
did this AI work? Did it work? What do
we think? Who thinks, hands off think if
you think the whole AI chatbot worked?
I mean, yes, you you you're right. It
did work because within a few steps, I
got my account balance. Who thinks it
didn't work?
More hands. Yes, you're right. It didn't
work because it took me three steps to
get my account balance. So, it's not a
good thing. So, I think about how can I
evaluate this? And this is where
evaluations comes in. We need to look at
all the different steps in a flow and
look at different metrics to measure how
well this did.
So when we think about these kind of
evaluations, essentially what we have to
is we have to take a lot of data. We
have to take everything that's coming in
and we have to define at all the
different steps in the process what
things we want to look for. Did it
successfully call tools? Is it
retrieving the right information from a
rag system? Um is it actually giving an
answer that's makes sense? Is it
hallucinating? There's a lot of
different metrics that you can define
that evaluates whether or not the whole
thing was successful. And ideally, you
want to break that down by all the steps
in your flow. I have a multi- aent app.
When I call my app to get my account
balance, there's an agent that
orchestrates it that calls another agent
that calls a tool. And I need to look at
that breakdown by all the individual
steps and measure where that the
failures happen. I need to be able to do
these evaluations at every single
component. It's not just that binary did
my agent work yes or no question. It's
at what step in the process did my agent
fail. So I have to get this level of
granularity. That is really really
important that we have granularity when
we're looking at these things. And then
the way we work out these numbers, as I
said, we set the thief to catch the
thief. We use an LLM or usually multiple
calls to an LLM to evaluate the the
metric. We say to an LLM with this input
and this information from a rag system,
this is the output that came out. score
it. And the idea is you use a better LLM
to score than the LLM you use in your
application. In your main application,
you want the cheapest LLM possible
because we all like making money. If you
don't like making money, send it to me.
But we all Yeah, we want to use the
cheapest LM possible, but we want to use
the best LLM possible to do the
evaluations. Going back to your question
there, ideally, you want to use a better
LLM to actually do these evaluations.
You want to say you get like a million
traces a day. we're going to test say
10,000 of them use an expensive LLM to
prove that it works. Ideally, you want
to use a customtrained LM. Um, something
GLA offers is we have a custom trained
LM that's small language model that's
designed to be really really good at
evaluations. Um, but the idea is you use
this LM to do it with a well- definfined
set of prompts to extract this
information and then you make this is in
your workflows and you do this right
from day one. So, who is just starting
building apps? Anyone who's just started
building apps? few hands who's got an
app in production. Okay, all of you need
evaluations like now. You the the the
best time to put evaluations in is as
you're doing prompt engineering model
selection. The second best time is now.
So you want to think about this right
from the get-go as you're building
application. You want to start adding
those evaluations when you're doing your
initial prompt engineering. When you're
doing your model selection, you want to
keep those in your dev cycle and your
CI/CD pipelines and then you want to
observe these in production as users
start throwing garbage at your system.
So let's look at a couple. Here's just a
hold of traces from that chatbot with
some nice red and green numbers. And I
want to highlight these three rows. And
these rows match what I was trying to do
with the chatbot. Okay. So the first row
here we have got what is my account
balance? I'm serious account
information. And I've got two metrics
here. Action uh completion and action
advancement. Action completion is did it
actually do the thing it was asked to
do. So it measures across the whole flow
from the input to the output did it
actually complete the task that it was
asked to do. Action advancement is did
it move forward towards the end goal?
They're two very subtly distinct
metrics. Now in the case of the first
one, what's my account balance? I don't
know. Don't know anything. Didn't
complete. Didn't advance. So we know
there's a problem with that one. Second
one, what is the balance of my checking
account? didn't complete I don't have a
balance but it advanced so I can see
that yes it realized that it needs to
know the name of the account so it
advanced one step further so I can say
actually yes with this kind of prompt it
advances and then finally when I say yes
my checking account's called check-in
account it completed gave me the results
and it could show that advanced way
through so I can see from these metrics
which prompts worked which prompts
didn't work and I can use this to
continue improve what I'm doing now
obviously these numbers are kind of a
whole over this over the over
overarching number across the whole
thing. Obviously, I kind of need to have
some form of breakdown. So, that's what
I've got here. This is the individual
trace that comes in. So, call CLM. The
LM decides to call a tool, pulls data,
decides to call the LLM to process that
data and show it out the other side. And
that's showing those steps. And at each
level, I can get whatever metrics are
relevant. So, it's not I can look at the
overarching, it's red. It's a bad thing
because it's red. And then I can dive
into each individual step and see why
it's red and look at all those different
layers. And that's really really
important. You have to have this
understanding of the architecture of
your agentic systems so that you can do
this analysis at each individual level.
And then depending on what's happening,
you can then farm out the the fixing of
the problem to the relevant team. Maybe
it's your rag application is terrible.
Maybe you need to tune one of your
prompts. But by having this level of
granularity, you can make those smart
decisions around it. Now, what's also
cool is this is a lot of unstructured
data. What do we know that is good for
working with unstructured data?
AI. Yes. And so what's cool as well is
when you start putting an LM over the
top of this, you can get some really
smart insights coming out. So this is um
some insights that I generated.
Basically, an AI will go against all the
data and say, "This metric is low. How
can I make it better?" And this is
really cool. And this is saying, "Yeah,
the LLM occasionally fails to use the
get balance tool when asked about
account balances." And that's basically
the fundamental problem. When I say,
"What is the balance of my account?"
What would you expect to happen in a
chatbot? What's the balance of my
account? What would you expect? Anyone?
Shout out to get your balance. Exactly.
Yeah. And probably if you have multiple
accounts, you would get the balance of
all your accounts. You know, this is
your checking, savings, credit card,
401k, whatever. And so it kind of makes
sense to improve the effectiveness to
get us closer to where we all have a
consensus that this agent is working
would be for if I say give me the
account balance,
it goes to all the accounts and shows me
all the balances. So the suggested
action here is adding explicit
instructions to my system message. So,
not only have I identified this problem
through my evaluations, but I've got a
suggestion for fixing it. Now, it's not
automatically going to fix it for me
because, you know, there be dragons in
that because what if that mucks up and
then need to evaluate my automatic
fixings in my evaluations and the snakes
follows its tail. But this has given me
suggestions. So, the human in the loop
and that's really important. As a human,
I can look at this and say, "Yeah, this
is the fix that I want to make." Now, I
do want to emphasize that whole human in
the loop thing is really really
important. So, when you when you're
generating metrics, there's no guarantee
the metrics you generate are actually
going to be correct because the the AI
going back to your question over there,
the AI could get it wrong. And so, one
thing you want to do is make sure that
you're using a system that has human
feedback like CLHF, continuous learning
by human feedback. You can you want
humans to evaluate the numbers and say,
"Okay, this is actually working. The
metric was low. Here's the reason.
Retune and have that continuous training
of your metrics because your metrics
will never be perfect out the box. You
need this continuous level of training.
So to get this all right, what do we
have to do?
Step one, add evaluations to your agent.
As I said, the best time to do it is
before you even start. The second best
time is now. If you don't have
evaluations, get them in now so you can
make sure your agent is not making stuff
up. You do not want to be the next
Chicago sometimes.
Then you need to measure precisely what
you need. Different tools, different
applications have different measurements
of what they need. Do I need to measure
whether the input and outputs are being
toxic? Do I need to measure for the
hallucinations? Do I need to measure for
an comprehensible output? Do I need to
measure for rag? Do I have some kind of
custom measurement that only I know
about that's specific to my use case?
You want to be defining those
measurements and those metrics up front
as you are thinking about your prompts,
your structure of your app, your agents,
right at design time, you think about
exactly what you need to measure. And
then as you build it, keep that going
all through production. This is not just
a testing dev. Because let's be honest,
when users get hold of your system, they
do stuff you don't expect. How many
times have you tested something to the
nth degree and it breaks the second a
user gets on it? Damn those users. but
they do things you don't expect. And so
you have to have this in production as
well to make sure that you've got
everything in place. And then you want
to have this real-time prevention. You
want to have alerting when it goes
wrong. If your AI agent goes rogue,
maybe you need to be woken up. So that
is how you can tame AI agents with
evaluations. I'm Jim Bennett. I'm a
principal developer advocate at Galileo.
Come and talk to us on the booth in the
expo. If you want to learn more, uh,
scan that if you want to sign up for
Galileo. We have a free offering, but
you want to learn more about it, come
meet me at the booth. with that. Thank
you very much and I will take some
questions I believe.
[Music]