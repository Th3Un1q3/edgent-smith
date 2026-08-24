[Music]
uh so my name is biang uh I'm the CTO
and co-founder of a company called
Source graph we build Dev tools for uh
big messy code bases yeah and I'm Bruno
Bruno pasos and I lead uh the product
side of developer experience at
booking.com
and um yeah over the past year I've been
overseeing the um the Gen Innovation
side of booking as well cool and today
we're here to talk about uh how we're
partnering to build software development
agents uh that automate a bunch of toil
inside booking that are actually having
real Roi and
impact so how many people have heard
this before you know you're the you're
working inside a large company the CEO
comes in and says like hey we need to
adopt AI
uh and then folks are like okay uh what
does that mean you know how do we
measure it you know maybe like fomo
purchase co-pilot or something like that
uh and then six months later uh someone
else maybe the CFO is asking you hey so
what's the ROI of of that AI tool we
just adopted or you know what's the
measurable impact of the agents that
that we're building um this is a
question that I think a lot of people
aren't quite sure how to answer right
now but Bruno and booking have been sort
of on the Leading Edge of answering this
question uh and very ProActive at uh
acquiring and building the best tools
and also following through to
demonstrate uh how they're actually
impacting their
org it's very kind of you to say we are
we are leading this I think we are we
are right at the beginning and uh I feel
couldn't be couldn't feel further from
from actually the Forefront of it uh but
let me let me start by talking a little
bit about booking um I am sure uh the
most of you would have heard about this
company uh our goal is to make easier
for everyone to experience the world and
my team's goal is to make sure that our
developers have their path cleared so
that they can do their best work now are
we close to that in some parts of the
company yes other parts we couldn't be
uh farther away from it to get to set a
little bit of context uh we are one of
the largest uh online travel agencies in
the planet um and we serve about 1.5
million room uh nights uh um with more
than 3,000 Developers uh can you raise
your hands uh who work in a company that
has more than a thousand developers
quick show of hands good number of
people okay uh on the more on the on the
dev side or on the technical side um we
serve over 250 merge requests uh at a
given year uh with 2.5 million CI jobs
running at a given uh year as well and
we are extremely data driven um our
company has gotten to where it got to
over
experimentation and being obsessed about
data and the reason I'm going into this
is because as we experiment and in the
form of primarily AB tests we start
adding those experiments and and feature
Flags into the code base and as we push
forward to bring new features to our
users uh most likely those experiment
Flags or dead code will stay in the code
base and now fast forward decades our
codebase became extremely
bloated uh fun fact I was uh my kids
were looking at me uh editing this slide
and they said what are feature flags and
I said well um you know they stained the
code Bay and they sto polluting the code
Baye and they were like like code farts
and I'm like now you're going into code
smells is a different topic but let's uh
let's move forward um and so as the the
code base starts to blow up and become
bigger and bigger cycle times also
become uh larger and longer and they the
time that developers spend to debug and
to work on that code base just becomes
over 90% toil right who here is familiar
with
this that's even more hands than than
than than a thousand developers and so
we survey our developers at least a
quarter uh on how they're feeling how
they're how they're they're feeling
about working on that particular code
base and it's it just becomes harder and
harder for them to to do anything and so
we had to do something about it so I've
seen the best developer minds of my
generation destroyed by decade long dead
feature flag
migrations it's
crazy Claud Shannon actually say that
or but I mean seriously though like
they're probably like Geniuses out there
like I was talking to someone from PWC
the other night and describe the system
that they're building to like update uh
all all the kind of like Legacy code in
their system and it was amazing like the
guy was really smart really brilliant uh
really like interesting Tech but
wouldn't it be great if you know those
sorts of Minds were unlocked to actually
work on like you know new features and
thinking about like user problems rather
than all this kind of like Legacy craft
and so in a nutshell that's why Source
graph exists uh as a company so our
mission is to make building software at
scale tractable uh and so you might be
familiar with a couple of the the
products and tools we built uh along the
years uh code search it's kind of like a
Google for your code allows any human
developer to find in and and build a
working understanding what's going on we
have a tool for large scale refactoring
and code migrations uh you might have
heard of our AI coding assistant Cody
it's a context aware uh code generator
that's tuned to work well in large messy
code bases uh and the topic of this talk
is really about the agents that we're
building to automate toil out of the
software development life cycle so a
bunch of different products that we
built over the years the unifying theme
really really is to uh accelerate things
in the developer inter Loop augment
human creativity there and then to
automate as much of the BS out of the
outer loop as
possible all right so um as bang talked
about uh sour Graph Search just over two
years ago we started using their product
and there was a big success within our
uh our community because they were able
to search that bloated code base much
much easier and find small pieces of
context lying here in the I I totally
encourage you to have a look at this uh
particular product is awesome um and so
about a year ago uh January last year we
started experimenting with Cody and why
because Cody also has s has Source Graph
Search as context and so it became
extremely useful for us to use a uh tool
that had that context to be able to
experiment with the the Gen topic and
now we are hoping to reach the path of
uh uh building agents with Cody and and
Source Graph Search uh uh built
in all right so um if I summarize very
quickly and hopefully this illustrates
how fast things are moving uh uh forward
in January we started um with Cody we
gave everyone the ability to start using
the tool in the company so all our 3,000
developers uh um had the the opportunity
to use it some started using it some uh
uh uh used it didn't see any value with
it and then stopped using it and that
started intriguing us and so back then
right in the beginning of the year we
had the choice of one llm to use across
the entire company and some token limit
uh uh um uh limiting what we could do
with it and so the first thing that that
we started pairing with Source graph and
we appreciate the partnership on that
was to remove all the the guard rails
that we had in order to be able to
really give it a go and so Source graph
was very quickly to be able to give us
multiple llms perir developers we could
choose that and why that was important
is because we found the llms had
expertise right and so if we were going
to excavate our code base our bloated
code base a particular llm would do
better than someone that was working on
a completely new uh uh piece of service
and and developing features there and so
fast forward to July um we started
training developers and that became
incredibly important because the people
that started using and didn't see the
value when they started getting trained
they started using and falling in love
and becoming what we call that now daily
users and I'll explain how why that's
important um and then we started looking
into more metrics back in January the
main metric was I saved and um I
mentioned that we are a data driven
company and I saved wasn't the most
statistically relevant metric that we
could use it was based on Research only
over a couple of developers a few
developers and uh that wasn't cut um
raise your hand here if you uh heard
folks out there in the beginning of the
hype talking about thousand thousands or
or 880 100,000 hours they saved with Gen
has anybody ever heard that and then you
go back to your company and say why are
we not doing this I call that semi BS uh
uh uh and so we had to start going into
other metrics something that were more
statistically relevant and so we started
brainstorming with that come October
October we Define new kpis which I'll go
deeper into it and metrics to measure uh
to measure gen and fast forward to
November end of last year we then start
Ed finding traces that developers were
30% plus faster if they were using Codi
on a daily basis and that's 12 plus day
in a month to take away weekends and the
times that they they were not
coding and most importantly we were able
to partner with Source graph to be able
to create an API layer in front of cod
so we could be creative in using with
some of the tooling that we use like
slack jira and and being able to extract
some of that away from the ID
all right so as we as we we finish
around October we started looking into
those kpis and what was important for me
is that we Define something that we
could measure within a year why because
things are moving so fast and if we it
was really helpful to ground us to what
can we measure within the next year and
so we defined four kpis the lead time
for change quality code basing s sites
that would then go into how we could
modernize some of our bloated code base
and so some of the metrics uh uh when I
say short mid and long term these were
metrics that we could see results in the
short term in the midterm and in the
long term and that long term is
precisely a year and so we started
seeing results with time to review Ms
developers that were using Codi on a
daily bases would ship 30% more Ms than
the ones that that didn't and one very
interesting piece is that their their Ms
were lighter they had less code in it
which I still don't know what to make
out of it but we are we are working on
it and then on the quality side of
things we are hoping to go into the
vulnerability can we show some of the
vulnerabilities we've had in the past
give the context the code bases context
and try to see where we can predict
whether new vulnerabilities will uh will
appear or if they're still lingering our
code base and then we started out the
obvious one is test coverage can we
increase test coverage can we create
test coverage on the Legacy so the new
staff when we rep platform passes that
that particular set of tests and then we
went into coding sites which is more
related to like can we track what parts
of our code Bay are not being used some
feature flags that are still lingering
but shouldn't be there and the code that
is not performance enough and all of
this is to feed into our ultimate goal
which is can we bring the time to rep
platform our code Bay from from yeah
years to months
right okay so while all this is going on
one of the things we noticed is that the
same Engineers that were using the the
like coding assistant to generate code
we also playing around with the
underlying apis and so what we realized
is that like asking people to customize
prompts leads to them wanting to build
and compose those calls into longer
chain automations that we now call
agents um there are a lot of pitfalls
that we encountered uh uh you know in in
the early stages of this like helping
people understand what the expectations
were with respect to what the the llm
can do and what it can't do but the long
story short is at some point we
basically said F this it's not really
working let's just like put our brains
together you know fly out to Amsterdam
we'll do like a weeklong joint hackathon
and build some agents
together and so the first thing to come
out that hackathon was this thing that
uh generates graphql so booking has a a
huge graphql API can we play the
video it uh it's seriously like more
than a million tokens
long H so it does not fit into the
context window of any of the existing uh
llms even if you could shove it inside
context it's not going to do a good job
of of of integrating that context into
something that's coherent a ton of
hallucinations and so what we did is we
built this system that basically
searches this very very long graph P
schema finds the relevant like nodes
wherever they are in this like schema
tree uh and then uh agentically figures
out which ones are relevant and then
walks up that tree to pull in the
relevant parent nodes and so on the
right hand side you can kind of see it's
like inner dialogue this is like it's
thought process for uh reasoning about
which nodes of the schema to pull in and
then uh after it's done that reasoning
it generates a response and so if you do
this naively you know the UI looks very
similar but you just end up getting
garbage which is what we were seeing you
know before we ran this hackathon after
we sat down and and and actually work
through like the specific prompts and
stuff uh to make this work well we saw
far better
results all right so um a pretty
interesting one that uh uh that we
started uh uh working through in terms
of Agents were the automated code
migration could we go into that Legacy
piece functions with over 10,000 lines
to give you context and uh uh and speed
up that rep platforming effort and so uh
code search structure structured met
meta prompt uh and then the the concept
of dividing that particular code base to
conquer the small bits were were really
uh really
interesting um one of the things that I
totally recommend if you started to
embark on on on a journey like this is
pairing with some experts to bring that
expertise into into your offices was
incredibly valuable to us and we started
seeing uh back to when I mentioned that
the developers were using Cody and
stopping and feeding back doesn't
doesn't add any value was pure lack of
knowledge uh folks didn't know how to
work llms out they didn't know how to
pass the right prompt in the right
context and this was uh a pretty
important piece for us to be able to uh
to work on this particular uh agent and
so when we go into this we had
developers working for months at this
point to try to figure out the size of
the problem that we had to then be able
to divide and conquer and then we came
within two days within a hackathon we
were able to really Define uh and
understand where the the call sites were
coming from and and being able to Define
how big the problem is was important for
us to be able to have a start point and
collect the low hunging fruits that were
available for us so U all of this is
still in experimentation uh mode uh but
we' seen a lot of values and a lot of uh
uh sort of like firing that smoke in
going from mons uh uh of of
understanding the code Base
today cool and so the the last agent
that really came out of this joint
effort uh was targeted at code review so
this is something that we found is is
pretty Universal across many different
Enterprises like everyone who does not
do code review here one hand okay uh
I'll talk to you later sir um so like
everyone does code review and what we
found like originally we didn't think
this was a very interesting space
because there's like two dozen startups
now that are popping up that do AI code
review but when we talked to booking we
talked to other Enterprises what we
found is that like code review is kind
of like very specific to your
organization there's a long tale of like
rules and guidelines and other things
that uh you want to bake into your
review process and a lot of the the
tools that are off the shelf there
aren't super customizable and so what we
built is this interface uh where we're
going through and productizing the the
process of building a review agent
that's tailored to your team and your
organization so the the basic idea is
that you define a set of rules that you
want to hold in the code and then those
are defined in kind of like a simple
flat file format and then the agent will
go and consume those rules apply the
relevant ones to the specific files that
are modified in any given uh PR and then
uh very selectively post up comments uh
that are tuned to those rules so it's
very not noisy uh we're trying to
optimize for you know Precision uh over
recall here in in the feedback that
we're we're giving uh the the the
developer all right so knowing what we
know in the beginning of this year we've
been working on this for a year together
uh uh with Source graph then a few ideas
started popping into our mind of how we
could go forward here and uh one of the
things that I'd love to leave you with
is the concept of declaring what are the
rules of your service right so think
think of your CI pipelines today uh when
they give you errors could we anticipate
and shift this left to the ID so those
errors appear there and they appear in
the form of here is an error and here is
a fix so hopefully the service gets to a
point where it's self-healing right and
we started seeing that we could do that
that there are there are there are areas
that we can start using giving the all
the context are the prompt that the
developers started creating via the
prompt uh library that we created and uh
asking those questions Auto automate
those questions to the server to see
what comes out in terms of knowledge uh
um uh out of that code base and so we
think this is ultimately what we we are
trying to achieve within I would say a
short as short as the end of this year
in terms of uh agents um but lots um
Lots here to to go can I sorry can I
just say one more thing read that last
uh slide um I think that we have the
potential here to solve one of the
problems that has plagued software
development since it Inception so you
know who here has read the mythical man
month before so yeah basically everyone
so like it's this problem of like any
software that becomes successful
eventually becomes a victim of its own
success because if you have Revenue if
you have users that's going to generate
feature requests bug reports any
business that's prioritizing that is
going to take on Tech debt to in order
to compete quite frankly and over time
as you add contributors to the code base
you lose this cohesion of vision you
lose the set of standards that you want
to maintain and hold uh with declarative
coding now you can have like the senior
Engineers The Architects the the the
people in charge of the organization
Define constraints and rules that must
hold through the code base and enforce
those rules both at review time as well
as inside the editor for you know the
code that's written by human or AI yeah
for bigger organization all your
compliance rules all the things that
that the developers need to work on but
it's not necessarily feeding new
features to your to your and users I
think those could are perfect examples
of um um yeah being declared into your
service but anyway the main important
thing so far in this past year that
we've been uh um you know pairing to be
able to figure this out has been
education the more we educated the
developer and handholding entire
business units to be able to show them
the value but then have them experiment
within two days of like workshops and
hackathons have them experiment with the
tool they were coming out the other side
incredibly passionate about what it can
do but also becoming that daily users
that we are trying to transform them so
hopefully to defend that 30% plus
increase on speed so educate your folks
if you take one thing from this is
education and if you want to dive deeply
into any of this we got a booth
downstairs feel free to stop by we'll
talk shop or uh also tomorrow I'm given
an expo talk that covers some of the
more nitty-gritty details of how some of
those agents were implemented so thank
you thank you all
[Music]