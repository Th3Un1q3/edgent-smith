# AI Engineer World’s Fair 2025 - Reasoning + RL

- Watch: https://www.youtube.com/watch?v=-9E9_21tx04
- Upload date: 2025-06-06T17:49:20.549000Z
- Channel: AI Engineer (@aiDotEngineer)
- Source: Fetched via youtube-transcript get_transcript (full text, paginated) on 2026-08-06

A few of them that are mo very important
all of them have like different
implementation details but in general
the idea is you have a bunch of tasks
like versions of your problem which are
essentially prompts. You have rollouts
which are just completions potentially
involving many steps of interactions but
like one sequence of stuff happening and
then you have evaluations potentially
interle throughout or at the end of the
sequence and what you're estimating is
the advantage. The advantage here is the
idea that uh sometimes your model will
be be better than others. Like these uh
LLMs are all uh non-deterministic. You
have temperature above zero. You have
different things happen in different uh
rolls of the dice. Um and this uh
forking process of saying like okay this
time it did better than that time. Why
was it different? RL is really about
saying like okay uh this is the actual
thing that changed that resulted in the
reward being better the eval being
better this is the token at which I went
down the good path versus the bad path
um and whether you're doing PO or GRPO
um like this is the mechanism by which
you get the signal of like you have some
things that sometimes went better
sometimes went worse now you can kind of
uh very surgically have the
learn to do more of the good stuff
without changing too much overall. I
think this is also kind of maybe a
reason why DPO I think people were
hoping DPO would like really work well.
In my view, DPO does not necessarily
have this like fine grain advantage
estimate. Like it's not really clear
just from like a full good completion
and a full bad completion where you're
really getting the signal about these
complex branching processes. Uh PO has
this, but it's also very expensive. GRPO
I think has taken a lot of people kind
of uh by storm in terms of like being a
very nice like middle ground where it's
more computationally efficient. It's
like simple to implement. Um but also it
does have this kind of forking process
that comes just from sampling. Um
there's also just too many papers. So
like I think a lot of people just see a
new paper every day and are like do I
have to read this one? Um and I feel
that too. Like I think it's difficult to
know up front like which of these are
going to be important. Which of them are
just going to be like noise especially
because lots of them have very
sensationalist titles like oh Quen
doesn't work um or like or everyone
everything only works with Quen is like
kind of true but like there's also more
to the story than that. And I think
there's like different implementation
details of like oh if you change the
loss function like this in this
experiment then it works. And I think
for most people it is best to just like
kind of set this aside and to not get
too caught up in the individual details
of individual experiments and individual
papers and kind of think more
holistically about what is the process
of reinforcement learning doing? Um what
implementation details am I willing to
kind of leave to other people to figure
out and eventually come to me with like
software that like has the the knob set
correctly. Um and which pieces are
actually important for solving the
problems I care about. Um, and so for a
lot of people, I think the things that
are going to be really interesting, um,
are things that are relating to actual
software, to actual problems that they
want to solve in the world. And agents,
I think, are kind of the instantiation
of that where this makes sense. And the
thing that makes an agent an agent is
tools. Uh, the ability to interact with
an environment, with a system. A lot of
people here are like very excited about
MCP at the conference. Like MCP is just
tools. MCP is about giving your LLM the
ability to like interact with stuff to
go solve problems that involve changing
files, making requests, uh, editing
code, running code. Um, and so I think
these are the papers that I get excited
about because there feel like like
there's parts of the puzzle that are not
fully solved yet of like what's the
right way to do all of this. Like
there's still some open questions. Um,
but I think those are getting kind of
refined. We're starting to see more and
more, but like a lot of the code, the
tools we have out in the wild to like go
do this. Like if you want to like go
play around with RL, most code bases are
like very set up for like either code
and math tasks or things that are quite
similar to that. This is kind of my
fault. Um I had a a snippet go viral
that was like here's how you do RL on
like GSMAK, which is like a kind of easy
math data set. Um, and then I think I've
seen a lot of people like stick with
this as like, oh, we're gonna RL on
math. And I like this is also just like
math is easy to evaluate. Um, and I
think people are evaluating evals are
hard. Like there's a whole track going
on in parallel to this about like how to
build a good eval. Um, and so I think a
lot of researchers gravitate towards
things that like look like the
benchmarks that are also really easy to
eval because there's like a very clear
signal of like, okay, this thing is like
right, this thing is wrong. Good. Okay,
we're doing RL. Um but like real world
tasks are messier than that. Um we are
not going to like get great software
systems just by like hill climbing on
whatever question answer benchmark is
popular today. Um what we're going to do
is we're going to have to do is start
thinking about like the actual systems
at hand and the challenges that emerge
when we're trying to design these
rewards. And so like reward hacking is
like a real thing. Um I think this is
one of the lessons that like our works
but also it's not like always going to
work. There are things that can go
wrong. And to me, reward hacking is
really a message about the difficulty of
building good evals. Like uh what you
really want with an eval is for it to be
easier for your model to do the task
than to hack the eval. You want to build
a reward signal that actually captures
what you care about where uh gaming it
is like more difficult than not gaming
it. If you can if the model can learn to
do the task directly just by doing what
you want it to do uh in the spirit of
the task then like that is what will
happen. It will flow in the path of
least resistance. This is like models
just want to learn but they want to
learn to do better on reward signals and
so your reward signals have to point in
the direction of the thing you actually
care about. Um otherwise like models
will find cheats. Um, and I think
thinking about these things in
combination kind of points a little bit
towards a direction that I think is
going to be very promising. And there's
some very early signs that like this
actually can work. Um, which is
like when R1 came out, I was kind of
like speculating like what's next? What
are the things that are going to unlock
this sort of technique being used more
generally? Um, and you people talk a lot
about like generator verifier gaps. like
what are the differences between like
solving a problem versus checking if you
have a solution. And a lot of problems
like are much easier to check than
solve. But this isn't like a binary
thing. This is a spectrum of how
difficult is it to verify a thing. But
um there's some kind of signs that you
kind of can do evaluations on more
ambiguous tasks by just breaking them
down into smaller pieces and by using
LMS as sub routines in your evaluations.
like LM is a judge on steroids where
maybe you want to actually like train a
specialized LM who is really good at
doing these fine grain evaluations. I
like using the term rubric as a
conceptual general umbrella around
reward models, reward functions, LM as
judge setups like the criteria on which
you are evaluating a thing. There's a
cool paper from deepseek that I was
thought found very exciting when it came
out a couple months ago about like how
to train reward models that like
generate these rubrics on the fly. There
was a paper very recently that does this
for creative writing and kind of found
that like yes you actually can train
reward models that will come up with
nuanced fine-rain evaluation criteria
for a task on the fly given the actual
problem and this gives you something
that result in a very like fine grain
score that allows you to actually do RL
and like keep getting better.
Um and I think like this is an area that
I'm really excited about to keep
watching. Um, but also like multi-turn.
Multi-turn is probably where we're
headed. We want to do a jetic search. We
want to do tool calls, software, games,
long horizon planning, computer use,
memory, scaling on tool calls let you
solve harder problems. Um, and so how do
we actually like do this? What's the uh
way to go about building multi- aent or
multi-turn agentic systems to do and
that we can use RL with? Um, and I think
the conceptual pieces here are
environments are basically harnesses,
rewards are basically eval, tasks are
just prompts, and your policy in the RL
sense hopefully should just be as simple
as like an LLM API. The I think the
programming interface that makes sense
for a lot of people is to have an API
that you're writing code as if it's just
a normal agent in a loop, but then this
is a thing that you can use to go do RL.
And so that's what I've been building
over the past couple months. Um, I
maintain a repo called verifiers. Um
it's finally uh on pip uh out in the
world. You can just install it, but it's
been a long time coming. Um and what it
really is is a toolkit of these pieces
to make it so that building an agent
that you can actually train with RL
feels just like building an agent. Um,
so the interaction protocol here is like
quite simple like this is the entire
roll out function on the left of like
what happens in the code when you're
running an agent to do RL which is that
you kind of set up some initial state
stuff have a while loop for is it done
yet? If it's not done, do a turn. And
the thing you're passing here is a
client object that's just an OpenAI
compatible API. And I think this is the
kind of interface that you really want
if you want people to be able to go from
their agent applications to something
that's trainable, something they can use
with RL. Um, it's been a lot of fun
thinking about like what are the
abstractions? What are the pieces here?
And so like there's things like parsers
and rubrics that I think are like nice
building blocks that you sometimes want
to use. You can also like not use them
if you don't want to, but like I tried
to make it fun and user friendly. Um,
the other day I like was like, let's
train a Wordle agent. I think this was
like a fun little toy problem where it's
like it's not that hard of like a game
for us as humans, but like it's actually
like kind of tricky to get your code to
be this sort of thing where you have
this like multi-turn interaction
protocol that you actually can do
learning with. Um, but now it's like
much easier. like the code to do these
things is like quite simple and the
reward functions can kind of be
relatively simple for this sort of setup
where it's like okay you want to reward
it for like uh solving the thing
eventually but also like give it more
rewards for doing it in less turns and
like this is a 7B model like works
reasonably well but one of the reasons
it works um which I'll talk about in a
sec is uh SFT warm-up as a way of kind
of lowering the barrier of entry like
this the code as it is is very much set
up so that like your environments for RL
are also just like synthetic data loops
or evals where you can plug in claude or
deepseek or open AAI and like test. So
you don't have to like do RL to debug.
You can like debug with an API in terms
of seeing is this a good eval? Is this a
good reward once you're kind of
comfortable with it you can like use
whatever API you like that you are
allowed to use and make synthetic data
do some SFT on it and now you can start
doing RL and this like helps a lot with
small models. Um, I think there's a lot
of efficiency challenges that are like
I've been kind of hard at work trying to
solve in terms of like having all of
your computation be utilized
effectively, having everything be like
fully async so you don't have to worry
about like batching. Um, and that your
trainer and your inference can kind of
go at the same time. You can be like a
little bit off policy. Um, a lot of
engineering that I'm hoping like if you
want to worry about that, great. Dig
into it, fork the repo, mess with
things. If you don't want to, you
shouldn't have to. Um, and like the idea
here is that this should become
something that more people are trying
out, more people are having fun with
with exploring and getting a feel for
it. Um, because if it's going to be a
thing we have to worry about if this is
the future of building better agent
models uh for your applications, like
now's a good time to start. Um, and so
this stuff is set up so you can like on
a couple GPUs like uh do a lot of
interesting research. Like the barrier
of entry is like much lower now than it
used to be. Um, I have a lot of fun
doing this on like a couple GPUs. Uh, we
sell GPUs by the way. Um, thanks
everybody. Uh, I don't think we have
time for questions, but uh,
yeah. All right. Thank you. Thank you so
much, Will. Um, next up on the stage,
we're going to have Greg Comrad. He is,
uh, the founder, one of the co-founders,
and president of the ARC Prize
Foundation. Um, ARC is fantastic.
They've been creating some of the
highest signal evaluations. Um, as we're
on our path towards AGI, um, they're
basically helping us measure where we're
going. I'm very excited to hear, um, I
think we might even get a sneak preview
today of of the next version of what
they're doing. Um, so anyway, uh,
welcome to the stage, Greg Camera. Thank
[Applause]
you.
Beautiful. Today we are going to talk
about why AI benchmarking is about to
get a lot more fun. But before we do, we
need to go over some cool demos here.
So, I love the Claude plays Pokemon
demo. There's something about really
special about seeing this little
embodied agent make its own decisions,
go and play Pokemon uh for us from our
childhood here. Now, OpenAI got in on
the same game. I thought this was
awesome. And then just the other day,
Gemini beat Pokemon. I like seeing the
little robots with AGI on top of their
head. That must mean that we're already
there, right? Well, if we have these
agents playing Pokemon and it's already
doing it in Beating Head, that means the
game's over, right? We're all done.
Well, not quite. Because with Claude
plays Pokemon, we saw that it would get
stuck in the same place for three days.
It would need interventions. It would
hallucinate different actions. And not
only that, there was a ton of Pokemon
training data that was within the model
itself. So although this is a really
cool example about an agent exploring a
world, there are a lot of things that we
can go and improve on. So as Kyle was
saying, my name is Greg Camera,
president of Arcress. We are a nonprofit
with the mission to be a northstar guide
towards open AGI. We were founded last
year by M Franis Chalet and Mike Canoope
and just last December we were invited
by OpenAI to join them on their live
stream to co-announce the 03 preview
results on ARC AGI. Now there's a lot of
AI benchmarking companies out there but
we take a very opinionated approach as
to how we should do this. And our
opinion is that the best target we
should be aiming for is actually humans.
And the reason why we think that is
because we see that humans are the one
proof point of general intelligence that
we know about. And if we use humans as
the target, that does two things for us.
Because what we do is we come up with
problems that are feasible for humans
but hard for AI. Now, while we do that,
that does two things. Number one is it
creates a gap. And when you have that
gap, you can start to measure. Well, how
many problems can we come up with that
humans can still do but AI can't? And
then number two is it guides research.
So you can quantify that class of
problems and then go tell researchers,
hey, there's something really
interesting going on on this side of the
problem. Uh there something that we need
to go uh check out from there. All
right. So if we're going to measure
artificial general intelligence based
off of humans, we need to actually
define well what is general
intelligence? And there's two
definitions that I love to uh quote. The
first one was by John McCarthy and he
says that AI is the science and
engineering of uh making machines do
tasks and this is the important part
that they have never seen beforehand and
they have not prepared for beforehand.
This is very important because if you've
seen a class of problem beforehand if
it's already in your training data then
you're simply just repeating
memorization. You're not actually
learning anything new on the fly. Right?
The second uh person I like to quote on
this is actually Francois himself and he
put it very eloquently within just three
words and he calls intelligence skill
acquisition efficiency and this is this
is really beautiful here because skill
acquisition can you learn new things and
not only that but how efficiently can
you learn those new things and humans
are extremely of spoiler humans are
extremely efficient at learning these
new things. So Francois proposed this
definition in his 2019 paper on the
measure of intelligence. But he went
further than that. He didn't just define
it. He actually proposed the benchmark
to see can a human or or an AI can it
learn something new and then go repeat
what it learned. And this is where the
RKGI version one benchmark came out. So
over here on the left hand side, this is
the learn the skill portion. This is
what we call the training portion. And
what we show you is a transformation
from an input to an output grid. And
then the goal for the human or the AI is
to look at it and say, "hm, what's going
on here?" And then on the left, we
actually ask you to demonstrate that
skill. So it's a little mini skill you
learn on the left and we ask you to
demonstrate it on the right. And if you
can successfully do it, and this is what
it looks like, it's just the grid editor
here. Then yes, you've learned what the
transformation is and you've actually
applied this. And so you're showing a
nonzero level of generalization as you
go through this. So our benchmarks, RKGI
2, this is the most recent one. It has
over a thousand tasks in it. And the
important part here is each one of these
tasks is novel and unique. And what I
mean by that is the skills required for
one of them. We will never ask you to
apply that same skill to another task.
Um, this is very important because we're
not testing whether or not you can just
repeat the skill you've already learned,
but we want to test all the little mini
skills that you can do over time and see
you can see if you can actually
demonstrate those. And if we're going to
back up that humans can actually do
this, well, we need to go get
first-party data. So our group as a
nonprofit, we went down to uh San Diego
and we tested over 400 people. So rented
a bunch of computers and we did this in
person to pre uh have data privacy and
we made sure that every single task that
was included in ARC AGI was solvable by
people. So this isn't just an aim here.
We're actually doing the work to to to
go and do that. But if we think about
it, there's actually quite a bit of
human-like intelligence that's out of
scope from what we call a single turn
type of benchmark. With RKGI, you have
all the information presented that you
need right at test time. You don't need
to do any exploring or anything. And
it's all through single turn. So if
we're going to be measuring any
humanlike intelligence, and I would
argue that if you are going to measure
humanlike intelligence, it needs to be
interactive by
design. And what you need to have is you
need to be able to test the ability of
an agent, whether that be biological or
artificial, to explore an open world,
understand what goals it needs to do,
and ultimately look at the rewards and
go from there. So this is actually very
in line with what Rich Sutton had just
published within his paper, Welcome to
the Era of Experience. And he argues
that if we want agents that will um be
readily adaptable to the human world,
they need to engage with the open world.
They need to collect observational data
and they need to be able to take that
data to build a world model and make
their own rules and really understand
what it is. Or else you're just going to
have the human ceiling uh the human data
ceiling going forward from here. If
we're going to be able to build this,
we're going to need a new type of
benchmark that gets out of the single
turn uh realm. And this is where
interactive reasoning benchmarks are
going to come in. Now, an interactive
reasoning benchmark is going to be a
benchmark where you have a controlled
environment. you have defined rules and
you may have sparse rewards where an
agent needs to navigate to understand
what is going on in order to explore and
uh complete the objective from here. Now
there's an open question as to all right
if our aim is interactive reasoning
benchmarks what is the medium in which
we're going to actually execute these
benchmarks in and it turns out that
actually games are quite a quite
suitable for interactive reasoning
benchmarks. The reason for this is
because games, they're a very unique set
of um intersection of complex rules,
defined scope, and you have large
flexibility into creating these types of
environments that you can then go put
different artificial systems in or
biological systems with it. Now, I know
what you may be asking here. Wait, Greg,
didn't we already do games? Didn't we do
this 10 years ago? We already went
through the Atari phase. Well, yes, we
did. But there's actually a huge amount
of issues with what was going on during
that realm there. Not um even just
starting with all the dense rewards that
come with the Atari games. There was a
ton of irregular reporting. So everybody
would report their own performance on
these different scales and it was tough
to compare these models with it. There
was no hidden test set that came. And
then one of my um biggest gripes with
the Atari phase was that all the
developers, they already knew what the
Atari games were. So they were able to
inject their own developer intelligence
into their models themselves. And then
all of a sudden the intelligence of the
performance that well that's getting
borrowed from the developer that's not
actually getting done by the model
itself from there. So if we were able to
create a benchmark that overcame these
shortcomings well then we'd be able to
make a capabilities uh assertion about
the model that beat it that we've never
been able to make
beforehand. And so to put it another way
that's a bit more visual. We know that
AI can beat one game. This is proved. We
AI can beat chess. AI can beat Go. We've
seen this many, many, many times here.
And we know that AI can beat 50 games
with 50 known games with unlimited
compute and unlimited training data.
We've seen this happen with Agent 57 and
Muse 0ero. But the assertion that we
want to make is, well, what if AI beat a
100 games that the system has never seen
beforehand and the developer has never
actually seen beforehand either? If we
were able to successfully put a test or
put AI to this test, then we could make
the capabilities assertion about that
AI that we don't we don't currently have
in the market right now. And I'm excited
to say that that's exactly what ARC is
going to go build. So this is going to
be our version 3 benchmark. Today is a
sneak pre preview about what that's
going to look like. And this is going to
be our first interactive reasoning
benchmark that is going to come from
ARC. And I want to jump into three
reasons why it's very unique here. So
the first one is much like our current
benchmark, we're going to have a public
training and a public evaluation set. So
the reason why this is important with
our public training call it on the order
of about 40 different novel games. This
will be where the developer and the AI
can understand the interface and
understand kind of what's going on here.
But all performance reporting will
happen on the private evaluation set.
And this is very important because on
this private evaluation set there's no
internet access allowed. No data is
getting out about this. The scores that
come out of private evaluation set will
have been done by an AI that has never
seen these games before and neither has
the developer seen them. So we can
authoritatively say that this AI has
generalized to these open domains here.
Now the second important point about
what RAGI 3 is going to have is it's
going to force understanding through
exploration. One of my other gripes with
uh current game benchmarks out there is
you give a lot of instruction to the
actual AI itself. Hey, you're in a
racing game or hey, you're in an FPS. Go
control the mouse and do all these
things. We're going to drop AI and
humans into this world and they won't
know what's going on until they start
exploring. So, even as I look at this
screenshot, this is actually one of our
first games. We call it locksmith. We
give all of our games a cool little name
like that. As I look at this, it was I
don't know what's going on, right? But I
start to explore and I start to
understand, oh, there's certain things I
need to pick up. There may be walls.
There may be goals and objectives. I'm
not sure what those goals and objectives
are right when I first start, but that's
the point. So, not only are we going to
ask humans to explore and make up their
own rules as to understand how to do the
game, but we're going to require the
same thing for AI as well. And that's
something that we're not currently
seeing from the from the reasoning
models that we have from there. Now, the
third key point is that we're only going
to require core knowledge priors only.
This is something that we carry from ARC
AGI 1 and 2 as well. But what this means
is you'll notice the ARC tasks there's
no language. There's no text that's
being involved here. There's no symbols
and we're not asking you any trivia. So,
I call these um other benchmarks that
rely on these. Sometimes we try to make
the hardest problems possible. We go
hire the best people in the world and I
call them PhD plus++ problems, right?
And that's great, but AI is already
super human. It's way smarter than me in
a lot of different domains. We take the
alternative approach, which is let's
look at more of the floor and look at
the reliability side. Let's take all the
core um anything outside of core
knowledge and strip those away. So core
knowledge prior the four of them that
there
are are basic math and these are things
that are humans that were either born
with or hardwired to gather right
immediately after birth. So basic math
meaning counting up to 10 basic geometry
so understanding different shapes and
topology and then agentness which is
understanding theory of mind that
there's other types of agents out there
in the world that I know that they're
interacting and then the fourth one is
objectness. So as we create our
benchmark, these are the four principles
that we like to um go after when we try
to test the abstract and reasoning
piece. Now I was reading the recent uh
Darkeesh essay and he actually put it
really well in one of his paragraphs
here. He was talking about one of the
reasons why humans are great and he says
it's their ability to build up context,
interrogate interrogate their own
failures and pick up small improvements
and efficiencies as they practice a
task.
We don't yet have this type of
environment that can go and test this
from a benchmark perspective for AI. And
this is exactly what RKGI is going to go
build. So before we wrap it up here, I
want to talk about how we're going to
evaluate AI because it's like, okay,
cool. You go, they go play the game.
What does it mean? How do you know if
it's doing well or it's not? And we're
going to bring it back to Francois's
definition. So we're going to bring it
back to uh skill acquisition efficiency,
and we're going to use humans, which
again is our only proof point of general
intelligence. We're going to use humans
as the baseline. So, we're going to go
and test um hundreds of humans on these
exact arc tasks and we're going to
measure how long does it take them, how
many actions does it take them to
complete the game. And then we're going
to get a human baseline and we're going
to be able to measure AI in the same
exact way. So, can the AI explore the
environment, intuitit about it, create
its own goals, and complete the
objectives faster than humans? Well, if
it cannot, I would go as far as to
assert that we do not yet have AGI. And
as long as we can come up with problems
that humans can still do but machines
cannot, I would again assert that we do
not have AGI with it. So we're going to
be looking at skill acquisition
efficiency as our main uh our main
output metric
here. Today we're giving a sneak peek
about what this looks like. This is
World's Fair. Actually, next month in
San Francisco, we're going to give a
sandbox preview. So we're going to
release five games. Um we know better
than to try to wait till the end. We're
going to make contact with reality.
We're going to put out these fives.
We're actually going to host a mini
agent competition, too. So, we want to
see what is the best possible agent that
people can do. We'll put up a little
prize money. Um, and then we're going to
look forward to launching about 120
games. That's the goal by Q1 of
2026. Now, that sounds like it's not
that many games, and you think it's not
that many data points, but the richness
of each one of these games goes really,
really deep. There's multiple levels. It
goes deep with each one of them. And
it's quite the operational challenge to
make all of these. And that's a whole
another side of the benchmarking
process, which I'm happy to talk about
later. If this mission resonates with
you, again, Arc Prize, we are a
nonprofit. One of the best ways to get
involved is through making a direct
taxdeductible donation from that. If
anybody in the room knows any
philanthropic donors, whether it be LPs
or individuals, I'd love to absolutely
talk to them. But then also, we're
looking for adversarial testers. We want
to pressure test ARGI3 as best as we
can. So, if there's anybody who's
interested in participating in the agent
competition, whether it's offline or
offline uh online or offline, let me
know. Happy to chat. And then also kind
of cool story, we originally started
with Unity to try to make these games.
And we quickly found out that Unity was
way overkill for what we needed to do if
you're just doing 2 by 2 64x 64 uh games
here. So we're actually making a very
lightweight Python engine ourselves. So
if there's any game developers out
there, anybody wants to get involved
with this and knows Python well, we're
looking for game developers and game
designers as
well. That is all we have today. Thank
you very much.
Kyle, do we have Yeah, I think we have
time in this case for for a couple of
questions if anyone wants to come up.
There's microphones, one, two, three of
them. Maybe a couple of questions. I'm
gonna kick that off. Yeah. Yeah. Yes.
Yes. Um question for you. So I don't
know where I can repeat. Okay.
All right. Um I uh I I it's it's very
hard to make estimates about timelines
famously, but um if you had to guess,
how long do you think this new version
of the benchmark you're making will take
before it gets saturated?
Um well, the the way I think about that
is uh well, I would say I'm counting in
years. I'm not counting decades. We'll
put it that way. Okay. Yes. Interesting.
All right. Uh yeah, we'll we'll take uh
one at each mic. Looks like you've it's
well distributed. So, starting over
here. Sure. Hi. Um, you mentioned
efficiency as part of the requirements
and so I'm wondering for the uh the
benchmarks if you're considering things
like wattage or time or other ways of of
using that as one of the criteria. Yeah,
I I love that question and I would have
put it in if I had more time, but I'm
very opinionated about efficiency for
measuring AI systems. If I could have
two denominators for intelligence on the
output, number one would be energy
because you know how much energy the
human uh the human brain takes and
that's our proof point of general
intelligence. So you can take how much
calories the human brain takes. So I
would love to do energy. But the number
two denominator is the amount of
training data that you need for it.
Neither of which are very accessible for
closed models in the current day. So we
use proxies and the proxy is the cost.
But then with interactive evos like
this, you get another proxy which is um
action count and how long does it take
you to actually do it. We're not gonna
have a a wall clock within these games.
It's going to be turnbased. Um so we
won't have a wall clock to do it.
Awesome. All right. Question two and
then one, two, three. Please keep them
both very short. Yeah. Um yeah, very
quick question. Um could you define more
what do you mean by objectness? Yes,
that one's actually quite simple. It's
just understanding that when you look
out into the world that there's um a
mass of things that may act together. So
the crude way would be you have one
pixel but then it's surrounded by a
whole bunch of other pixels and they all
move together. You understand all those
pixels as one and kind of acting as a
one body rather than individual. And
really evolutionary wise that's a same
that's a tree over there. All this is
part of the same tree that that kind of
thing.
Um final question I'll keep this one
super short. Uh how do you distinguish
between tasks that um in the games that
you guys you guys are developing? How do
you distinguish between tasks that
humans cannot do and an AGI also cannot
do? Like what is the north star there?
It's a good question. It tasks that
humans cannot do are a bit out of scope
for our thesis on how we want to drive
towards AGI. So I would say that's not
that's not really the aim that we're
looking looking for on that. Um that's a
whole different conversation around
super intelligence and may that's for
another time. Thank you. All right.
Thank you everyone and let's hear it for
Greg.
[Applause]
Awesome. Okay. So, uh our next speaker
speaker, it is my pleasure to announce
to the sta bring to the stage um Akansa
Chadri. Um so, while she gets up and is
is getting plugged in. Um I'll give a
bit of an introduction. So, she is
working at reflection AI. Um she's going
to talk to us about using reinforcement
learning for autonomous coding. This is
a huge area. This is what all the big
labs are doing. I'm very excited to hear
more about how that um how that works,
how she's getting it to work. Um this is
the perfect person to talk to us about
this. Um Koncha was the first author on
the Palm paper which was you know an
absolute breakthrough LLM produced by
Google a few years ago. Um she led up
the uh she was a lead researcher at
Gemini um early on and now of course
she's at Reflection AI where she spends
all her time thinking about this. So
welcome to the welcome to the stage.
[Applause]
If the presentation works, that's the
AGI complete problem,
right? Okay.
HDMI.
Okay. I'm trying to mirror it. Uh And
that's the excitement
here. You can see it, but I can't see
it. So that's why I'm
fixing. Let me solve it one more time.
Good. You good to go? Yes. Awesome.
Okay. Hi everyone. I'm Akans Shaw. I was
at Google for more than six years and I
led the research for Palm and I was a
lead researcher in Gemini. Uh these days
I'm working on uh pushing the frontier
for autonomous coding uh with
reinforcement learning.
So just to recap the arc of how we have
progressed in large language models and
um why autonomous coding and why now.
Um so I think everyone here or those of
you uh who don't remember in 2020 there
was this breakthrough paper that came
out which talked about scaling laws for
large language models.
And if you were to take a 30-cond recap,
all the main thing it said was that
there's a power law relationship between
the test loss of large language models.
Um, so if you use more compute, more
data and put more parameters in your
machine learning model, uh, which is a
transformer model, you will get more
performant models and it will not be
performant just in the domain in which
you are training the model. it will
actually be performant and it will
generalize to many other domains and the
generalization was uh pretty much a
feature uh in this particular case. So
as the uh large language models got
bigger we saw continuous improvement
across benchmarks to the point that
they're starting to get saturated now.
And the other interesting thing was that
we saw emergent behavior uh where
capabilities were emerging in large
language models that were not present in
smaller models. And this is a classic
slide that I show for for the work that
we did uh in palm. So typically when you
go about trying to solve math problems
and you give the model some examples on
the left you have a math problem around
tennis balls and then you give a second
problem the model output looks wrong.
But what palm and the subsequent set of
uh papers showed was that if you ask the
model to output its uh reasoning chains
uh which has become very common concept
now but this is remember 2021 so four
years ago um if you ask the model to
show its reasoning chains then the
answer actually is correct. So basically
by getting the model to uh output it as
chain of thought or reasoning chains the
the model performance improves and uh
this capability particularly emerged in
large language models. These are all the
models. Uh so lambda and palm were the
state-of-the-art models about three
years ago and what I'm showing on x-axis
is the increasing number of parameters.
Palm was scaled all the way up to 540
billion parameters. No one actually
publishes the number of parameters these
days. So you have to live with the the
graphs from three years ago or the open
source stuff that's coming out with
DeepSeek and Quen models. But what
Y-axis is showing is that the solve rate
on middle school math word problems was
increasing uh with the number of
parameters in the models and it was
essentially increasing mainly when you
were prompting the models and asking
them to show chain of thought and this
led to all kinds of prompting techniques
where you ask the model to think step by
step. you even go and bribe the model
and such and you ask the model nicely or
not. So this was all kinds of fun stuff.
Um and I think the the uh the thing that
really stood out from this generation of
models years ago was that this
capability was not just limited to
mathemat uh math problems. It was uh
basically uh generalizing across a whole
bunch of domains anywhere from question
answering in other languages to puzzle
problems to um multitask natural
language understanding
problems. And what this led to next was
that now that these models could reason,
we could get them to follow
instructions. So the first set of
applications that became possible with
these large language models were chatbot
applications. So everyone remembers that
chat GPT and uh now Gemini and various
other chatbots have become extremely
popular. All of us use them all the
time. But what made them really possible
was that when you give instructions to
the model to go do something, it's
actually able to do it. And the way it
learns that is actually based on
reinforcement learning. And the
reinforcement learning data that we're
giving to the model in this particular
case is
essentially data based on human
feedback. So you're basically saying
okay here is a set of
questions and if I were to give it to a
human and it were there were two answers
which one would the human prefer and if
you have enough of this data and you
train your model you would actually end
up with uh better performance because
you taught the model which set of
responses to prefer and this actually
doesn't only work in chatbot
applications it also works in code. So
on the bottom right I'm showing that
even if you were to do this for
applications and code you start to see
some performance
improvements. Now of course the question
is that last year there was a whole
bunch of debate as to are we hitting the
wall in terms of performance of large
language models uh pre-training is not
giving any gains or all all of these
questions were on the horizon. So what
is
next? And I I one of the key questions
to remember in in all of this is that
when you go and pre-train the models,
you end up spending a lot of money. Um
on training these models, it could be
tens of millions of dollars. And when
you do inference on the models, it's
extremely cheap. Um these numbers are
not endorsed by any of the companies I
worked at, but these are public numbers
uh from uh public sources. So going back
to the main point that I want to make
here is that training is extremely
costly. So if you constantly try to
scale up the model size, you end up uh
in in this regime of like um if if it's
not giving performance gains, then can
we get performance gate at uh gains at
inference time because inference calls
are so
cheap. And a key idea that was uh
extremely useful here was that if you
could get the models to generate
multiple responses and then do majority
voting. So uh in the example above I'm
showing that we get we the the prompt
doesn't make sense but you've given a
mathematical problem to large language
model and you're asking it to generate
three answers independently and then you
basically do some voting on top of those
answers and if two answers match then
that's a majority vote or like if in
this room I were to ask a question and
all of you said yes then that is a
majority vote. So similarly in large
language models if you can get the model
to like generate many many samples and
then consistently get it to uh like get
many of those answers to agree this
notion of majority voting or
self-consistency had shown gains. So
this kind of scaling computed inference
time was clearly one avenue to go push
on. Another avenue that emerged and
showed substantial value was that you
could sequentially revise your previous
response.
So as humans often times we write the
first answer and then we go evaluate our
answer and we're like oh there's some
mistake here it doesn't quite match and
then you go fix it. So basically can we
get LLMs to do the same kind of revision
looking at previous set of revisions and
this was the second. So basically having
longer uh chains of thought uh and
getting the model to improve
consistently in inference time based on
that and these kind of techniques uh
where you could verify your correct
answer. So in math or in programming
where you have unit tests showed uh very
clear gains. So what I'm showing you
here is an example from uh uh one of my
colleagues work um at Stanford uh which
is a publicly uh published uh paper and
on the y-axis we have passet k or
coverage score and on the x-axis we have
u number of samples so as you basically
are doing a lot of samples on the x-axis
your accuracy is improving uh with open
source deepseeek model and just taking
more samples so you're getting a very
high score on bbench verified compared
to even state-of-the-art back in end of
2024. Uh, of course, now all of these
scores have pushed up and we are roughly
somewhere around 80%
already. But what we want to take away
here is the fact that these lines of
work they showed that inference time
compute predictably gives us gains
especially in domains where we can
verify.
If we know how to verify the answers,
then we actually know how to translate
that into intelligence. And going back
to my talk title, coding is one of those
domains where we do have the capability
to verify um and that gives us
tremendous advantage in terms of
building super intelligence on top of
autonomous
coding. Of course, now you ask the
question of what does automated
verification mean here?
So for inference time scaling to work
you need basically some way to say this
output is correct. Now in math um this
is a very simple example. If you were to
give the input to solve this
mathematical equation um and if you were
to do the same calculation on a
calculator you can actually verify that
that problem is correct or that solution
is correct. Um and similarly in math you
have formal proofs. So you can actually
verify things are correct. uh in coding
you have unit tests in compilers you can
actually generate the code and then use
PyTorch as a verifier uh PyTorch the
compiler as a verifier and in fact uh in
domains where you don't have uh this
kind of verification then there's a
large gap if you were to generate a lot
of solutions and then do majority voting
you actually don't get as much gains so
what this roughly meant was that okay so
inference time scaling would work in
scenarios where I have automated
verification
But that doesn't quite solve the problem
for it to be have real world impact. And
the reason for that is shown in this
graph as to typically uh if you do
majority voting and these uh this is
across multiple different models on
GSM8K which is middle school math
problems and another math benchmark uh
if you were to sort them by correct
fraction you have to sample a lot. The
correct generations could be very rare.
So who has time to sample 10,000 times
and then get a correct solution? You
would be sitting there waiting just
finding the correct solution unless you
can actually figure out where the
correct generation
is.
So basically scaling inference time
compute with just majority voting or
longer reasoning chains is great in the
sense that there is some correct
solution somewhere there but it doesn't
work well across the board. So what will
get these models to learn to generate
correctly uh during training? Well, in
in the chatbot application scenario, we
saw that RL with human feedback did
work. So can we apply the same principle
here and get the model to generate
correctly in uh where where we can
automatically verify the outputs.
So our belief at uh reflection is that
the next frontier for scaling is
reinforcement learning and we already
have proof points from some of the
frontier labs as well. And as David
Silver and um Saturn published recently
they agree with or or rather they they
are the pioneers in uh in reinforcement
learning. They say that we are basically
entering the era of experience like
starting from alpha go and alpha zero uh
where you had an era of simulation and
the next set of large language model era
was where you scaled up with RL using
human data but the next era from this
year is really the era of experience
which was which will lead us to super
intelligence. So reinforcement learning
will be a fundamental component in
building uh super intelligent systems uh
especially in areas where we have
automated uh
verification. And some uh proof point
for why this makes sense is that in math
u over several papers this is uh results
from 01 but over several papers we have
already seen examples that if you give
the model on the right side uh test time
compute uh on the y-axis test time
compute is same as inference time
scaling and you measure accuracy on the
x-axis it should go up um but as you can
repeat this process uh in with
reinforcement learning Then the training
time compute going up on X-axis also
improves the accuracy on Y-axis for a
challenging benchmark in math called
Amy. Uh most of these benchmarks
saturate within a year as you probably
have learned by now. So uh this
benchmark is already saturated.
Um so now that I've hopefully convinced
you that reinforcement learning and
scaling reinforcement learning is uh the
next
frontier you'd be like okay so why are
why is not everyone doing it? What's so
challenging about it? So as I have built
large language models before a big part
of building uh these systems uh ends up
being that the machine learning plus
system stack for these uh systems
themselves is very challenging. So here
is um an example of why scaling up
reinforcement learning is challenging.
So if you are trying to do reinforcement
learning with uh PO which is u one of
the algorithms used for RL with human
feedback um then it moved to uh DPO you
have to keep four copies of uh different
models. Uh so if you imagine a really
large model and then you have to keep
four copies then you have to arrange
them somewhere on GPUs in your large
cluster you you can have some fun
figuring out the exact layout and um
it's it's it's a fun and interesting
problem but it's a hard problem in the
sense that uh to make maximum
utilization of these systems and and
arranging them in the right way just
building that system is extremely hard
and uh deepseek actually showed uh with
deepseek math that gpo uh gets gets rid
of the value model and and only has
three copies of the model. But that
doesn't that's still a very challenging
problem. So scaling up RL uh is more ch
even more challenging um than scaling up
um LLMs because you have multiple copies
of the model and you have a training
loop and an inference loop. And then on
the machine learning side on the on the
reinforcement learning side you also
suffer a lot from reward hacking. If
you're uh the model that is deciding
that this is the correct answer is a
neural reward model. So you uh as we
discussed before in autonomous coding
applications you do have the ability to
verify your output. Uh which roughly
means that you can decide this is the
correct answer or not. Uh that's how
sweet bench verified scores uh work
today. U you have execution feedback,you have unit tests. So all of these
possibilities of course um this is an
ongoing list. All of these possibilities
me mean that you can design better
reward
functions. Okay. So this means that
autonomous coding is a great domain for
scaling up RL. Then the question becomes
how does this have real world impact? So
in software engineering
applications generation of code is only
one part of the system. If you look at
end toend workflows for software
engineering there is many more parts to
that system. How do you scale up your
system to generalize across all of those
domains? So that's the problem we are
trying to solve at
reflection. Our mission is that we would
like to build some super intelligence
and we are starting with autonomous
coding as the root node problem for this
um mission and uh we have a team of
about 35 pioneers um who are who have
pioneered various uh legendary works in
LMS and reinforcement learning. So if
you're excited about this mission, uh
you can reach out to um one of us um or
my u my email is my last name at
reflection.ai and we would love to work
with you. And with that, I can take
questions. All right. Um same protocol
as last time. If you have a question,
please come up to one of these three
microphones we have distributed
throughout. We can probably take one or
two questions. So if you want to ask
something um feel free. Um I guess I can
I I'll do the first one while people are
coming up. So I'm curious
um seems like the foundation models are
tried to build one model and deploy it
across everything. Do you have an
opinion with the work you're doing right
now if you think that's the right
approach or if you think there'll be
more specialization on different
languages or even like individual code
bases? Um or do you feel like the best
approach is just to have like one model
that's trained across the the greatest
diversity of tasks possible? Uh I think
that will answer your question uh in
terms of building coding agents does
require um multiple capabilities and how
you get there you will definitely need
multiple LM calls and then whether
that's one model or multiple models I
think that's the secret sauce right now
for most people. Fair enough. All right
please. Hi. Um I'm wondering in the
slide with the chart of error of
simulation, error of something and error
of experience. Uh they had put in
AlphaGo and um the uh previous one where
also you they played stock Star stock or
something. They all used MCDS uh which I
mean maybe it's my unfamiliarity with
them but it's also data simulation. Uh
so we're using synthetic data for era of
experience as well. So how does why is
that called simulation and why is what
we're doing right now not called
simulation? What's the sort of overlap
between simulation experience? How does
that how do you think about that? I can
ask babe that question, you know, but
going back to the point, I think I think
the better way to answer that question
is uh roughly what Greg covered in the
last talk where his comment was that um
so in gaming you can envision what
scenarios might happen next and you're
basically using that to build your
reinforcement learning. So you're doing
rollouts and you're you're basically
building uh based on that. Um in in real
world in most scenarios you have an
imperfect roll out. So you don't have
full knowledge of how the system might
work. Um simulation is possible in
certain domains where you do build a
world model uh which is closer to
robotics and all the work that's
happening in the physical AI space right
but in the in the real world
applications which is what we're
targeting uh you will have imperfect
things. So you have to actually
experience the real world and you have
to collect some data and that data is
not going to be in any way complete nor
will it complete early search the
exponential search space that could
exist.
Awesome. Thank you so much Akancha.
We'll have to stop it there. Um but I
assume will will you be around
afterwards to to answer questions?
Awesome. If you have more questions
please do. Um next we're going to
welcome to the stage uh Ryan Martin. So
Ryan is one of the founding engineers at
Bespoke Labs. Um, sounds like he's got a
friend. Um,
um, anyway, we are very excited. So,
Brian's gonna be talking about a project
that he worked on, that they worked on,
building a reasoning model. It's called
Open Thinker. Um, that actually is able
to outperform the distilled versions of
R1. So, he's going to talk through um,
what they built there and uh, and yeah,
like what we can learn from it. So,
welcome. Thank you. Thank you.
So yeah, I'm Ryan. I'm a founding
engineer at Bespoke Labs. And today I'm
going to talk to you about Open
Thoughts, which is our project to create
the best open-source reasoning data
sets. And I'll be switching tack a
little bit from our earlier discussions
on reasoning and RL and focus on the
reasoning part and you'll see why. So
just so we're on the same page, we've
talked a lot about reasoning, but what's
actually going on here? So I like this
graph from Jason which shows this
incredible performance that's happened
in the last several months where models
are getting much much much better on
certain benchmarks. Um and if you look
at that this is reasoning this is test
time scaling. I think everyone here is
quite familiar with this and it seems
that certain tasks like Amy, which are
competitive math problems, really
respond to models when they're able to
think step by step and do these long
chain of thoughts. Um, so let's go back
to DeepSeek R1. Now, Deepseek R1 was
really impressive for a lot of people
for a lot of reasons and RL was a big
part of that. But I was also
particularly interested because DeepSeek
R1 at the end of the day is an SFT
model. So the final weights that they've
released are actually from Deepseek V3
base which is fine-tuned on 800K SFT
examples. 600K of which are reasoning.
Of course you can see here that RL was a
big part of it and RL was used heavily
to create that model which generated
this data. Um but at the end it was SFT
and a little bit of RL for alignment. So
this was really interesting and
surprising. And the other thing that was
really interesting and surprising to us
was these small reasoning models that
Deepseek released which were incredibly
strong. Um and this for us was a a huge
motivation a huge motivation to try to
do this ourselves. And why is that
interesting? Because if we go back to
here, none no additional detail was
really given on these data sets here. So
if you want to create strong reasoning
models, we now sort of have a training
recipe, but we don't have the data
recipe. That's the missing link. Okay. I
want to also include a slide here on why
is it interesting to train your own
reasoning models. So uh I'm partially
taking this from Amir's talk yesterday
on open source and enterprise which I
really liked. But there's these main
points, performance, privacy, speed and
cost, and then ownership and destiny. I
think um using reasoning is a is a great
tool to solve a problem. And you
shouldn't limit yourself in your
toolbox if you're trying to solve a
specific domain task. So, uh as we
talked about before, RL is a great tool
in this toolbox to tackle to tackle
reasoning tasks. But we're going to see
here that SFT is, as Nathan put this
morning, extremely easy and extremely
effective. Okay, great. Now, the missing
link. How do we actually solve for this
this reasoning data recipe? There's all
these questions that we had when we
started. How much data do you really
need? What data creation steps are
necessary? What are the optimal choices
for each step in that data creation
pipeline? And then, how do you even go
about figuring all this out? And this
this is the meat of the Open Thoughts
project. So today we're excited to
announce Open Thoughts 3, which is hot
off the presses, just came out two hours
ago, which is our latest and greatest
version of our reasoning data sets.
And thank you. And now we this is the
state-of-the-art reasoning data set
recipe.
So you can see here these graphs are
showing accuracy on three of these
reasoning benchmarks. Amy which is
competitive math, live codebench is
competitive code and GPQA diamond which
is our science questions. Um on the y-
axis you see accuracy is going up. Uh on
the x-axis you see the data scale is
going up. So we we heard before that
scaling is difficult particularly
difficult with RL. The good news is for
SFT scaling is quite easier. Um you can
see here we compare to other open
reasoning data sets. So Neatron Nano
Nvidia released this great model
Neimatron nano it's a 8 AP model and
they also released the data set to train
on it. So we compared directly by
training on the same base model between
our data set which is our data set
recipe and the Neatron nano data which
is the Nvidia recipe and you can see
here there's a significant gap. So we we
shifted this scaling curve
upwards. Great. So the yeah this is the
state-of-the-art 7B open data reasoning
model. You can see we've had we have
measured across the domains of interest.
So science, code, and math and then a
couple held out
benchmarks. So our original goal was to
to reproduce to find the missing link
for the Deep Seek distill models. And
you can see here we've crushed that
goal. So we're we're significantly
outperforming the DeepS R1 quen 7B model
which we started off trying to
reproduce.
And then compared to the Neimatron nano
model which is trained on a different
base model um we are also outperforming
on some benchmarks and similarly
competitive on some others. So okay
let's actually talk about how we achieve
this. This is the interesting part for
you. So we go back to the scaling graph.
You can see um once again on the x-axis
we're scaling data set size. So uh this
is a a huge method to increase accuracy
and the thing here is it gets more and
more expensive exponentially more
expensive as you keep going.
Um and then uh on vertically you can see
that we've shifted this the scaling
curve up. So this is what I was talking
about before. This is the improving the
data set recipe. So given a fixed data
set recipe you can always scale it
larger and you can always have higher
performance. But um if you want to push
your performance to abs absolute
maximum, the real question is how do I
create the best data set and therefore
what is the best recipe for the data
set. Okay, so uh enough teasing here.
Let's go into the meat of it. So this is
this is how we approach this problem.
We broke down the data set pipeline into
sourcing questions, mixing different
sources of questions, filtering those
questions, filtering out the high
highest quality questions, generating
answers with a teacher model. So that's
distillation, and then filtering out bad
answers, um, and and lastly, at the end
of this entire experimentation, we
looked at what what are the best teacher
models, which which teacher model should
we select? So through this entire
pipeline, we've we've come down to this
final data set recipe. Now, this was a
ton of work. This is a screenshot of our
our hugging face page. So, you can see
created over 5,000 data sets and almost
3,000 models. Um, for this project, it
was only around a thousand experiments.
But it just to give you an idea of how
rigorously we looked at the different
decisions in each of these steps of the
pipeline. And also, I think this is
interesting because it it peels back the
curtain a little bit on maybe what the
frontier labs are doing. uh finding
signal at the smallest scale possible
and trying out as many things as
possible and empirically choosing the
best and then scaling. And often
sometimes when you scale you see okay
what was the best at the small scale
doesn't actually work but if you're
lucky um and you've done good science
then you'll you'll your yolo run will be
the best possible
right okay so these are the the key
learnings that we had from our data set
recipe and and this is what you can take
away so the first thing is that pretty
surprising sampling multiple answers so
multiple reasoning traces per question
in your data set works really really
well. Um the the performance does not go
down at a fixed scale. If you take a
fixed scale of questions, say 30k
questions um or 30 30k examples and of
those you if you take just 30k questions
and you only sample once per question
that performs pretty similarly to um if
you took 116th so 30k over 16 and then
for each you sampled 16 times which is
quite cool. So this allows you, this is
really cool because this allows you to
scale by 16x, which is more than an
order of magnitude. And if you remember
the graph from before, that corresponds
to a pretty large increase in
accuracy. The other surprising thing
that we found was that a better model in
terms of its own performance on
evaluation benchmarks does not
necessarily mean it's a better teacher
model. I think a good way to think about
this is a brilliant researcher who's
maybe a terrible lecturer, right?
Um we found specifically Quen 32B was a
stronger teacher model than Deepseek R1.
So we switched to that in our our recipe
even though previously everyone has been
using
R1. We also found that the syn the
sources of data that had synthetic
questions were actually quite good. Um
some of the top sources that we selected
were entirely synthetic and better than
sources say that scraped from forums or
had humans manually write things. And
this is also really good news because
synthetic question generation is
scalable. So once again we go back to
the x-axis and we can push even further
which is is accuracy
boost. So question filtering also works
well here. We we filtered questions by
having asking a language model how
difficult is this question and then
taking only the hardest questions.
We also had a language model try to
answer that question and looked at the
length of that answer. So these are sort
of proxies for the same thing. You can
imagine that if a problem is a lot
harder then a language model will think
more and it will produce more text. So
its answer will be longer and these
things worked better than embeddings
based approaches or fast text
classifiers which is interesting as so
much that those those approaches were
typical for pre-training. So it seems
that the the filtering for data and
post- training is quite different than
pre-training. Okay. Some things that
didn't work that were also quite
interesting. Uh through our experiments,
you saw that choosing a smaller number
of high quality sources was much better
than trying to optimize for diversity by
going for a larger number of sources.
That's very counterintuitive, right?
You'd think, okay, I'm always going to
go for for higher diversity. But this is
actually not what we saw. Um the last
thing we was interesting is that people
talk a lot about um verification which
is obviously very important for RL and
we actually see for SFT and distillation
it didn't seem that filtering based off
of the answer or verifying the answer
really helped at all. This is quite
surprising. Um, and I think there's
there's some some good research in the
literature about maybe why this is
because if you have the the hardest
problem, it might be still helpful even
if you have an incorrect answer to that
hardest problem. Um, keeping it in and
and seeing how the teacher model
attempts. It's not just the final output
that
matters. Okay, great. Okay, so this is
those are all like the amazing learnings
that we had for OpenTOS 3, which super
excited to share. But now you're
probably thinking, okay, they they've
done a thousand experiments. I don't
want to do a thousand experiments. I
still want to create reasoning models.
Uh how do I adapt this if I want to
create specialized reasoning models? Um
so I guess the first thing I would say
is be aware that based off of your
domain, these exact choices might be a
little bit different. I would suggest
okay, start with our recipe and then
iterate on it. If you have um capacity
and compute, try a couple different
choices for each step in the pipeline.
And I think a good example of this is we
studied each step in the pipeline
differently by domain. So we studied it
distinctly for code, science and math.
And we saw for example in the question
filtering which I talked about before um
using difficulty labels worked well for
code questions but for math and science
it was response length. And if you think
about that for a second, it makes a
little it makes sense because the
response length for coding questions are
very different, right? For for um Amy
math, it's literally just a number
between zero and a thousand. So the the
answer is not it's not considering a
large portion of the length, but you can
imagine there's very simple coding
questions in which the answer is still a
lot of lines of code. Um so yeah, this
is one thing to be aware of. The other
thing which I talked about previously is
synthetic question generation because it
works so well. Um and if if your
specialized domain if you're if you
don't have a lot of data for your
particular problem then uh go ahead
transform that existing data into
questions expand it um throw those as in
context examples and just and generate
more data. So yeah we built an open
source library for this. It's called
curator and you can you can try that
out.
And then lastly, I feel like everyone
says this, but it can't be said enough.
Like the evaluation is paramount. If you
don't know how well your models are
doing or improving, then you cannot make
good principled decisions about your
data set recipe. Um, we spent a lot of
time on this. We also have this open
source library on GitHub called
Evalchemy, uh, which takes a care takes
care of this and also takes care of the
um, sharding and parallelism. And and
the key thing here is for very small
evaluation sets. If you if you only have
a handful of questions, you should run
your model on those evaluation sets many
times in average. So going back again to
AM competitive math questions, there's
only 30 per year. So uh for our
evaluations, we gave the model those 30
questions 10 times and then we averaged
to get the the the final signal to
determine um which data strategies were
working better than others because
otherwise there's too much noise.
Okay, this is also very very interesting
and surprising and promising for you if
you're
specializing. It seems that you can
actually surpass the teacher in some
domains with distillation. This is this
is super cool. Usually you think about
only RL can push the frontier.
Distillation is just about catching up
to the teacher. But no, that's not the
case. So we have an example, it's in our
paper where um we looked at the legal
reasoning domain. So the problem of
classifying Supreme Court
decisions. What we did is we took 2k
unique questions. We sampled five
answers per question and then we did do
verification here which which did
matter. So we threw away any questions
any answers that were incorrect. Um and
when you fine-tune the 7B model, it
surpasses R1 which is a very strong
reasoning model and also a very huge
reasoning model. So this is very
exciting. I think there's a lot more um
research and also application to be done
here.
Okay, cool. So, everything's open. It's
open thoughts and open thoughts means
open. Go out and build. We have all of
our uh we got our detailed paper. It's
just out this morning. We've got the
weights data set. Uh we have a ton of
repos for code for data generation for
evaluation and synthetic data. So, check
those out. Um this is this is the team.
It was a huge group of people, a lot of
work over many months. Uh, I think we're
all very proud of what we did, but
there's lots of people to recognize
here. If you scan that QR code, it goes
to the tweet and everything uh about the
Open Thoughts project is linked in from
there. Yeah. Thank you.
All right. Thank you so much, Ryan. Um,
that was fascinating. Looks like we're
already getting we have at least one
question lined up. Again, we have time
for maybe a couple of questions. So, if
you have questions, um, please line up
and and we'll do it. Um, actually,
before we get to those questions, I will
say as people are leaving, um, we are
going to be back here at 2 o'clock.
We've got an excellent afternoon planned
on this track. We've got Nathan Lambert.
Um, we've got the, uh, we've got
Christian Seed, who's the co-founder of
X. Um, and it's going to be a really
great track at 2 o'clock back in this
room. Also, one more thing. If you do
have questions for any of the speakers
from this morning, um, hopefully they're
going to be able to stick around. Don't
let them go to lunch. They're going to
be they're they're sitting up here at
the front, so swarm them as soon as
we're done. But for now, let's uh let's
get a couple questions for uh Go ahead.
Um yes, over there. Uh thank you. Great
talk. So uh two questions. One is um if
you're just using SFT on this data,
what's the difference between this and
regular SFT? This is just regular SFT.
Yeah. Oh, okay. So then how is regular
SFT able to make the models like think
longer? Because I thought for the reason
models they have like this thinking
block and they think for you know hours
and minutes and exactly. So how do you
how do you how does SFT make it think
for hours? So you're you're doing
supervised fine-tuning on the questions
and the answers also contain the
thinking. So the model learns to use its
context window and produce these long
thinking traces. So it can do this
people call SFT imitation. Um but it it
can learn to learn this format in the
same way. Yeah. Thanks. All right, we'll
take one from this side. Um, great
presentation, Ryan. Uh, one question.
Uh, why do you think, um, a smaller
model like Quen 32B was a better teacher
than a Deep Sea Car One? What was your
insight in figuring out that like a good
professor makes a bad lecturer? Yeah,
that's a great question. Um I think this
is something we need to investigate more
but you can see that uh when you look at
charts of the length of reasoning traces
you can see the distributions are
different. So uh it might be the case
that you're using more of your context
window using more tokens more steps. It
also might be the case that you just
have a better formatted response better
output. Um this is like an another great
open research research question.
Interesting. I'll also say on this
point, we also tried Claude as a
teacher, which is like a very as a good
strong model and it was just a terrible
teacher. Um, so there's yeah, it's
interesting what can what actually
creates a good teacher. Yeah. All right,
we'll take one more very brief question
from this side and then those of you
still waiting on questions um after uh
after we have closed this up, it's
swarming. Sorry. Um, great talk, Ryan.
Um, we're doing similar kind of thing,
but I just had a question. Do you guys
have any like pattern map as to in the
reasoning chain of thought when things
don't work at what level you know in the
eval do you find out that things are not
working or it's not reasoning correctly
is there a pattern map or something that
you have in your open source rep is
sorry I didn't catch that is there a so
if there are five steps of reasoning to
reach a final conclusion uh at what step
does the reasoning go arai yeah this is
this is a great question we don't do
this fine grain analysis but there is a
ton in literature about this um where
yeah there's a sort of critical step
where it get gets things wrong. Um there
we did like the simplest thing possible
right you could also go in and try to do
more complicated things um at evaluation
time where you're doing interventions to
uh maybe detect steps that have gone
arry and and changed or you can do this
in the when you're creating the data
set. So you could potentially rewrite
things, but everything that we tried in
terms of like messing with the reasoning
trace, it wasn't helpful. Um, so yeah, I
think there's still more to explore
there. There's like this is really just
the start of everything in reasoning.
Awesome. Thank you everyone for your
questions. And one more time, thank you
to Ryan for the for everything you
shared. All right. And again, we'll be
back in this room at two o'clock sharp.
Um, we have three more presentations.
Looking forward to seeing you then.
So I need what this scrap
backics
Is that all you want?
What's that?
This one right here.
[Music]
testing. Testing. What the
[Music]
 Testing. Testing.
All right. Um, hey everyone. Glad you're
all here. This is the reasoning and
reinforcement learning track uh on the
afternoon of the last day of the AI
Engineer World's Fair. Glad you're all
here. Glad you're sharing it with us.
Um, to let you know what the schedule's
going to be. So, I'm going to be talking
right now. I'll give myself an
introduction in a moment. Directly after
this, we're going to have Nathan Lambert
from AI2. He'll be coming up. Very
excited to see that. Um, and then Chris
Seedy, formerly of XAI, one of the
co-founders there, will be speaking
last. Um, so hopefully you're all able
to to stay for those sessions as well. I
think they'll be excellent. Um, to
introduce myself, uh, my name is Kyle
Corbett. I am one of the co-founders of
a company called Openpipe. Uh, what we
do is we do reinforcement learning to
make agents more reliable. Uh we work
with large companies, usually Fortune
500s, things like that, and help them
make their agents more reliable so they
can deploy them in production. If that
describes any of you and you want to
talk to me after, um happy to chat
later. But today, what I'm going to talk
about is uh a very specific case study
um that we did. Uh this case study, I'm
going to talk about lessons learned very
concretely. Um what did and didn't work,
how we were able to build an agent that
worked well with reinforcement learning.
Uh all of this uh everything that I'm
talking about in this presentation, this
is an open-source codebase that we
built. um we wanted to share these
learnings and I'll I'll I'll share that
link with you at the end as well um for
those of you who want to replicate what
we did. Um so what is the project we're
going to be talking about? It's a
project called ART E. It is a natural
language uh assistant that helps you
answer questions from your email inbox.
So I'll give you an example of what
we're talking about here. Um let's say
you want to ask, you know, in this case
our example question is when is Sherry's
move to Portland targeted for? So you
would ask this question to the
assistant. It then goes and it searches
your inbox. It's got several tools. So,
it has like a search tool. It has a read
email tool. And then it can actually
answer the final question. You can kind
of see if you if you look here what's
going on behind the scenes. This is
important so you get a sense of kind of
how this agent works. And as we're
talking through how we built it, how we
made it work. Um hopefully that that
helps uh make the conversation very
grounded in a specific task. So anyway,
you see the agent, it's it's, you know,
searching for certain keywords. It get
those messages back. It's in reading one
of them and and answering the question.
That's that's what it does. Okay. So, um
question, you know, once once we've
decided this is kind of the the task
we're trying to solve, why would you re
use reinforcement learning for this
specifically? Um and uh and the answer
is like to start with, you shouldn't. In
fact, to start off with, we did not. Um
so, the first version of this agent once
we decided we wanted to build this, we
did we didn't use any reinforcement
learning at all. We purely built this on
prompted models. And this is the first
lesson from this talk uh that I want to
share is I would generally always
recommend starting with getting the best
performance you can with a prompted
model before going to any training
including reinforcement learning.
There's a few different reasons to do
that. Uh three specifically. Um the
first one is just like working out the
bugs in your environment, right? Um you
know maybe your tools aren't implemented
properly. Maybe they don't have access
to the data you think they do. um we
find this happens a lot and it's a lot
less frustrating to debug that uh you
know separately from debugging your your
training loops. So you want to make sure
that like you can get at least some kind
of performance um before you start
training. Um and then second of all you
may find as you're trying to improve the
performance on uh on using these
prompted models that uh you can get it
working really well and that's great. So
that means you don't need to train
anything um and that saves you a lot of
time. Um there's a third reason as well
uh that I'll share which is uh basically
once you've gone to that effort, you've
done your best to get the best quality
prompted baselines you possibly can. Um
then uh if you find that those baselines
are not able to get you where you need
to go and you're able to surpass them
with re reinforcement learning, it feels
great. You get to glow and be like,
"Yes, I was able to beat the the
frontier models on my task." Um this
this I I highly recommend it. It feels
good. You can you can like post on X
about it. There's there's nice, you
know, graphs and stuff. So this is this
is what it looks like when everything
goes right. Um so this is an example of
a training run for this art e model that
I'm going to be talking about. Uh you
can see that there's these these lines
for each of the prompted model baselines
that we've got. Um so we've got 03 04
mini and then Gemini and and 4.1. And
you can see uh those ones, you know,
they have certain level performance. And
then you can see this this uh sort of
moving line um that's going on. This is
the model that we trained. And you can
see it actually starts out significantly
worse than these other models uh from
from the start. That's because we
started from a Quen 2.5 the 14 billion
parameter one. It's a relatively small
model, relatively weak model. Um and so
it was doing much worse than these
initially. But you can see as training
progresses um you know initially at the
beginning it it's sort of maybe maybe
there's it's learning the right way to
do tool calls. There's a very sharp bump
as it figures out the basic stuff and
then a more gradual climb until
eventually it's able to significantly
outperform uh any of the prompted models
on this task. And this is sort of what
you're you know in the ideal case when
everything works this this is what
you're looking for. This is what what
you're hoping to achieve. Um this is
another view actually of that same data
we were just looking at. Um I I like I
wanted to highlight it in this way
because it's important to realize. So on
the last graph it looked like the lines
sort of asmtote out pretty close
together. That's because they're getting
near 100%. But the last um you can see
for example with our best prompted model
here 03 uh it's 90% accuracy and with
our RL model we're able to get up to
96%. And so one way to think about that
is like 60% of the errors that 03 was
making um are are actually solved with
our model. Um which is which is quite a
large uh you know we find that that's
actually can be very very important for
the user experience of someone using one
of these. um if you're getting you know
just half as many errors uh that that
can make the product much stronger. Um
so this is this is where we got to on
accuracy. There's a couple other metrics
that we've find are often very very
important. Um and you know the trade-off
between these does does is very task
dependent but but they matter in many
cases. Um cost obviously is a big one.
So for for this email agentic harness
that we had we benchmarked the cost on
0304 mini and our model. So if you
wanted to do like a thousand searches
using 03, that's going to cost $55. Um,
which is a lot. I think for most use
cases, that probably would be cost
prohibitive just from a unit economics
point of view. Um, on 04 mini, we're
down to $8, but that's still quite
expensive. And then we drop another
order of magnitude by moving to this
smaller Quen 2.514B. Again, this is just
driven it by being it being a much
smaller model. So it's it's much cheaper
to run. Um, but we're still able to get
very good performance because we've
specialized it on our task. Um, beyond
cost and the accuracy, um, the third
metric that often comes up is latency.
Uh, particularly if you're doing, I
mean, certainly anything with voice, but
if there's any real-time human
interaction with the task, latency is
going to matter a lot. Um, and we were
able to find on on this task, we were
able to get significantly better
latency. There's a number of different
ways, which I'll go into in more detail
later that we were able to achieve this.
Um, you know, one was just again moving
to a smaller model helps. There's just
less less loading from memory, less
matrix multiplies. it's just you're able
to get tokens out faster. Um, we were
also able to train this model to have
fewer turns going back and forth with
the database with the actual email um
the list of emails. Uh, we we were able
to train it to be more efficient with
its queries. Um, and I'll go into that
in a moment. And so that that leads to
lower latency. Um, there's actually a
third thing which we didn't apply here
but can help a lot with these smaller
things which is called speculative
decoding. That's something you can do on
large or small models. It generally
works better on smaller task specific
models because you get higher um
acceptance rates on on your speculator.
Basically, um there's there's lots of
reasons why smaller models work better.
Um okay, so then the next question, uh
for those of you who haven't done this
yet is like, okay, what is the effort
required to do this to actually achieve
these results? Um if you'd asked me this
question a year ago, I would say, hey,
you should really only be doing this if
you know, you're this big company and
willing to put, you know, months of of
work into a project, I think that's
changing. I honestly do. Um in this
case, uh so this this training run, it
cost us about $80 in GPU time. It did
take about a week of engineering time to
build this and and caveat that was with
an engineer who is familiar with this
domain and and had quite a lot of
experience you know with machine
learning and RL. Um but I actually
expect as as we figure out the right
patterns here collectively as an
industry this will keep dropping. Um and
I expect that uh you know the sort of
payback period to get a return on
investment from these specialized models
is actually going to continue falling as
well.
Um, and uh, you know, part of part of
the reason I wanted to give this talk is
to sort of distribute that know the
knowledge we learned and hopefully move
faster towards that that world where
this is just sort of like a thing
everyone knows how to do and it's very
easy and very fast. Um, so that's that's
what we'll be talking about for the rest
of time is is some more of the lessons
we learned. Um, okay. So uh when you are
using RL to train an agent or really
using RL for anything else um I find
that consistently with different
problems we look at there are there are
sort of two hard problems that come up
every single time. All right. Um and the
two hard problems are first of all
figuring out a realistic environment
right so if you're training an agent you
need to be training it with realistic
data with realistic inputs and outputs
tools available everything like that to
how it's going to be used in production.
um because if you don't then it's going
to be optimizing for the wrong thing and
and you won't get the results you want
when you deploy it. And then the second
thing which sometimes is hard um
sometimes isn't this one is a little bit
test dependent is getting the right
reward function. So reward function that
just means you have to be able to know
when your agent's gone through and say
in this case given an answer to my email
you have to have some way of knowing did
it do a good job or a bad job. All right
that's the reward function. It decides
it it it's it's how you decide if it's
good or it's bad. Um some depending on
the domain sometimes that's really easy.
We have I don't know if Nathan's here.
He's going to be talking next. But um
you know he and his team put together
this thing called RLVR which in some
verifiable domains it's actually very
easy to do a reward. Often times uh not
all domains are like that. Often times
it is kind of hard. Um and so it's it's
somewhat task dependent. I'm going to go
through how we solve these problems
specifically with RE. Okay. First one
realistic environment. So for our re
task, what is the environment we need?
What is the environment this agent's
going to be operating in? Well, it needs
these tools available. It needs to be
able to go and query an email inbox. It
needs to be able to like get emails back
um and and that look realistic. These
emails, you know, the inbox should be
large because that's what most email
inboxes are like. Um the emails in it
should be diverse and they have to look
kind of like real emails. Um so this
could be kind of hard because you can't
just go ask like a thousand people to,
you know, give you uh their their their
personal emails to train on. Um luckily
in this case, we were able to solve this
with the help of a company that has
contributed a lot um to just the open
data ecosystem. Uh generally it's it's
like a quite an iconic company. Uh
perhaps I would call it a historic
company. Um I'm of course talking about
Enron.
Um I'm hearing some laughter. So anyway,
Enron was a uh they were a financialized
energy company in the 90s and 2000s.
Committed massive fraud, ended up
getting shut down by the Department of
Justice. As part of this uh um you know
process uh the the the court cases they
were going through, um a dump of like
500,000 of their emails was released to
the public as part of the discovery
process. Um, so that's that's that's
great for things like this and that's
what we used as our environment uh for
the email inboxes. All right, so now
we've got realistic email inboxes um
with tens of thousands of emails that
are real emails back and forth. Now we
have to design our reward function. So
as our agent is going and as our agent
is um you know we're asking it questions
and then it's giving us answers, we have
to know is the answer correct or not? So
we can reward it when it gets the answer
right and it can learn to do that
better. There's different ways and this
part is very task dependent. Um the way
that we went about it in this case um
was we basically turned it into a more
of a verifiable problem. And the way we
did that was we actually took our email
inbox. We sort of inverted the problem.
We um we grabbed batches of 20 emails at
a time uh from the inbox and gave them
to Gemini 2.5 Pro and said, "Hey, given
this set of emails, give us a few
questions that a user might
realistically ask that the answers are
found in this email." Right? And so
Gemini generated the questions, it
generated the answers, and then of
course the the source emails that came
from. Um, and there were some extra
steps on top of that. A lot of the
questions it came up with looked a
little bit unrealistic. We had a
separate filtering step where we're
like, okay, let's find the subset of
these that that are actually look like
questions that, you know, I would maybe
ask. And we ended up with a list of a
few thousand questions um along with
their verified answers. Um, and so at
this point, it becomes much more of a of
a sort of verified thing. the reward
function becomes much easier because we
know what the correct answer should be.
And so the way we can tell if our agent
did a good job is we give our agent the
question, we let it go and search the
email inbox and try and find the right
emails and everything. And eventually it
comes back with an answer. And then we
can just use an LLM as judge, a very
simple one, and say like, hey, you know,
here's the question. Here's the the
golden answer that that we believe is
right. Here's the answer we got from our
from our model. Is it right or not? Um
we did have to do a little bit of uh
iteration there making sure that the
judge was well calibrated on like what
you know what what counts as as correct
or not but by and large this worked
pretty well um and was able to make this
more of a verified task. Um so so that's
how that's how we solved the the reward
function problem was by having that you
know turning this into something where
we had more of a golden data set. Um,
okay. So, once you've solved that
problem, those problems, once you have
your environment, once you have um your
your reward function defined, then
basically you just kind of have to run a
loop over and over and over again where
you have your agent go through and it
tries to um solve the problem and then
you figure out if it's good or it's bad.
Um, and then you just uh you know,
reward if it's if it's good and punish
if it's bad and that's it. Um, and uh,
you do this over and over and over
again. And then hopefully if you've got
everything set up right, um, it learns
what good looks like, it learns what bad
looks like, um, and it starts doing it
right. Um, and then again, this is this
is the curve we saw earlier where where
you can see it it it starts getting
better over time. Um, okay, a few other
like interesting learnings from this
project. Um, one thing is we found that
there's actually you can throw a lot of
stuff into your reward function uh
beyond just the primary thing you're
trying to solve for. And so we actually
ended up we there were like sort of
eight different little things that we
gave extra credit for. Um, and I'm going
to share two of them here. So the first
one here is um is we were trying to have
it optimized for the number of turns,
how many times back and forth, how many
times it had to query the email inbox
before it came up with the right answer.
Right? So, because the most important
thing of course is is getting the answer
right. But between two answers that both
get it right, we would rather it took
fewer turns back and forth because
that's fewer tokens, that's lower
latency, lower costs, um it's just like
a more efficient agent. So, um so you
can see here on this first graph that
early on it while was getting its feet
wet and figuring out what worked, it it
ended up spiking up to over six turns on
average. So, it would go back and forth
a bunch of times with the email inbox
and and try and find the right thing.
But then once it was able to like figure
out how to use the tools efficiently,
figure out like you know the the right
way to construct keywords and find the
right email, it was able to get very
efficient and actually fast uh better
than any of our prompted models uh on
this metric of um using fewer turns. And
again, this was just because we gave it
a little bit of extra it was it was a
very small amount relative to the reward
for getting it right, but a little bit
of extra credit on on using for returns
and it was able to to use that um to to
optimize against that. Um, another extra
reward function we gave it is um to try
and discourage it from hallucinating
answers. So, um, obviously the best
thing is to get the right answer. If you
can't find the right answer, it's much
better to say, hey, I don't know, than
to make up an answer in in a situation
like this. So, we basically penalized it
if um if the reward model said, hey, you
got the answer wrong and but it hadn't
tried to get an answer, give an answer,
that was like a much lower reward than
if it just said, hey, I don't know. I
can't solve this problem. And as you can
see, that worked quite well. Um,
compared to any of the prompted models,
including 03, we ended up with a
significantly lower hallucination rate u
because that was part of our reward
function. Um, again, these are these are
things that are just sort of like extra
credit, but um we found that like you
can throw in a bunch of these and and it
can jointly optimize all of them at the
same time, which is super
powerful. Okay, I want to talk a little
bit about reward hacking. Um, it's it's
something that comes up a lot when
you're trying to do this, and it's kind
of a fun thing to talk about. Um, this
is an iconic video some of you might
have seen. Uh this was released by
OpenAI almost a decade ago at this point
of um they were they were trying to uh
they had this environment where you were
trying to uh get this boat to complete a
race and instead of learning to complete
uh complete the race it learned that oh
if I just go in this like little circle
that's not even part of the racetrack I
can like just get a bunch of points. Um
and so it just started doing that over
and over and over again instead of like
actually following. Um, this is
something that comes up a lot if you're
doing reinforcement learning. And it's
basically just the difference between
um, uh, the difference between what you
actually want the model to do and what
you can measure. Um, like what you're
actually rewarding it for. And, and if
you almost always if you let one of
these run long enough, it will figure
out some way to exploit your measure.
Um, and it will figure out some way to
to get a really high reward um, without
actually solving the problem. And you
need to just watch for that. So, I'm
going to give a couple examples here. Um
this is a this is a graph um from
another project actually not this one.
Uh so an engineer on our team was uh was
working on this game called NYT
connections. Some of you might know you
get 16 words and you have to put them in
like four groups of four. It's quite a
challenging game especially for these
language models because it requires a
lot of world knowledge and like you know
lateral thinking. Anyway, um so so they
were trying to train this model to do it
and uh it wasn't figuring out wasn't
figuring out what it wasn't figuring out
and then boom, you can see here around
step 40 it just like takes off and it's
like okay we figured out how to how to
solve this and and this engineer I'm I'm
going to I'm going to call out where's
where's where's an on our team he's here
at the conference yeah he's great you
should talk to him after but um he was
like hey we we we solved it like we got
NYT connections and like and it's like
okay the graph looks good let's look at
what it's actually doing what it was
actually doing is it had figured out
there was a bug in how we wrote the
verification And if it just put every
single word in every single category, it
was able to get a perfect score. Um
because we weren't verifying that there
were in fact only four words uh in each
category. Um so this is another example.
This is a fun one. So I was I was
training a model um to produce really
good titles for hacker news. Um titles
that would get a thing upvoted. So I had
this reward model I had trained on like
existing hacker news um articles and how
many upvotes they got. And I was I was
trying to train this model to produce
new titles. And it was working really
well for a while. You can see and and
sort of subjectively as well, I I looked
at a bunch of these these titles
generated and and for these first like
thousand steps or so, it was actually
learning things that I was like, "Okay,
as someone who spends way too much time
on Hacker News, yeah, that that does
look like a good title. You're doing a
good job." And then you can see around
step um 1200 here, it just like jumps a
bunch, right? It's like, "Okay, um it
clearly figured something out. I don't
know what it figured out. Um but we
should look at that." Um, and so, uh,
what it turns out what the model had
figured out was that it could just
completely ignore the content of the
post and generate the same title for
every single one of them and that would
like maximize its score. So, it
generated this title, Google lays off
80% of workforce, literally every single
article, this was this was what it
labeled it as. And the model was like,
yes, that is going to get up vote on
hacker news for sure, which which it
probably would to be fair.
Um so so anyway the way the way we
solved this um what we found is that
it's it's really important to watch out
for this solving it typically involves
modifying in some way your reward
function to penalize things like that.
So in the second example I talked about
it was actually quite an easy fix once
we identified it um which was just add
an extra LMS judge that looked at the
title looked at the content and said hey
is there anything in the title that's
not supported by the content and we
added that on and and it it actually
worked great. Um, the important thing
here is you want to be looking at your
your rollouts, not just blindly trusting
the reward function, figuring out what's
actually happening. Um, anyway, so, uh,
that's it. Um, I'm I'm almost out of
time, so I'm going to stop. Couple of QR
codes for you. Um, everything in this
presentation, and there's a much longer
write up I have of this whole project.
It includes the code, it includes the
artifacts, data sets along the way. Um,
you can you can check that out there.
Um, one more thing is, uh, we have a
Discord that's open. We have an open
source project for training
reinforcement learning models. Um we
have a discord you can go to if you're
interested in this kind of thing. Um we
we're all in there. We answer questions.
There's lots of people from the
community trying to do these things. So
if uh if you're interested in building
things with this um feel free to join it
and yeah happy happy to chat there. And
um yes, thank you everyone. Uh
appreciate your
time. All right. And since I am also um
in my my separate hat the moderator for
this track, um it is my great pleasureto welcome to the stage Nathan Lambert.
Everyone give a round of
applause. Um Nathan, if for those of you
I'm sure many of these people know who
Nathan is, he's he's probably the
strongest voice um in sort of the open
ecosystem talking about post training
generally and and also reinforcement
learning. Um he's got a great uh
newsletter he does as well as um he puts
that out as a podcast and lots of
content on X. But anyway, very excited
to to see what you'll say. Um oh and
also uh yeah runs a bunch of projects at
AI2. They build um probably the best
fully open models. Um so anyway, yeah,
let's hear from Nathan.
Okay, thanks for the intro fellow
Seattleite and I'm sure or I'm sure
we'll talk more. Um this I really came
to this thinking about trying to reflect
on six months into this like
reinforcement learning with verifiable
rewards post01 post deepseeek and I
think that a lot of this stuff is
somewhat boring because everybody has a
reasoning model. Um we all know the
basics of you can scale RL at training
time and the numbers will go up and
that's deeply correlated with being able
to then do this inference time scaling.
Um, but really in AI right now,
everybody, there's a lot of people who
are up to speed, but the crucial
question is like where are things going
to go and how do you skate where the
puck is going? So, a lot of this talk is
really me trying to process is like
where is this going besides getting high
benchmark scores with using 10,000
tokens per answer and like what do we
need to do to actually train these
models and what are the things that
OpenAI etc. are probably already doing,
but it's increasingly hard to get that
uh signal out of them. So if we look at
this like reasoning is really also
unlocking really new language model
applications. I think I this is the same
search query which is like I as an RL
researcher I need to find this all the
time. I forget that it's called
coastrunners and you Google like
overoptimization 20 times to find it.
But I tried asking 03 and it like
literally gave me the download link
directly. So I didn't even have to do
anything. And that's a very unusual use
case to just pop out of this reasoning
training where math and code was the
real thing to start with. And 03 is
great. It's the model that I used the
most for finding information. And this
just really is the signal that I have
that a lot of new interesting things are
coming down the pipe. Um I would say
it's starting to unlock a lot of new
language model applications that I use
some of these. So this is a screenshot
of deep research. It's great. You can
use it in really creative ways like uh
prompt it to look at your website and
find typos or look at only the material
on your website and things like this.
It's actually more steerable than than
you may expect. Um Cloud Code, which I
describe as just the the vibes are very
good. It's fun. I'm not a serious
software engineer, so I don't use it on
hard things, but I use it for fun things
because I can I can put the company API
key in and just kind of mess around like
helping me build my the website for this
book that I wrote online. And then
there's the really serious things which
are like codecs and these fully
autonomous agents that are starting to
come. If you play with it, it's obvious
that the form factor is going to be able
to work. I'm sure there are people that
are getting a lot of value out of it
right now. I think for ML tasks, it's
like there's no GPUs in it right now.
And if you are dealing with open models,
it's like they just added internet. So
like it wasn't going to be able to go
back and forth and look at like hugging
face configs or something and all these
headaches that you don't want to deal
with. But in the six months, like all of
these things are going to be stuff you
should be using on a day-to-day basis.
And this all downstream of this kind of
step change in performance from
reasoning
models. And then this is kind of like
another plot that's been talked about.
And when I look at this, it's like
through 2024, if we look at like GPT40,
it things a lot and really were
saturating then. And then there's these
new set models in 01 which really helped
push out the frontier and time horizon.
So this is the y-axis is how long a a
task can roughly be completed by the
models in time which is kind of a weird
way to measure it because things will
get faster but um it's going to keep
going and this reasoning model is the
technique that was kind of unlocked in
order to figure out how to push the
limits and when you look at things like
this it's not that just we're like on a
path determined from AI and more gains
are going to come it's really like we
have to think about what the models need
to be able to do in order to keep
pushing out these frontiers. So there's
a lot of human effort that goes into
continuing the trends of AI progress. So
it's like gains aren't free. And I'm
thinking that a lot of planning and kind
of thinking about training in a bit of a
different way beyond just reasoning
skills is going to be what helps push
this and enable these uh language
modeling applications and products that
are kind of in the early stages to
really shine.
So this is a core question that I'm
thinking about is like what do I have to
do to come up with a research plan to
train reasoning models that can work
autonomous autonomously and really have
meaningful ideas for what planning would
be. So I kind of came up with a taxonomy
that has a few different what I call
traits within it. Um the first one is
skills which we've pretty much already
done. Skills are like getting really
good at math and code. inference time
scaling was useful to getting there, but
they kind of become more researchy over
time. I think for products, calibration
is going to be crucial, which is like
these models overthink like crazy. So,
they need to be able to kind of have
some calibration to how many output
tokens are used relative to the
difficulty of the problem. And this will
kind of become more important when we're
spending more on each task that we're
planning. And then the last two are
subsets of planning that I'm thinking
about and happy to take feedback on this
taxonomy but like strategy which is just
going in the right direction and knowing
different things that you can try
because it's really hard for these
language models to really change course
where they can backtrack a little bit
but restarting their plan is hard and
then as tasks become very hard we need
to do abstraction which is like the
model has to choose on its own how to
break down a problem into different
things that it can do on its phone. I
think right now humans would often do
this, but if we want language models to
do very hard things, they have to make a
plan that has subtasks that are actually
tractable or it calls in a bigger model
to do that for it. But these are things
that are the models aren't going to do
natively. Natively, they're trying to
like doing math problem solving like
that doesn't have clear abstraction on
like this task I can do and with this
additional tool and all these things. So
this is this is a new thing that we're
going to have to add. So to kind of
summarize, it's like we have skills, we
have researcher calibration, I'll
highlight some of it, but like planning
is a new frontier where people are
talking about it and we really need to
think about like how we will actually
put this into the
models. So to just put this up on the
slide, what we call reinforce learning
with verifiable rewards looks very
simple. I think a lot of RL and language
models, especially before you get into
this multi-turn setting, has been you
take prompts, the agent creates a
completion to the prompt and then you
score the completions and with those
scored completions, you can update the
weights to the model. It's been single
turn. It's been very simple. We I'll
have to update this diagram for
multi-turn and tools and it makes it a
little bit more complex, but the core of
it is just a language model generates
completions and gets feedback on
it. And it's good to just take time to
look at these skills. These are a
collection of evals and we can look at
like where GBT40 was and these were the
hardest evals that have existed and look
were called like the frontier of AI. And
if we look at the 01 improvements and
the like 03 improvements in quick
succession, these are really incredible
eval gains that are mostly just from
adding this new type of training in. And
the core of this argument is that we
need to do something similar if we want
planning to work. So I would say that a
lot of the planning tasks look mostly
like humanity's last exam and Amy um
just after adding this reasoning skill
and we need to figure out what other
types of things these models are going
to be able to
do. So it's like this list of reasoning
abilities that these kind of like
low-level skills is going to continue to
go up. I think the most recent one if
you look at recent DeepSseek models or
recent Quen models is really this tool
use being added in and I that's going to
build more models like 03. So using 03
just feels very different because it is
this kind of combination of tool use
with reasoning and it's obviously good
at math and code. But I think these kind
of low-level skills that we expect from
reasoning training are we're going to
keep getting more of them as we figure
out what is useful. So I think an
abstraction for the kind of agenticness
on top of tool use is going to be very
nice but it's hard to measure and people
mostly say that claude is the best at
that but it's not yet super established
on how we measure it or communicate it
across different
models. And then this is where I get
into the fun interesting things. I think
it's hard for us because calibration is
passed to the user which is we have all
sorts of things like model selectors if
you're a chatbt user. Um, Claude has
reasoning on off with this extended
thinking and Gemini has something
similar and there's these reasoning
effort selectors in the API and this is
really rough on a user side of things
and making it so the model knows this
will just really make it so it's easier
to find the right model for the job and
just kind of um you're kind of over
spent tokens for no reason will go down
a lot. it's kind of obvious to want it
and then it'll just it becomes a bigger
problem the longer we don't have this
some examples from when overthinking was
kind of identified as a problem. It's
like the um left half of this is you can
ask a language model like what is 2 plus
three and you can see these reasoning
models use hundreds to a thousand tokens
or something that could realistically be
like one token as an output and then on
the right is a kind of comparison of
sequence lengths from a standard like
non RL trained instruction model versus
the QWQ thinking model and you really
can gain this like 10 to 100x in token
spend when you ship to a reasoning model
and if you do that in a way that is
wasteful is just going to really load
your infrastructure and cost and as a
user I don't want to wait minutes for an
easy question and I don't want to have
to switch models or providers to deal
with
that. So I think one of the things that
once we start have this calibration is
I'm is this kind of strategy idea and on
the right I to I went to the um I think
it's epoch AI website took a qu one of
their example questions from Frontier
Math and I was like does this new deep
sea gar 0528 model like does it do any
semblance of planning when it starts and
you ask it a math problem it just like
okay the first thing I'm going to do is
I I need to construct a polomial is like
it just goes right in and it doesn't do
anything like trying to sketch the
problem before it thinks and this is
going to probably output 10 to 40,000
tokens and if it's going to need to do
another 10x there is just like if that's
all in the wrong direction that's
multiple dollars of spend and a lot of
latency that's just totally useless and
most of these applications are set up to
expect a latency between 1 and 30
minutes. So it's like there there is
just a timeout they are fighting. So
either going in the wrong direction or
just thinking way too hard about a sub
problem is going to make it so the user
leaves. So um right now these models I
said they do very little planning on
their own but as we look at these
applications they're very likely
prompted to plan which is like the
beginning of deep research and cloud
code and we kind of have to make it so
that is model native rather than
something that we do
manually and then once we look at this
plan there's all these implementation
details across something like deep
research or codeex which is like how do
I manage a memory so we have cloud code
compresses its memory when fills up its
context window. We don't know if that's
the optimal way for every application.
We want to avoid repeating the same
mistakes. We talked Greg was talking
about the playing Pokemon earlier, which
is a great example of that. We want to
have tractable parts. We want to offload
thinking if we have a really challenging
part. So, I'll talk about parallel
compute a little bit later as a way to
kind of boost through harder things. And
really we want m language models to call
multiple other models in parallel. So
right now people are spinning up t-mucks
and launching cloud code in 10 windows
to do this themselves. But there's no
reason a language model can't be able to
do that. It just needs to know the right
way to approach it.
And as I've started with this idea of
kind of we need effort for or like we
need to make effort to add new um
capabilities into language models when
you when I think about this kind of
story of Qstar that became strawberry
that became 01. The reason that it was
in the news for so long and was such a
big deal is like it was a major effort
for OpenAI spending like 12 to 18 months
building these initial reasoning traces
that they could then train an initial
model on that has some of these
behaviors. So it took a lot of human
data to get things like backtracking and
verification to be reliable in their
models. And we need to go through a
similar arc with planning. But with
planning, the kind of outputs that we're
going to train on are are much more
intuitive than something like reasoning.
I think if I were to ask you to sit down
and write a 10,000 token reasoning trace
with backtracking, it's like you can't
really do this, but a lot of expert
people can write a five to 10step plan
that is very good or check the work of
Gemini or OpenAI when asked to um write
an initial plan. So I'm a lot more
optimistic on being able to hill climb
on this. And then it goes through the
same path where once you have initial
data, you can do some SFT and then the
hard question is if the RL and even
bigger tasks can reinforce these
planning
styles. On the right, I added kind of a
hypothetical, which is like we already
have thinking tokens before answer
tokens, and there's no reason we can't
apply more structure to our models to
just really make them plan out their
answer before they
think. So, um, to give a bit more depth
on this idea of skill versus planning,
if we go back to this example, I would
say that 03 is extremely skilled at
search. So being able to find a piece of
niche information that researchers in a
field know of but can't quite remember
the exact search words that is an
incredible skill. But when you try to
put this into something like deep
research, there's this lack of planning
is making it so that sometimes you get a
masterpiece and sometimes you get a dud.
And if as these models get better at
planning, it'll just be more thorough
and reliable in getting the kind of
coverage that you want. So, it's like if
it's crazy that we have models that can
do this search, but if you ask it to
recommend um some sort of electronics
purchase or something, it's really hard
to trust because it can't just know how
to pull in the right information and how
hard it should try to do all that
coverage. So, kind of summarize, these
are the four things I presented. I think
you can obviously add more to these. You
could call a mix of strategy and
abstraction. And there's like you could
call what I was
describing as like context management in
many ways, but really you just want to
have things like this so that you can
break down the training problem and
think about data acquisition or new
algorithmic methods for kind of each of
these
tasks. And I mentioned parallel compute
because I think this is an interesting
one because if you use 01 Pro, it's
still been one of the best models and
the most robust models for quite some
time. And I'm been very excited for 03
Pro, but it doesn't solve problems in
the same way as like traditional
inference time scaling where inference
time scaling just made a bunch of things
that didn't work go from zero to one
where this parallel compute is really
like it makes things more robust. It
just makes them nicer and it seems like
this kind of RL training is something
that can encourage exploration and then
if you apply more compute in parallel,
it feels something kind of exploiting
and getting a really well-crafted
answer. So there's a time when you want
that but it doesn't solve every
problem. And to kind of transition into
the end of this talk, it's like there's
been a lot of talks today saying the
things that you can do with RL. And
there's obviously a lot of talk on the
ground of um what is called continual
learning and if we're just continually
using very long horizon RL tasks to
update a model and diminish the need of
pre-training and there are a lot of data
points that were closer to that in many
ways. I think continual learning has a
big um algorithmic bottleneck where but
just like scaling up RL further is very
tractable and something that is
happening. So if people are to ask me
what I'm working on at AI2 and what I'm
thinking about this is my like rough
summary of uh what I think a research
plan looks like to train a reasoning
model without with all the in between
the line details. So step one is you
just get a lot of questions that have
verified answers across a wide variety
of domains. Um most of these will be
math and code because that's what out
what is out there. And then two, if you
look at all these recipe papers, they're
having a step where they filter the
questions based on the the difficulty
with respect to your base model. So if a
question is solved zero out of 100 times
by your base model or 100 out of 100,
you don't want questions that look like
that because you're both not only
wasting compute, but you're messing up
the gradients in your RL updates to make
them a bit noisier. And once you do
that, you just want to make a stable RL
run that'll go through all these
questions and have the numbers keep
going up. And that's the core of it is
really stable infrastructure and data.
And then you can tap into all these
research papers that tell you to do
methods like overong filtering or
different clipping or resetting the
reference model. And that'll give you a
few percentage points on the top where
really it's just data and stable
infrastructure.
And this kind of leads to the
provocation which is like what if we
rename post-training as training and if
OpenAI 01 was like 1% of compute is
post-raining relative to pre-training um
they've already said that 03 has
increased it by 10 10x so if if the
number started at 1% you're very quickly
getting to um what you may see as like
parody in compute in terms of GPU hours
between pre-training and post- training
which if you were to take anybody back a
year ago before 01 would seem pretty
unfathomable. And one of the fun data
points for this is that um the DeepSeek
V3 paper and you kind of watch Deep
Seek's transition into becoming more
serious about post-raining. Like the
original Deepseek V3 paper, they use
0.18% of compute on post- training in
GPU hours. And they said their
pre-training takes about two months. And
there was a deleted tweet from one of
their RL researchers that said the R1
training took a few weeks. So if you
make a few very strong, probably not
completely accurate assumptions that RL
was on the same whole cluster, that
would already be 10 to 20% of their
compute. I think like specific things
for DeepSeek are like, oh, their
pre-training efficiency is probably way
better than their RL code and things
like this. But scaling RL is a very real
thing. If you if you look at this, if
you look at Frontier Labs and you look
at the types of tasks that people want
to solve with these long-term plans. So,
it's good to kind of embrace what you
think these models will be able to do
and kind of break down tasks on their
own and solve some of them. So, thanks
for having me and let me know what you
think.
[Applause]
Thank you. All right. So for our final
talk of the track for the day um we are
we have the great pleasure of hearing
from uh Chris Seedy. So Chris was a
researcher at Google for a long time
became the co-founder of XAI where he
was for a couple of years and is now
working on a new startup. Um he's going
to be talking us to us today about the
path towards verified super intelligence
which I'm very curious about myself. Um
unfortunately Chris did have a last
minute conflict. Um, so he's not able to
be here in person. He will be here on
Zoom. Um, so we should see in just a
moment uh him coming up and uh be able
to see him talk. So let's welcome
[Applause]
Chris. I see people in the A corner just
looking very Okay, we're good.
I feel like we've uh all been here with
Zoom before. Um so we'll give Chris a
moment. Uh sorry, I was
just permission to Zoom.
didn't have a permission to share my
we can all empathize. I think we've this
has happened to everyone on some
meeting. Okay. Okay.
Yes, we can see it.
Sorry about
more scientist.
So
I
believe first let me give some
more years. So basically I started
doing
2011 nobody knew whe
Good
example research topic.
So, so then we learned like
2015 most excited about
But in the
meantime it's
special in some sense but still it was
taken to the
next accessible data.
And that's where we are and
thinking like two years
ago and then I think the big idea behind
that is that you have to create this
information that is the chain
of that is basically the learning from
that reinforcement learning
for you
reinforce that idea
almost. So basically the lessons that we
could draw from all these plans. The
first lesson is the first is that deep
learning works at all. Then deep
learning can
create then
learning also. So you can scale a
different time essentially. Now the
question is what is the next big trend
that we can expect to happen and that's
what I would like to talk about. But in
order to uh to guess it I I let's see
what were the limitations to each uh
each of these trends. So first we have
like you need to have labor data. So we
needed a lot of human to certain data
points and structural condition took
that effort into an extra because multip
uh what are the bottlenecks to AI self
improvement? So, so I mean it's like
it's the human generated labels, the
human generated data and now we have the
human generated tasks and human
supervision
uh and even human generated verifiable
problems. So in order to scale up
reinforcement learning you need to
generate a lot of environments. So
basically what we can say is that the
document to AI self improvement is
basically
human every every aspect of the learning
process that relies on human input is
prone to be problematic. it as either it
adds friction or there is a limited
source of data because human data is
getting less and less available that we
have
on so so what we really have to figure
out how we create open-ended self
improvement so that is a hard question
at the previous talk but Nathan was also
pointing this out that that's something
is is the future But the real question
is how do we really scale up so that it
will become uh so basically a
combination of life language model
structure
prediction and uh really super human
reasoning in almost every aspect. So how
do we get to that? So what is the way to
get to reach self-improvement? So we we
basically we have to remove these
bottlenecks. We don't want to now that
we run out of all these generative data
from the internet. Now the question is
now we are running into the problem of
of having only a very limited set of
human generative environments that we
can train on. We already ran out of
them. So people hire a lot lot of people
and it takes a lot of money and effort
to create this environment and be a task
for the AI that can learn.
So in short we can say that the AI needs
computes it wants agency it's it needs
challenges and it needs feedback
basically a verification signal that
gives a reward to the agent. So these
are the most important uh part of making
open self improvement work. So from this
basic principles we can
uh uh make some claims on what how we
can get how how we can solve these
bottlenecks. So one I think is the first
battle neck that almost everybody is
concerned nowadays is having good
environments in which the AI can run
safely. But it doesn't have to be
uh so we don't want the AI to just go
into some environment and take careful
agency and see and then corrupt your
computer or corrupt your cloud
environment. So so there is a tension
between agency and safety because if the
AI is very uh I mean get full agency
then
it is it can be dangerous but it can
create itself.
So it can basically we want any want any
environment in the in which the agent
can have absolutely free. So it can have
root access or even web access and and
we also want the agent to be able to
backtrack its decisions even if it made
it installed the wrong package for
example for a task or it created the
wrong program or it deleted an important
tool from food chain.
So in this case the agent should be able
to decide okay I want to go back and I
want to try a different path. So this is
not just important for inference time
when we execute the agent it's very it's
even more important for reinforcement
learning where you are running the agent
on a lot of problems.
So basically getting a sandboxing
environment that can can that allows you
to do a lot of branchings and undos
basically like a version control system
uh for snapshots uh is is is an absolute
must for a sophisticated
data. So the other important bottleneck
that we have seen is the lack of good
verifiable problems. So what I think the
next generation of AI will need to be
able to create its own curriculum of
problems. So you don't you don't want
the agent to to be given a set of
problems to train on. We should just
give some high level uh task of let's do
learn to be a good RS programmer for
example and then it should should go to
the internet and find all the important
uh so so improve its own skills without
uh having a set curriculum.
So, and we want the agent to be have
this ongoing continuous learning as
Nathan also mentioned. I think that's
very important and that that's the
future of AI that is being able to to do
the learning while it's actually
executing useful task as well. So, I
think that will be very important in the
next few years.
But most importantly and that's why I
put such
a emphasis on verification and verified
AI is that we need need a verifier very
strong verifiers and validator. So what
do I mean by that? So verifier is uh is
an agent that uh verifies the
correctness of a solution. But validator
is uh is also it could be the same
agent. It validates that the problem
formulation was interpreted correctly so
that the human input was correctly
interpreted.
So the first one actually could be done
with also external verifier. You don't
even need models for that. It can be an
agent that just uses some some kind of
verifier that for example runs a code or
or cause a proof checker. Uh so doing
some formal verification etc. But
validator should be uh model based
because that checks the alignment
between the human and the machine and
that's very
important. So and then we think that the
next generation of AI will be able to
produce safe and independently
verifiable artifacts. So we we want
code that is actually comes with its own
uh guarantees of correctness and that's
very important. And so today computer
chips already always verified
extensively and we don't do that with
software but I think in the in the next
five years uh the AIdriven uh cyber
attacks will be so severe that nobody
will ever try to run any software that
is not fully formally verified at least
in some for some uh
purposes. So and while the AI produces
verifiable artifacts. So basically the
it shouldn't just produce code, it
should produce code and proof of
correctness of that code as
well. And at the same time it will have
to improve its own alignment. So it
should should get better and better at
respecting and guessing the human's
intent as well.
So that's what basically I uh believe is
this self-supervised reinforcement
learning or what I call is verified
super intelligence. Uh and they sound
different but actually they are the same
thing. I think this is possible. So we
can we can get to self-supervised
reinforcement learning which will be
such such a big leap as from uh uh as
from supervised learning uh uh just like
training on labor data to going to
training on the whole internet. So
uh so this will be this will be in my
opinion the next big step with an agent
that can create its own problems. It
acts as its own
verifier and it will bootstrap itself
from all of internet or whatever part of
internet you want but it will be
autonomously finding its own problems.
It creates its own problems and solves
them. So we don't really need to give it
any more
problems. So basically how do we get to
this uh infinite supply of problems? So
that's the hard question and what we
think is the key to that is
verification. So we basically we need
uh what I'm suggesting is that we mine
the internet for actual problems uh but
turn them into formally verifiable
artifacts and formally verified meaning
that the correctness of the artifacts
can be checked. of for example code or
mathematical problems you can use a C
theorem prover for example to check the
logical correctness of things which is
definitely hard but not impossible it's
getting more and more possible and at
the same time it uses these signals to
create rewards for alignment so so when
for example an artifact it it gets from
the internet for example code this uh or
that problem and then it uh tries to
code it up and read some solution it can
like okay was uh does this solution
really align uh uh with with what was
meant here and I think this can be
bootstrapped with various uh reward
signals coming from cycle consistency uh
ideas. So these can be in my opinion
also trained and enforced. So
correctness and alignment has this
interplay between them. So because if
the if the output is not correct then it
cannot be properly
aligned. So and what I really believe is
that we can do most of the correctness
checking model free so that it doesn't
require necessarily a model that uh uh
that checks the output. It's more like a
a well definfined verifiable artifact
like in a NP problem that you have also
always a
verifier alignment must be model based
unfortunately
uh but uh I think the interplay between
the two allows us to improve on both
fronts and I think verification should
be always agentic. So we we want to move
away from having like a model train to
verify something. We the verifier also
should have tool access and and uh being
able to go into an environment where the
artifact was produced for example a
software system and then test that
software system in all kinds of
scenarios for example.
So basically this is a very rough sketch
of how I believe this uh uh this uh road
map to uh to work out is that we have
like a generator agent and a validator a
verifier agent. The same agent the
agents can share the same model uh but
they
all connected to something like the
morph cloud that we are working on. This
uh cloud allows you to branch a lot of
sandboxes, try various versions, roll
back etc. And then the
generator provides solutions to the
verifier and the verifier and validator
uh give back reward signals to train the
generator. So, and they they both give
each other basically kind of reward
signals and the potential tasks are
taken from the web and they also should
be agentically generated or crawled by
the agent itself not by some human that
uh selects them or creates them. So,
they should be automatically
created. And then the important part is
that we
want want the agent to be able to
produce artifacts that are verified
completely independently. So you don't
want to trust the AI, you want to verify
it. So these are the main properties
that I really want is that we we have
first class verification in this system.
We have first class alignment in this
system. So these are grounding principle
of how to build a system and they should
be from the ground up provided. So they
should be go of the agent that we are
reinforcing the whole time and we want
to get modify verifiable artifact so
that we can trust the AI without any AI
intervention. These proofs might be uh
might be uh created by a lot of AI
computations but they should be just
verifiable and then uh This will give us
infinite supply of hard problems. So
what are the application domains of this
uh verified super intelligence? So uh I
think uh it will be mandatory for AI
software engineers. So if you make one
bug in 100 lines of code that's today
okay roughly it's still you you get some
value out of your model. But if you want
to create like a agency that the model
uh can work for hours on a complicated
software project completely autonomously
then uh one bug every 100 lines is
impossible then you will never get
anything done. So therefore I think uh
we need uh to have ongoing verification
all the time in the process. Another
important uh problem is cyber security.
We want our systems to be hacking uh
proof. So we don't want external AIS to
hack in our systems which will be more
and more happening in the next few years
also engineering uh so engineering
requires a lot of mathematics and
reasoning and sciences of course uh also
we require this. So we believe that
mathematics will also be properly
verified in the next few years uh mostly
by AI agents.
So, so the goal here is that verified
super intelligence. We want a
trustlessly aligned AI. This means that
we don't just want to trust the AI. We
want to actually check it. And this
check should be uh
possible. So that's
uh
uh Okay.
Sorry. Yeah. So that concludes my talk.
So I'm just
uh
Yeah. So, I'm happy to take questions.
Thank you so much, Chris. We appreciate
you taking the time. All right. Well,
this concludes our um our track. Uh this
concludes the the breakout sessions for
today. Um yes. Um I think uh yeah, I
don't think we'll be able to do
questions because we are a little bit
over time unfortunately. Um at five
o'clock or sorry at 4 o'clock. Yes, at
four o'clock there's going to be
keynotes on the main stage. Um, so look
forward to seeing all of you there and
hope you have a good rest of your
conference.