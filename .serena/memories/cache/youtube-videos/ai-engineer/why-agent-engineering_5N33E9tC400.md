title: Why Agent Engineering
url: https://www.youtube.com/watch?v=5N33E9tC400
date: fetched 2026-08-06
channel: AI Engineer (@aiDotEngineer)
source: youtube-transcript get_transcript

[Music]
hi good morning
everyone love that love that um I'm
going to get right into it one of the
challenges we have with Summit is that
we actually ask our speak speakers to do
very short talks so I as the lead of
summit I have to do even shorter talks
so let's go uh you can see a lot of
these there be a lot of show notes and
homework you can see it on the live
stream how is AI engineering doing uh
it's pretty good we have an O'Reilly
book that's pretty cool um uh chip is
actually a good friend and she's
actually speaking at uh she's giving our
a keynote for the workshops session uh
tomorrow which is pretty cool uh Garner
hates us Garner thinks we've we've hit
the peak so it's only downhill from here
guys I'm sorry to inform you that yeah
engineering is over uh there's no
there's nowhere else uh else to go but
down um a lot of
the what I try to do with these a this
uh talks that I do at at each conference
is to try to Landmark the SE the state
of the art or the state of the industry
um so with Laton space I I did the rise
of the a engineer with the first a
engineer Summit we talked about the
three types of a engineer and with last
year's a engineer Worlds Fair we talked
about how the discipline of a
engineering was maturing and spreading
across different
disciplines um I think this is starting
to get a little sale by now a few
million people have seen this and like
you know uh use this to form their teams
and I think that was the intended effect
what I am encountering these days is the
two resistance from two sides of the AI
engineer Spectrum uh if you come from an
mle point of view you think that the AI
engineer is just like mostly an mle plus
a few promps if you come from the
software engineering point of view you
think that it's mostly software
engineering and uh calling a few llm
apis um I think over time it the AI
engineering is going to basically emerge
as its own discipline and it's still not
there yet it's still very very early I
still say things like oh yeah aiee is
90% software engineering 10% AI I think
that will grow over time and I think
this is the year when it starts to
spread out and that's that's what I'm
here to talk about a little bit today um
so for example I I think like what I try
to do with aie is also like it's a is a
work in anthropology like how people
describe themselves form groups form
identities and form Industries U so ml
you know it leaks out in your language
um they say test time Compu because the
only reason to run inference is to test
it uh AE will maybe say inference time
computer because we actually really care
about inference um software Engineers
may be reasoning um I I think you see
these differences I try to articulate
them over time um part of what I want to
do here to set context is to explain why
we have kind of pivoted AI engineer
Summit to be the agent engineering
conference um uh it's not a decision
that we made likely because uh we're
saying no to all these things we're
saying no to rag we're saying no to open
models uh gpus and we're just saying uh
you know this is the only thing that
we're going to do today um and but like
closing all those doors actually opens
up others so when we put out the call
for speakers we uh made up all this list
of uh you know other agent engineering
disciplines and and I soon realized we
didn't have to I'll talk about this in a
bit um I also looked at last year's top
performing Talks on YouTube and you guys
told us uh that you know you really
wanted all the all the agentic things
now the only problem with this is that
we only got speakers who basically made
agent Frameworks for a living
uh and everyone's asking the the the
real question who's putting this in
production so we had a new rule this
year of all right no more vendor pitches
um you know you complain about yeah
let's oh thank you uh as a as a curator
makes it so much infinitely harder
because uh basically the people that
you're about to see have no incentive to
come on stage and share what they're
sharing uh but somehow we talked them
into it so uh I hope you're looking
forward to that uh the other thing also
I realized that
everything plus agent Works basically so
agent plus rag Works agent plus Cent
Works agent plus search works um and
this is kind of like the simple formula
for like making money in 2025 uh most of
these most of these names you'll see in
the talks that are uh that will follow
uh in in the
sessions um Sor me if you heard this one
before 2025 is the year of Agents right
if you say it often enough it might be
true uh I think that when people make
predictions often times they confuse
what they want to happen for what will
actually happen um so maybe you believe
satin Adela maybe you believe Roman
maybe you believe Greg Brockman maybe
you believe Sam mman all of them want
you to believe that 2025 is year of
Agents uh and I'll be very honest uh me
and my co-host alesio I think I saw you
over there hey um uh we were pretty
skeptical as well we were're on the
record Being skeptical actually actually
all of you are being on the record
because last yesterday uh bar played uh
Family Feud with with our with our
audience and the number two
Buzz that everyone is tired of hearing
as agents um but fortunately you guys
are not tired enough because you came to
it today I have you for one more day of
uh of Agents talk uh but we're on record
March 2024 with David Lan uh the former
VP avenge of openi uh saying that we
tell people to take agents off of their
branding uh now we tell them to put it
back
on so okay there um I I I think I'm I'm
doing this as a public service to start
any agents conference we have to define
the word agent are you guys ready
all right I actually have one I it's a
Monumental task I could do it in one
slide um so if you talk again this this
is a very POV sort of anthropological
point of view the machine learning
people will talk about some kind of
reinforcement learning environment they
want to talk about actions achieving
goals and all that um aie we don't know
what they what they want yet uh this the
software Engineers are very reductive
they just you know put in a for Loop
um okay you it seems like you agree um
so uh fortunately you know I think every
aiee conference needs to invoke the name
of Simon Willison uh he is our patron
saint um he's actually gone in
crowdsource 300 uh definitions of what
an agent is so I didn't have to survey
all of you I I was thinking about asking
every single speaker to start with what
is your definition uh it doesn't matter
uh there's here's six of them right you
it's either about goals it's about tools
it's about control flow it's about long
running processes it's about delegated
authority uh and small multi-step task
completion yeah I see all the phones
coming out don't worry it's on the live
stream right there's like 20,000 people
uh watching along um and then there's
there's a bunch of other things uh I
think I think the last one on the bottom
left bottom right is uh is an
interesting one like just have some
things that everyone defines agrees as
an agent and make sure that they're sort
of your agent definition is passing
those
things um except so that was my one
slide that was my slide uh of like what
defining an agent and then yesterday
open ey went and dropped a new agents
definition uh on the live stream uh that
you can watch yesterday as well um so
this is something they're obviously
going to work with um and I think you
should definitely pay attention to to
this because they're they're building on
top of this uh new definition as well so
that's defining agents why now why is
why are agents working now when they did
not work a year ago two years ago um I
have a rough idea so the people were
talking about capabilities and so uh you
can see that capabilities even even on
the trajectory of 2023 2025 um have been
have been really growing and they
started around to hit human baselines
right about now um and I also have a map
of other uh reasons as well so I'll just
bring you through each of them most
people will say oh yeah we have better
reasoning now we have better tool use
now we have better tools um including
mCP which which you're doing a workshop
on uh tomorrow uh but I think there are
some other less appreciative things
which I'm going to bring up to you right
now model diversity right uh the opening
ey market share has gone from like let's
say 95% two years ago now down to 50%
it's much more diverse uh landscape
including like just this this past week
um two Frontier Model Labs that are
possible challenges to open the eye have
emerged and which I think which I think
is um really exciting for 2025 we we
don't actually know what it's going to
shake out to it by the end of the year
uh the second thing is uh that the cost
of intelligence is super more low is
what I call it um it's it's gone uh the
cost of GPT 4 level intelligence has
gone down 1,000 times in the last 18
months um and you can see the same C
starting for the 01 level
intelligence um uh and also we now start
to have our RL fine tuning options um I
have zero experience in this area but
fortunately one of our speakers will uh
is going to tell us talk to us later
today about this about this um so we
have all these reasons we have I have a
few more uh you know in our conversation
with Brett Taylor U he talks about uh C
charging for outcomes instead of instead
of costs um there's a lot of work on
multi-agents as well as faster inference
as well that's coming out from the the
better Hardware that we have um there's
more homework there if you want this is
all sourced and you know has has has
some backing in our our lat space
conversations but I don't really have
time for that okay so one last thing for
you guys on agent use cases so uh I
think most people agree with like bar um
Barry's uh building effective agents
talk um he he's going to talk about how
coding agents and support agents have
product Market fit I think now it's fair
to say deep research has pmf um but also
I will say up and coming are some of
these use cases some of which you you're
going to see in the the talks later but
also want to offer anti- use cases can
we please stop demoing agents that book
flights yeah no more flight booking
agents uh I want to book my own flights
thank you very much I I want to book my
own instacart orders and also please
don't asro Tri it it right okay so uh
one yeah and I think the reason that the
tell that uh you know this is this is a
headline that I saw yesterday I had to
put this in um opening I reported 400
million users uh which is a 33% growth
from three months ago um and then you
can ask deep research to research open a
eye and draw this chart of chat gbt
growth uh going from uh Z to uh 400
million users in two years in two and a
half years um so I I remember this chart
very well because chpc spent a year not
growing and why did it spend a year not
growing because they didn't ship any any
agentic models um and if you actually
just look at the uh the sort of weekly
active user chart and stretch it out you
actually get this chart uh which is
actually super interesting because it
basically shows that one one um the sort
of 01 models have doubled chat GPT usage
and if you stretch it out um Chad GPT is
going to hit a billion users by the end
of this year this year uh it's basically
going to Quint tupo the number of users
it had uh as of September of last year
um and so like the the the the the
growth of chbt and the growth of any AI
product is going to be very very tight
to reasoning capabilities and the amount
of agents that you can Shi for your
users um it is it is real it is it is
huge huge numbers this is one8 of the
world population that's going to be
using chbt by the end of this year and I
think there's a lot of money left on the
table for everyone else so um I hope you
enjoy doing that um I'm well past time
so I'm going to skip all this but
basically I I think that the job of a is
now evolving towards building agents in
the same way that mes build models
software engineers build software um so
uh I'm going to skip all that you can
see all you can see all that on on the
on the live stream U but we're actually
uh you know just here to welcome you to
the show um and uh I'm really excited to
introduce you to everyone so um thank
you and I hope you enjoy
[Music]