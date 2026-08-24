How I deleted 95% of my agent skills and got better results - Nick Nisi, WorkOS

[music]
>> All right, good morning everyone.
Uh welcome to my talk building AI
systems that ship. I'm Nick Nisi and I
work at WorkOS. We've got a booth
downstairs. Come check us out and talk
to us. We'd be happy to chat.
Uh but let me start that over. Hi, I'm
the bottle neck. Uh
I'm a DX engineer at WorkOS and I work
on 20 plus repos across eight different
languages. Uh it's all of our SDKs and
open source things that we have. And the
it's like AuthKit Next.js, AuthKit
React,
WorkOS Node, WorkOS Kotlin, WorkOS Ruby,
PHP,
everywhere. So, there's a lot to do
across a lot of different things.
And I'm really good at working on those.
And I've gotten really good over the
last eight months
working with those via agents. So, I
haven't written a line of code myself in
probably eight months. Uh I've gotten
really good at just scaling that with
agents and then reviewing what they do
and then instructing them and getting
the work done faster and better while
still maintaining good quality.
Uh but there was a big problem doing
that uh with one agent at a time across
all of these repos. I'm just constantly
context switching over and over and
over. Uh and it just gets harder and
harder
uh and
that's okay, but the problem is that for
every one of those there's like this
little bit of setup time that I'm doing
each time, which is like giving it 10
minutes of my time to like set up and
establish the problem. Let's look at
this GitHub issue. Let's look at this
linear ticket. Let's take a look at this
Slack thread and figure out what's going
on and see if we can reproduce the issue
and then uh go. So, that was a lot of my
time just spent
dealing with the agent, getting it
basically the context that I already
have, and then getting it to work on it
from there.
Now, on the other side, I'm also working
on products that
uh we want to build for agents because
while I said I'm a developer experience
engineer, the developer is still the
most important uh in in my job, but
increasingly the pipeline to get to that
developer is through agents. And so, I
see the agentic experience as being
equally as important because that's how
we're going to get in front of the
developers.
So, there's two different ways I needed
to go AI native and two different
directions for that.
So, on the internal side building that,
I started building this project called
case. Uh this is a harness. If you've
read Ryan the Populous Harness
Engineering, it's that. Uh just kind of
took those ideas and started building
them.
Uh basically I give it a GitHub issue, a
PR,
uh a Slack thread, a linear ticket,
anything, and I could just point it at
it and it could figure out the context
that it needs and go. And then it
wouldn't stop until it has a PR with
evidence that it actually did what I
asked it to or what the problem was or
what fixed what the issue was.
Uh but it most importantly it had to
provide that evidence.
And it this originally started as a
Claude skill because uh why not? I
thought Claude could do could do
anything. And it was working really
well, but as it got more complex, uh the
context drop became very real. It would
just start forgetting things or skipping
over tasks. And I would ask Claude, "Why
did you do that?" It's like, "Oh yeah,
you told me to do that. I decided not
to."
Not great. So, uh I rebuilt it on top of
Pi and using a a TypeScript state
machine to facilitate going through and
and stepping through these agents. So,
it has five different agents in it, an
implementer, a verifier, a reviewer, a
closer, and a retro agent. And those are
important, but they're not the most
important thing. The most important
piece of case is the gates in between
that. And that's what the the um
uh state machine really enforces is the
checks in between everything. So, when
we implement something, we can't move on
to the reviewer until the verifier
verifies it. And once the the reviewer
reviews it, if there's any issues, it
has to send it back to the implementer
to do those.
Uh and once all of that's done, the
closer can work. But the closer can't
work until it thinks that it's done. And
the closer is there to provide evidence.
And then the retrospective is there to
analyze the entire performance. It looks
at the logs of everything that case did
and says, "What could I've done better?"
And then it updates its own memory
system to ensure that the next time it
can skip some steps if it if it went in
circles for a little bit.
Uh and it can give itself some hints on
where to go so that the next time it
works on that project, it doesn't hit
the same roadblocks.
Uh
So, the next agent doesn't really
matter. Um proving that the work
matters. Proving that what happened in
each of these states is what matters.
And that word there proving is the most
important piece of that because the
agents, they would just lie to me all
the time.
Uh I would ask it, "Hey, you need to run
the tests." And this was more when it
was a skill and it would I would be
like, "Hey, you need to run these tests
and make sure that the tests actually
pass." And one way to do that uh was I
just had it check for a dot case tested
file. And if that that file existed,
great. It ran the tests, perfect. Well,
it figured it out pretty fast. Claude
would just touch that file and be like,
"Yep, I ran the tests."
Such a junior engineer, I swear.
Um so, I had to figure out a way to
prove that. So, one way to do that was
just to uh actually take the test output
and SHA-256 that and save that into the
case tested file and then verify
cryptographically, yes, you actually ran
the tests. And really like the the main
piece there is that I just made it
easier to just do the work that I wanted
it to do rather than lie about it.
And that's really the main thing. Um it
stopped lying not because I asked it
very nicely, I made it prove it that it
was going to actually do the work each
time.
Now, on that was on the inward side. On
the outward side with the WorkOS CLI, uh
this is a tool that our customers use.
And it can do lots of things, but its
kind of headlining feature is that it
can install AuthKit for you. One of the
biggest pain points when we're trying to
you know, ask someone to to look at our
product or they're interested in it is,
"Oh, I'd have to go spend some time and
get it set up and read the docs and all
of that." Not anymore. With WorkOS
install, it just goes and figures out
what project you're in. "Oh, you're in a
Next.js project. You're in a TanStack
project. You're in a Ruby project. I'll
figure that out. Oh, you've already got
Auth0 set up? I can easily remove that
and put in AuthKit and we'll be good."
And it does it in less than 5 minutes.
If you don't have a WorkOS account, it
will provision one for you that you can
go claim later. So, there is zero
friction to getting it set up. And
that's a really important piece of being
uh agentically forward in our
public-facing persona and how we how our
customers use us and how
uh they perceive us.
But there's problems with that, too. As
I was building it, uh it would be overly
confident just like these models always
are and say, "Yep, I did that." One of
the the cases of that was I was trying
to
uh install into a TanStack start
project. TanStack start's relatively
new. It's still in RC and uh it's
changing constantly. Well, case uh
sorry, the CLI made some changes. It
installed it and it made some changes to
a file called start.ts. That file is
kind of implicit has it has an implicit
contract with TanStack. It's uh got a it
has to export certain things. And we
kind of messed that up. The code looked
right to me. It looked right to uh
Claude, but it did not look right to
TanStack start. So, boom, it failed.
Uh and so, we had to figure out a way to
tell it when it failed or make it
understand that. And I thought, "Oh,
well, we just need some skills, right?"
Skills are the way to do that.
So, I started teaching it, making these
skills. And of course, I thought, "You
know what? We have these great docs. I
can just take our docs and generate some
skills." So, I generated over 10,000
lines of skills uh that were all based
on our docs. And I did it in this really
elaborate way where it would like take
sections of our docs and make skills
about them. And then it would like uh
put a little comment in the skill with
the cryptographic hash of the current
state of that section of the docs. And
it basically if I ran it again and that
uh that SHA didn't change, don't update
the skill. So, it wasn't just constantly
updating all the time. I thought I was
being really clever and awesome. Uh and
I generated this huge thing. And I even
made some evals for it. I started making
those and it would take me 68 minutes to
run those scenarios. It was just crazy.
Uh and it would fail over and over and
it would have these retries and and get
there eventually, but it was like a lot
of work, a lot of tokens.
Um so, I had more tokens. I thought more
tokens, great. That's way better. Uh but
it ended up producing worse results. And
it was really the measurement there, the
evals that were telling me, "Hey, this
isn't right." So, I rewrote it by hand.
Uh and instead of focusing on covering
comprehensively everything that we have
in our docs, I was like, "Oh, I just
have to cover some common gotchas for
everything." So, for our entire docs,
instead of having 10,000 lines of that,
I have 553 lines of gotchas. And these
are just like the most common things uh
that came up as I was running these
evals over and over and over. They ran
faster, way smaller uh in terms of token
count,
uh only took 6 minutes per run, and
uh I wasn't sending the the models on
these long goose chases by having it,
you know, go check a whole bunch of
different things. It would stay focused
on things. Uh and so, by deleting 95% of
that, the performance of it actually
went up.
And I really only knew that because I
measured it.
So, looking at that, I like had one
skill in particular that I could see.
And when I ran it with that skill and I
I gave it a task and said, "Hey, load
this skill and then do this task." It
got it correct 77% of the time. But if I
asked it to do the same task without
loading the skill, it was correct 97% of
the time. So, I was actively making it
worse, and I only knew about that
because I was measuring it. And so,
evals are super important when you're
working with this non-deterministic
code.
Uh Claude makes it really easy now. They
have like evals a Claude a Claude skill
skill that will do evals for you. Uh and
it'll even set up it'll create like an
HTML output of that and show you like
side by side. I ran a bunch like this
and a bunch without the skill, and
here's the results. Use that, measure,
and see where you're actually falling
apart because I thought I was making
things a lot better by having a whole
bunch of code.
I just needed to trust that the the
model already knew how to code, and I
just had to kind of gently nudge it in
the right direction in some cases.
So, what did I actually learn from both
of these systems?
Uh basically, you want to enforce
things, don't instruct. Uh
the model can lie about it. It can
decide not to pull thing to not to do
certain things because either it forgot
about it, uh it got distracted with
other things, uh but if you actually set
up a pipeline where it's has to enforce
itself and prove to you that it did what
you asked it to do, then you're going to
have a better time for sure. And
oftentimes with a lot less tokens.
Uh you want to guide the model, don't
prescribe it. So, don't just give it
like, "Hey, here's a summary of all of
my docs with like a whole bunch of
information." You want to just prescribe
it, "Hey, when you're working in
uh Next.js
uh and you're in the proxy, you want to
do this. If you're not in the proxy, you
can't call redirects." That's a really
big one that constantly comes up over
and over and over. Uh it would just put
those everywhere. And so, guide it,
but uh don't prescribe to it.
And then, of course, measure, don't
pursue uh don't assume that it works. Uh
just trust uh that it has a
Trust is a pass rate, uh hash, a delta
score, anything like that, so that you
can prove to it. One of the things that
Case does at the end uh as part of its
reviewer uh script, I still read all of
the code that it generates uh to make
sure that it's actually like code that I
would be proud of shipping,
but I'm not even going to waste my time
looking at that code until it's proved
to me that it did whatever I asked in a
non-code way. And so, the main way for
that is like if it's working on a UI
bug, I want it to use the Playwright CLI
and record a video of itself doing
something before and then doing it after
the fix and showing me, "Hey, now it's
fixed. It's working." And if it can
prove that to me in those videos that it
attaches to the PR, I'm way more
inclined to look at that PR and say,
"Yeah, okay, we can just, you know, fix
some of the the weird things that it
did, but it did do the work correctly."
And I'm way more incentivized to waste
my time and become that bottleneck to
getting through that.
If not, uh I just ask it to do it again.
So, every failure uh became data for the
next run. This is another important
thing is when things failed, and this is
this goes back to that harness
engineering thing like
uh if you are working on a harness and
it is making mistakes, don't go fix the
mistakes that it made, fix the harness
so that it can fix the mistakes.
Um in Ryan Leuppolo, I don't I don't I
didn't see his talk uh here, but uh I
saw a a talk on Zoom, and he talked
about how their team would never work on
the code itself. They would only work on
the harness to fix the code itself. And
I really took that to heart with Case,
so I only work on Case itself to make
sure that it's doing what I want. Uh and
if it fails, then we do it again, and
that becomes part of its memory. And
that's the other big piece of it is that
as Case is running, the final piece of
it is this retrospective agent. And all
it does is it looks at what it did, and
it goes in and looks at like the the
Claude and Codex transcripts uh like the
JSONL files, and it pulls out
information. Hey, was I running a lot of
tools at the same time? Did I run the
same tool request three times in a row
without any changes to anything? Was I
like getting in a doom loop there like
trying to identify those things and see
what it can do better. And then,
internally, Case keeps a whole bunch of
memory files as markdown files, and it
just understands like, "Okay, in I have
a general memory file. If I'm working in
Next.js, I have a Next.js memory file, a
TanStack Start memory file, etc." And it
figures out where to put information
about that. So that it won't make a
mistake and break the start.ts in
TanStack Start again. It knows about
that because it put it into its memory.
And one thing that I want to add is like
that auto dream thing that Claude is now
doing where it can kind of prune its
memory over time. That'll be the next
piece that I add to it. Um but making
sure that it can learn from its
mistakes, and it can do it
automatically, and then you can also
provide feedback. Have a way for you to
provide the feedback to it as well. And
then, the next time it you give it a
task, it's just going to be that much
better. And eventually, you're just
going to start trusting it more and more
and more.
And if you're making your product work
for agents, uh there's a couple of
important things as well.
Uh figure out what the agents get
reliably wrong about your product and
focus on that. Don't focus on the
product as a whole because it probably
knows a lot about it a lot more than you
think about it.
You write down write down write down
those gotchas, uh create skills around
those. Uh you can create tutorials, too,
uh but don't rely on that. The models
can read the tutorials and and learn
from that.
Um but just remember that the models
know how to code. They just need to know
the intricacies of your product and
where the landmines are in that.
And of course, measure what you're
shipping.
Um you want to understand where the
model is failing for your particular
product and make sure that you focus on
that. And the only way that you can do
that is through things like evals.
Otherwise, you just might be adding
noise and sending the model on wild
goose chases.
Uh and think about the consumers in the
way that you think about uh developers.
Like think about those agents uh in the
same way that you think about
developers. What do they want to know?
How can I make things better for them?
Do I have a lot of JavaScript loading on
my page after the fact that's adding a
whole bunch of context that maybe is not
getting added when whatever uh process
they use to go pull
uh and summarize the information on your
page? Uh is that getting lost to them?
Make sure that it's not.
Um and if you're making agents work for
you like in uh the case of Case, um
you replace your trust with evidence.
Never trust it. Always make it prove to
you that it did something.
Um if it ran the test, make it prove it.
If it
uh fixed a UI bug,
it has to show it to you. Uh otherwise,
don't waste your time on it.
Uh and enforce that with with code uh
not prompts. So, this is why I I
switched it to Pi and used a state
machine to force it because I have full
control over that state machine, and
it's outside of the
Pi or Claude deciding, "Uh should I do
this or not?" No, you have to do it. I
enforce that through that loop.
And then, every failure becomes uh a
system bug. Uh each time it messes up on
something, that's a bug in the harness.
Go fix the harness.
So, really um
the agent just uh
you you want to build the environment
that the agent that you can work with
the agent in
uh and focus on that.
Um the practices that we have haven't
really changed. Uh our job hasn't really
changed. Uh we've just kind of
abstracted it a little bit. Uh your job
was never really about writing code. It
was always about building these systems,
and now we just have a better
abstraction to understand that. Uh so,
take that into account and um
and go forward from there.
Uh so, that's the talk. Uh thank you,
and I'd be happy to answer any questions
with the time I have left.
>> [applause]
[music]
[music]