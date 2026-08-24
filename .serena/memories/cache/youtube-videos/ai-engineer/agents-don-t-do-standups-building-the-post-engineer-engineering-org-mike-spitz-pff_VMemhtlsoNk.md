Agents Don't Do Standups: Building the Post-Engineer Engineering Org - Mike Spitz, PFF

[music]
>> All right. So, I'm in the slot before
the snacks.
I'm here to speak about the host
engineering org and a case study we've
been doing at PFF
started in January and we finished it in
March.
PFF is a sports data company. We help
NFL and NCAA teams figure out what they
should be doing
and we also have a consistent We also
have a
consumer arm which does fantasy
football,
sport betting and for those of you who
know American football there's a draft
happening end of the month and so allows
people to basically play as one of these
teams. We're fully distributed
engineering team. So, we got engineers
in India, we got engineers in Spain and
all the states in America.
Um but first let's go into some kind of
stats. So, we have 100 million page
views annually.
We have 9 million drafts happen on an
annual basis. It's a fairly popular
tool.
And the issue that we had was we were
200 employees around
20 engineers
and we were falling behind our
competitors.
We were focusing on sport betting stuff,
but a lot of our consumers were actually
interested in this and then with Cloud
Ops coming out,
I started experimenting around November
on a personal level
and then it got spun out to
two engineers. One of them was our
strongest front end engineer and the
other one was one of our strongest full
stack engineer.
So, really the question is asking was
instead of figuring out how we can help
engineers go and output more, how do we
help make the how do you help make how
do you help make
the agents quicker? Right. So, I think
if we all think historically software
engineering you got the Agile Manifesto,
software craftsmanship.
Um you've got a lot of good perks and
benefits for engineers from foosball
tables to sleeping pods to pretty much
every perk that most other industries
really don't have and it's cuz we're the
bottleneck and if companies are able to
go and optimize for that, it gives them
a lot of benefit.
But now things are changing.
So, I just want to go straight into how
the case study ended up. So, we had
a 25 times more
25 times more of deploys. So, the two
engineers were deploying five times
five times every five were deploying
five times every day
and the other team was a team of around
10 engineers. They're doing it pretty
much one deploy every five days.
There's a big obvious caveat here,
right? Smaller engineering teams are
always going to be quicker than the big
ones.
So, there is an element of that
multiplier that is just from it being a
smaller engineering team.
However, that smaller target team still
had to coordinate all of those daily
still had to go and coordinate all of
those
deploys with the bigger team. So, there
was still that there was still that kind
of issue that was happening.
And this one this is always hard. How do
you validate like the output is actually
helpful? And the number of PRs isn't
helpful. The amount of code isn't
helpful.
So, we basically blended the number of
tickets with the code complexity
and we found that their we found that
their
that their output was 10x.
Got another slide which might look a
little bit hectic, but just bear with
me.
Um
So, these were the features that we went
and constructed with those two
engineers. It took them under
two months.
If you're going to do this before, we
were estimating it's going to take four
months.
The big thing you can probably have a
look in the in the top half is one of
the engineers gets unblocked in under a
month and then start building other
stuff. Whereas in the old way, they're
both blocked for three months and so you
get this thing where you now have a
compounding increase where it's not just
faster for that stuff, but you're now
able to do a lot more stuff than you
were able to do before.
And the one thing that I really want to
go and basic
basic go and highlight is
doesn't matter if the output's more. It
doesn't matter if the number of
deployments are higher. What really
matters is really matters is basically
if our customers if the customers are
happy. And so we did statistically
we did statistically significant
surveys
and the average quality score was 8.6
out of 10.
What's interesting was before AI we
would probably average
seven seven and a half. So, we weren't
really delivering what the what the
customers
had been interested in.
So,
Scrum did not survive. We were we were
basically having a look not just
on an engineering front and all of the
delivery gains from that, but also from
a process standpoint. And so,
no need for a project manager.
We don't need to play multiple
games of telephone and everything we're
doing was optimizing to be as quick as
possible.
Engineers aren't the bottleneck. So, we
don't need to have all the old
ceremonies that we had before.
So, what did we have? It looks pretty
basic.
We basically had a We basically had
huddles. So, those huddles were
basically every other day. They'd be
like half an hour maybe an hour. You'd
have the engineers, someone from
product, someone from the design team
and you would speak about the things
you've been building the last a couple
days. You get instant feedback. We would
try to deploy to production as fast as
possible in an MVP state and get as much
feedback as possible also.
And that development flow is we have a
spec. I think most of us are probably
fairly familiar around this, but we get
the agent to go and interview us. We get
feedback on that spec and then we make a
lightweight design document. That's done
by That's done by the agent. So, we have
like a skill
and the and the nice thing about that is
it analyzes how we've done all the LDDs
before and so anything that we're
building is in the same kind of ethos as
everything else that's been built. So,
it's not a cloud code
It's not like a cloud code specific
kind of thing.
And then those LDDs they get distributed
and we get feedback from all of the the
engineers.
And then at that stage we automatically
create all we automatically create all
the tickets and then the PRs after that.
So, sprint planning we don't have sprint
planning anymore cuz we don't need to
have an hour going and basically
estimating
tickets cuz those estimations don't
really make any difference.
Something we're not doing at the moment,
but we will probably have to do once the
once the subsidization
of
tokens ends is we'll probably have to go
and estimate the token expenditure to go
see if we want to actually spend this
amount of money on it.
The daily standups we don't have to do
cuz all these tickets get auto updated.
That is
specific to the status of the PR. So, so
with the PRs open it goes auto in
progress.
If it goes into review it updates it, it
gets merged, it gets closed. These
things were obviously manageable to do
before, but it's all been made a little
bit easier.
Sprint refinement we don't need to do
cuz that happens in the spec and the LDD
flow and then when we automatically
create all of the tickets, we structure
it in a manner so that the tickets are
made so none of them are blocking each
other and if there are ones that are
blocking each other, that information is
flagged up and highlighted.
And retrospective this one might be a
little
controversial, but we rely on the
customer satisfaction, the customer
survey. That's the main thing really and
then you got the normal development
metrics like the deployment frequency.
We ask all of our engineers to really
flag when there is an issue to flag it
immediately and to instead of hanging on
till the end of the sprint to go
and go and flag that issue where
sometimes I think all of us have
probably felt that our our feedback
hasn't really been heard cuz it's
been a sprint before.
Oops, sorry. So, how do we start? You
got to pick the engineers which have the
best system in the knowledge and I think
every engineering team probably has one
or multiple engineers where if anyone
ever gets kind of stuck or hung up on
anything they're like, you should speak
to them. They'll be able to sort it out.
The other one is you should you should
go slowly.
So, um
there is an appetite to give everyone
all the coding assistance and open it
all up, but I think
with this you want a slow phased
approach.
And then you should experiment in
non-critical systems. So, that's what I
did in the November in the in like the
two months before the case study. I was
making small proof of concept features
going going and pushing it to
production.
Didn't really get much attraction. So,
if there was a bug or a mistake it
didn't really matter and then we moved
it to the thing which gets 100 million
page views
after that.
Um the big big thing here though
is not everyone can drive a sports car.
And that's all right. There's That's not
a big issue, but I think
I think everyone needs to be a little
bit honest around the engineering org
and engineering team.
And this new era
is going to be hard for a few engineers.
And I think the the type of engineer
will there really strive is one who is
curious. It's the engineer who if they
haven't figured it out, they're going to
spend a little bit of time just figuring
out how something's been built. They'll
be able to still be able to they'll be
able to smash this easily.
The old style of engineering which needs
something really uh prescriptive as a
spec, I think they're going to struggle.
So, in the engineering
side of things, you need verifiable
verifiable verifiable
deterministic tasks. I think a bunch of
people spoken about this today.
So, it ranges from everything from all
the different types of tasks.
But, there's also things which are
specific for your product or your org.
So, for us, it's feature flag cuz we do
a trunk-based development. Um
or it could be generating the
interactive elements. Um
generating the analytics for the
interactive elements.
Um
Next thing is the agentic code review.
So, with us, we didn't really like
relying on agents to do code reviews for
system design and what engineers would
usually do code reviews for. We use
agents to do the code reviews that
engineers hate getting any feedback
from. So, that's like the variable
names, this doesn't fit the style or
like those kind of opinionated manners
is much easier to offload. Uh and then
you can remove that whole kind of
emotional aspect out of it. And then you
just allow the engineers to focus on the
big picture.
Um we still need people involved. But,
it's really heavy on the spec, really
heavy on the LDD, the lightweight design
document where you figure out how we're
going to build this.
And the thing I haven't touched on at
the moment is the product. We're in an
era where everyone's able to create
anything in an hour. But, a lot of these
tools have the brand feel and the
product feel of something that's been
created by a cloud code. And so, if you
really want to get the best out of it,
you really need to make sure that the
engineering team is spending time making
sure it still feels like basically every
other product from the company.
So, how would I recommend attacking
this?
You should go see your engineering
development life cycle like a like a
kind of a like a kind of a
factory. So, you should think you're in
a factory. How do you break that up into
the each small composable element? So,
in a car factory, there's one thing
which is building a building a building
a
a door, another one fitting a steering
wheel. The exact same thing happens for
engineering, right? So, you have the
branch name, you've got uh creating
feature flags with trunk-based
development, you've got the if you build
APIs with a specific software design
a pattern, you should abstract that into
a composable skill. The one thing I
would flag is I'm not a big fan of um
a consuming other people's skills if
they have strong
software kind of opinions that are in
contrast to the today's engineering org
cuz you're just going to kind of end up
in issues. So, you just need to make
sure that any skills that are getting
composed are still kind of matching.
Uh
And yeah, this is just at the moment
pretty much everything is fully
autonomous from the spec, LDD,
ticket from the PR.
Uh we have a QA process also. So, what
happens is um
whenever we merge a PR, it automatically
deploys onto staging. When the
deployment on staging has happened, we
will spin up a a QA agent which has a
look at all of the tickets that have
happened, has a look at the acceptance
criteria, and it will go and then QA
against that.
And then if everything's a pass, I mean,
great. And and then if everything
hasn't, it will flag what those items
are.
And the bit we haven't gone and done at
the moment, but I'm
um
I'm but I'm aiming in the next um
a couple months is to then have an agent
have a look at those
tickets, find out where the acceptance
criteria hasn't happened, and then
automatically create the PRs.
And so, then you get into this flow
where agents can basically uh self-heal.
And the cool thing about that is it lets
us do multiple things in a parallel cuz
we're now in a position where we
basically trust agents
as well.
Uh where do you still use people?
I mean, I've experienced this, but they
do like to use they they do like to use
they like to use shortcuts. Um
So, got to make sure the
the the security side of things is
behaving. A product feel, I spoke about
that a little bit earlier. And then the
scale and engineering complexity for
task, the LDD is really meant to help on
this. So, I think we've all experienced
where it'll make a thousand lines of
code or over-engineer something. If
you're really prescriptive on that
engineering
document at the start, you can really uh
prevent that from happening.
So, what things should you go and aim
for? You should start with boring
repetitive tasks, ideally things
engineers hate cuz you're going to get
the most amount of buy-in from that.
Remove as much redundant process as
possible.
And I know it can be strange when you've
been doing something for like
a two decades plus to just uh chuck it
all out, but I would ask you, what is
the purpose of this meeting? What's the
purpose of this
a process? Is it just cuz everyone else
has been going and doing it before, or
is it cuz it actually helps out?
Uh make sure your team's a personal kind
of engineering culture and the patterns
are encoded in skills. So, if there are
software design patterns that you really
do, so for us, whenever we build an API,
we focus on the service repository
pattern. Uh make sure your guardrails
are fully functional before you get into
before you get into an autonomous flow.
And you should start out with the best
engineers.
Things you should not do is to try and
onboard everyone at the exact same
at time.
Uh I think a big reason why a lot of
these things haven't really panned out
is cuz we've given everyone a cloud code
codex and given them a hackathon and
like, "Sweet, we've done everything.
They should now be able to sort it all
out." It's just not that easy. Every
engineering org is completely different
uh and every engineering org's style is
really different. And you just need to
go and have a slow-phased approach to
make sure
uh that that transition is happening
smoothly.
And that's why I think those small
companies are at a huge advantage of the
big enterprise companies cuz
it's really easy for me to
scale this out when I've got 20
engineers. It's really hard for me to
scale this out if I was in charge of 100
or if I was in charge of 1,000 engineers
or if I was in charge of
10,000 engineers. So,
um but you don't want to be too shy. You
don't want to be too
You don't want to be too conservative
because
the fact is that there's a lot of other
companies that are going full speed. And
um
Um
for us, even from our perspective, I
felt a few months behind and I was kind
of feeling it. And I think if you think
about the compounding impact that I was
talking about at the start, that's just
going to carry on happening. So, like a
few months behind at the moment might be
six months behind in a few months, might
be 12 months behind uh a little bit
afterwards. And then again, just just
the just uh take it slow.
Uh needs a phased needs a phased kind of
approach and rely on your engineers to
let you know whether you can scale
things faster or if it needs a bit more
time.
I know I spoke to you about a lot of
features that we built, but I didn't
show you any of the features. Uh if
anyone does want to have a play around,
feel free to scan the the QR code and
then you can have a look at all the
stuff. Uh cool. Thank you, everyone.
>> [applause]