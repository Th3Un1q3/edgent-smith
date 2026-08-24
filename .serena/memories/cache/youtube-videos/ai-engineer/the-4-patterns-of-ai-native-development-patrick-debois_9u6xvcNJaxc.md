Today we're going to talk about the four
patterns of AI native development and
how AI has impacted our development
workflow over this period of genai
craziness. uh technology has advanced
from a simple LLM to kind of rag and
indexing our code bases adding more kind
of functions that would be MCP and all
the way up to agents and we see the
first hint of teams of agents kind of
emerging and kind of all that technology
is really great uh as
such and we've seen this explosion
before uh with cloud native like a new
way new way of working and right now it
still feels maybe a little bit that
we're sprinkling AI I on top of this and
but what what does it mean to be AI
native? What's the new kind of set of
practices that we're heading for now
with any new technology, right? It
impacts our tasks and a tasks that we do
um is different. It's not just about
coding and typing. Uh we we kind of work
together, we collaborate and we do a set
of different things. And so what it
happens is that like part of our job or
part of the tasks actually either get
replaced, enhanced or there come new
tasks. And that's kind of like that AI
native thing that we're looking for.
What is happening to the way we are
working right
now. I kind of distilled this into four
patterns. Uh and we'll talk about each
of them uh in this talk. um you know
with the center being we're developer
but we're moving into different areas uh
and that's the pattern shifts that we
see. Who am I? Um I'm an independent
industry adviser and I kind of am known
for my work around DevOps and dev sec
ops which is a lot of automation and
that fits right in with the integration
with genai and that's why I love talking
about like software engineering with AI
and I also help kind of the AI native
dev community uh to curate content and
to get the stories out much like this
event. Now the first pattern is from
producer to manager and it is when we
are used to being the producers of the
code and all of a sudden we have agents
that are producing the code. So we need
to manage those agents and that's the
first pattern shift that we see from
producer to manager.
it is already very visible in a way that
like the eye is generating the code and
while we spend less time in the coding
the reviewing time goes up and we didn't
do the kind of thinking work anymore so
now we have to do the thinking work in
the review so our cognitive load is
going up so that is one of the things
that is very visible in a lot of places
where AI is added to their
workflow
now we try to reduce the cognitive load
code by coming up with new ways of
reviewing uh the code that was
generated. Not just the diff view, red
green, it's a little bit clunky. The
chat view is very verbose. But on the
right side, you see that the review kind
of strips whatever we need um to review
the code uh into uh almost like a
summary and then we kind of say yes no.
So that is the what matters you uh and
it's one way of dealing with becoming
that manager at a glance. So you can say
yes no this is good code. Now as we're
doing more kind of uh multiple files
reviewing we can do this step by step.
So breaking down and kind of uh making
sure there is a flow uh how we review is
another way of kind of dealing with the
managing of the
code and why should we restrict oursel
just to be reviewing text. Um there this
is an example of creating a diagram of
what has changed a lot easier to review.
um and a lot easier to spot kind of uh
any errors any impact on
that. And this brings uh me to the uh
the concept of a moldable development
environment. We expect kind of the
editors to adapt themselves to the code
review at hand to whatever domain
whatever kind of specifics that we need
to review. So that is maybe a trend that
the idees will end up with uh and not
just end us with an endless stream of
texts and that also helps reduce the
cognitive
load. Now why we even bother to
reviewing um Adar was one of the first
who said like let's autocommit and if
you don't like it you can review because
now we still had the manual uh kind of
step of saying yes to commit. Uh this
flips the chart. Now it uses some
heristics to say I I kind of accept the
risk or the impact is low but obviously
it is an interesting kind of uh
evolution in autoac accepting those
commits. Now auto accepting um also what
we saw emerge is the longer running
agents there's been checkpoints because
we don't want to generate the whole kind
of like train of thought uh and kind of
the generation we can jump in from a
certain point uh and regenerate from
there. So kind of that is also helping
us not having to review uh the whole
kind of um iteration over and over
again. And we do want to set constraints
like AI you cannot touch this much like
a manager sets the rules you can do this
you cannot do that. Um we can say lock
the file and we can also say what
permissions the agents have. So similar
to setting um kind of good uh guard
rails for what the AI can
do. we start worrying a little bit more
on the cost as this is longer running.
It is not just about that one prompt. Uh
it is about like that long running
prompt. So how long did it take? Well,
in this case almost $10. So we want to
keep an eye on the cost of whatever uh
TS is doing. Again, this is us managing
a team of agents and not just doing the
work. So this was the first kind of
pattern. Uh we manage whatever code is
being uh produced. Now if we take a step
back, we want to also think about like
what do we actually want the agents to
build and this is pattern two. We are uh
increasingly going from caring less
about the actual implementation to
specifying the intent to the agents.
This is what we want. Figure it out like
run with
it. The first one uh that I kind of saw
it was a simple markdown file as a
specification file that you added to the
prompt. This was a very simplistic way
of kind of adding specifications instead
of us having to rewrite over and over
again things in the prompt and this
really helped to kind of build that
shared functionality whether that is
functional or more technical as a
specification and you know once we have
the things that we want to build um AI
can help us build a plan uh this was a
GitHub kind of adding this task oriented
uh and translating whatever we wanted to
do uh step by step. Um and that brought
us to all more like intentbased coding.
So it's less about the chat and the text
completion but it's more about like we
define the tasks it becomes kind of like
the specification it builds a plan and
then it does the code. Uh that is
definitely uh a new kind of uh direction
uh the tools are taking and then the
whole tool could be specification
centric. We don't see the code maybe too
much anymore. We specify kind of
functional requirements, technical
requirements, security requirements and
like the whole workflow is around
specifications. And then if you go a
step further, why kind of still see
whatever goes on in that like um coding
um process and you start just having
managing the process as a program manner
as such.
So this was kind of like specifying
intent and before we had specifying
being a manager uh and watching it do
and uh work out that intent. But this
pattern number three is that we how do
you find uh find what is the right
intent that we want to build. So we want
to discover ideas we want to discover uh
the and work the problem as such and
that's pattern number three from
delivery. So we care less about it going
to production because we have pipelines
and that goes out. We have the manager,
we have the specifications to us
discovering what we want to
build and yes okay this is just uh
designing and making much faster to
design kind of um prototypes. That's one
way of kind of exploring like oh it
needs to be like this needs to be like
that. Um we all know kind of like f
coding uh building prototypes is a lot
faster right now. So we can kind of do
this um with a tool like Lavable or Bolt
or any of the other tools. Um what that
brings is also it can build multiple
iterations and multiple versions. So we
can choose the best one. um like uh that
really helps us to discover what we
really want and it helps us to suggest
things that maybe we didn't think about
uh
yet. And then that kind of whole design
to going to code and kind of like doing
design again and then modifying the
code. Uh that's that's a whole process
of that is being refined to kind of that
discovery process and exploration. And
this is a great example of like we all
think about vibe coding that it needs to
be done for prototyping and discovering
ideas but it could also be done by the
customer like imagine they could vibe
code the interface that they want on top
of your product. Um similar to almost
like an AB testing on steroids they can
adapt what they need and how they need
it. And that's usually like one of those
friction points uh of getting the the
perfect product.
Now we explored everything we wanted to
build. Then we wrote the specification
and then we managed when it was
generating the code. Uh the one step
that even goes
uh kind of like after that is that
whatever we learned in that process,
whatever content we produce, we want to
turn into knowledge because that's kind
of like the final play is us capturing
all the knowledge, not having to do the
same problems over and over again.
Now it doesn't only have to be code uh
what we learn on the process. It could
also be production issues. Uh so we
learn whatever is going on in production
and we bring that to the code. That's
one way of learning. We can also learn
from incident response like what failed,
what we shouldn't do like new
guidelines, new technology that we we
want to improve on. Um, similar to
writing an incident response code and
taking that as
knowledge, we can also turn whatever
code we have into lessons like reducing
the onboarding time of a new person uh
or a person leaving uh all valuable
things. There's a lot of knowledge lost
usually. So helping uh AI helping us
there is very useful um in that process.
And then one thing you might have seen
over the years is that like somebody
tried a feature, it gets dismissed, it
got tried again. So maybe we can keep
actually track of whatever feature in
almost like a feature memory. And we're
not doing this over over again. And we
keep track of whatever decision that was
made, which is currently a little bit
more of a throwaway kind of things that
ends up in in any of the the tickets or
the architecture diagrams. But not right
now it keeps that as knowledge um on
board and then when we actually do this
more in the flow we we chat we we code
and all of a sudden the agent says I
think this is important let's save this
as knowledge we kind of get a very
beneficial loop I both for actually the
the human and both for the eye to kind
of learn at the same time and keeping
that like
knowledge and that knowledge then can
then be used to help others with
questions uh and to also improve
actually the coding uh of the solution.
So this is in a nutshell where the four
AI native dev patterns. You see the
center was the developer. We moved a
little bit to the uh land of operations
uh by becoming a uh instead of a
producer a manager. We moved uh to more
of the QA and the architects uh by
moving towards the intent. We did more
discovery like a product owner and we
turned data into knowledge uh similar to
our data engineers. Now in essence this
is also what good senior developers do.
They do more than just the code and it
also shows that AI is beyond kind of
just us helping to do faster typing as
such. If you want to learn more about
like the landscape of all the tools I
also curate the landscape a nativedev.io
IO we roughly have about 300 tools now
in our landscape um for you to explore.
Uh obviously there's a lot of tools um
you can also subscribe to the news AI
native dev um and um anything that like
we really focus on anything that is at
the intersection of coding software
engineering and AI which makes us a
little bit unique in that space. Thank
you very much. If you're enjoying this
talk, um, send me a message on LinkedIn.
I will also forward you the slides. Uh,
or you can kind of subscribe to my
YouTube channel. Have fun, um, exploring
all these kind of new ways of working
and I hope to be back for more. Thank
you.