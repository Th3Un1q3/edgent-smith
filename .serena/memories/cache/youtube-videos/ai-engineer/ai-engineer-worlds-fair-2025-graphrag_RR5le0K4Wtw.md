# AI Engineer World’s Fair 2025 — GraphRAG

- Watch: https://www.youtube.com/watch?v=RR5le0K4Wtw
- Upload date: 2025-06-04T17:49:07.786600Z
- Channel: AI Engineer (@aiDotEngineer)
- Source: Fetched via youtube-transcript get_transcript (full text, paginated) on 2026-08-06

Quick quick question everyone who
attended the keynote this morning. Uh we
got a we got a very good question from
the organizer. Not not a question a
statement. Is rag dead or is is uh
agents taking over rag? How many of you
have implemented rag in
production? Oh, plenty. So I can say
with high confidence rag is not dead.
My my take on rag is u uh I think if rag
can solve the problem that you're
working on in production you don't need
agents and vice versa why
uh wrong analogy why build an effl tower
when you can get done with a smaller
minuscule version of it so I think that
is how I see rag being important and
there are a lot of use cases where rag
has found its uh application so I'll
I'll I'll stop there we'll we'll talk
more in my in in my presentation but uh
I'm I'm waiting for 11:15 because this
session is streamed live on YouTube for
uh our friends who couldn't attend uh
this
conference. So when he gives me a heads
up I'll I'll start.
Should we start? Okay. Oh thank you. All
right. So thanks for coming. Um to
quickly introduce myself my name is
Mitesh. I lead the develop advocate team
at Nvidia. And the goal of my team is to
uh create technical workflows, notebooks
uh for different applications and then
we release that code base uh on GitHub.
So developers in general which is me and
you all of us together we can harness
that uh that knowledge and take it
further for the application or use case
that you're working on. So that is what
my uh my team does including myself. In
today's talk, I'm I'm going to talk
about this project that we did with one
of our partners um um and some of my
colleagues at Nvidia and our partner
about how can we create a graph rack
system, what are the advantages of it
and if we add the hybrid nature to it,
how it is helpful. So that's what my uh
my talk is going to be on. I will not
give I will not be able to give you a 10
ft view where you can I can dive with
you in the codebase but there is a
GitHub link at the end of this talk
which you can um scan and all these
notebooks whatever I'm going to talk
about is available for you to take home
but I'll give you a 10,000 ft view or if
you are trying to build your own graph
rag system how can you build it so u a
quick refresher uh what is knowledge
graph um and why are very important. So
um it is a network that represents
relationship between different entities
and those entities can be anything. It
can be people, places, uh concept
events. A a simple example would be me
being here. What is my relationship to
AI worldfare conference? AI engineers
worldfare conference and my relationship
is I'm a speaker at this conference.
What is my relationship to anyone who's
attending here? Well, uh our
relationship is you attended my session.
So this edge of relationship between the
two entities becomes very important uh
to which only graph-based network can
exploit or knowledge graphs can exploit
and that is the reason why uh there's a
lot of active research happening in this
domain of how you can harness graph rag
u how can how you can harness knowledge
graph and put it into a rag based system
so the goal is three things how can you
create a triplet which is the which
defines the relationship between these
entities is that graph our graph based
system or knowledge graph is really good
at
exploiting and that's what is unique
about this knowledge graph. So if you
think about
um why can they work better than
semantic u u rag system well it captures
the information between entities in much
more detail. So those connections can um
can provide a very comprehensive view um
um of the knowledge that you that you
are creating in your rag system and that
will become very important to exploit
when you are retrieving some of that
information and and converting that into
into a response for the user who is
asking that question and it and it has
the ability to organize your data from
multiple sources. I mean that's a given
no matter um what kind of rack system
you're building.
So how do we create a graph rag or a
hybrid system? So this is the highlevel
diagram of what it entails. So I broke
it down into four components. The very
first thing is your data. You need to
process your data. The better you
process your data, the better is a
knowledge graph. The better is a
knowledge graph, the better is the
retrieval. So four components data, data
processing, your graph creation or your
semantic uh um embedding vector database
creation. Those are the three uh steps.
And then the last step is of course
inferencing when you're asking questions
uh to your uh rag
pipeline. And at a higher level this can
be broken down into two big pieces
offline online. So all your data
processing u work which is a one-time
process is offline and and once you have
created your knowledge graph which is
your triplet entity relationship entity
2 um or your semantic uh vector database
once you have it then it's all about
quering it and converting that
information into um um a response that
is readable to the user. It cannot be
something that here are the three
relationship and then we as the user
have to go figure out what does this
exactly
mean. So the top um part of this uh flow
diagram is where you build your semantic
uh vector database which is you you pick
your uh u documents and then you convert
them into vector embeddings and you
store it into a vector database.
So that piece is uh is how you create
your semantic uh uh vector database and
then the piece below is how you create
your knowledge graph and it is much more
uh um there are much more steps that you
have to follow a care that you have to
take when you're creating your knowledge
graph.
So diving in the first step creating
your knowledge graph. How can you create
those triplets out of documents that are
that are not that structured? So
creating triplets which uh which exposes
the information between two entities and
picking up those entities uh so that
that information becomes helpful is very
important. Here's a simple example. This
document is of Exon Mobile's uh results.
I think uh they're quarterly results and
we we try to pick up uh um the
relationship or create the the knowledge
graph using an LLM and if you see at the
first line it's Exon Mobile which is a
company that's the entity uh cut is the
feature of um of that entity spending
oil and gas exploration um and
activity my apologies cut is the
relationship between Exon Mobile and
spending on oil and gas exploration and
activity entity is the the um the name
of the entity is spending on oil and gas
exploration. So this is how the
relationship needs to be exploited. Now
the question that comes to our mind is
that sounds very difficult to do and
exactly it is difficult to do and that
is the reason why we need to harness uh
or we need to use LLMs to figure out a
way to extract this information and
structure it for us so that we can save
it in um um in a triplet format. And how
can we do
that prompt engineering but we need to
be much more uh uh uh defined about it.
So you based on the use case that you
are trying to work on you can define
your oncology and once you have defined
your oncology you can put it in your
prompt and then ask the LLM to go
extract this information that is
oncology specific from the documents and
then structure it in that way so that
that can be stored in a form of a
triplet. This step is very important.
You might be spending a lot of time here
to make sure your prompt is doing the
right thing and it is creating the right
oncology for you. If your oncology is
not right, uh if your triplets are not
right, if they are noisy, your retrieval
will be noisy. So this is where you will
be going back and forth figuring out how
to get a better oncology.
So th this is where you will spend my
take is this is where you'll spend uh
80% of your time to make sure you get
the oncology right and you'll be going
back and forth in an iterative manner to
see how you can make it better over
time and then the next vector database
for a hybrid drag system is to create
the semantic vector database and that is
very reasonably straight straight
straightforward or it is well studied.
So you pick your document. This is the
first page of attention is all you need
research paper. And you you break it
into chunk sizes and you you have
another factor called overlap. And chunk
sizes are important because what
semantic vector database does is it will
it will pick up that chunk and convert
that into use the embedding model and
convert them into a u embedding vector
and store into the vector database. And
it will if you don't have an overlap
then the context between the previous
and the and the next chunk will be lost
if there is any relationship. So you try
to be smart on how much overlap do I
need between my previous chunk and the
and the next chunk and what is the size
of the chunk that I should uh I should
use when I'm chunking my documents into
different paragraphs. That is where the
the advantage of graph rag comes into
play because uh if you think about it
the important information which is uh
the relationship between different
entities are not exploited by u by your
semantic uh uh vector database but they
are exploited really well when you're
trying to um use a knowledge graph or
create a knowledge graph based system.
So once you have created this uh um this
knowledge graph what is the next step?
Now, now comes the retrieval piece which
is um um you you ask a question what is
Exxon Mobile's um cut this quarter that
that it is looking like and knowledge
graph will will help you figure out how
to retrieve those nodes or those
entities and the relationship between
them. But if you do uh a very flat
retrieval which is a single hop you are
missing uh the the most important uh
piece that graph allows you which is
exploitation through multiple nodes that
you can think about and that becomes
very very very important. I I cannot
stress how important that becomes. So
think of different strategies. Again you
will spend a lot of time to optimize
this whether you should look at single
hop, double hop, how much deep you want
to go so that nodes um the relationship
between your first node to the second
node, your second node to the third node
is exploited pretty well. And and the
the more deeper you go, the better
context you'll get. But there's a
disadvantage of that. The more deeper
you go, the more time you're going to
spend on retrieving that information. So
then uh uh latency becomes a factor as
well especially when you're working in a
production environment. So there is a
sweet spot that you'll have to hit when
you're trying to um go how deep you want
to go how how many hops you want to go
into your graph versus how many uh what
is the latency that you can uh u you can
survive. So so that becomes very uh very
important and those some of those
searches can be accelerated. So um um um
we created a library called cool graph
um which which is a which is available
or integrated in a lot of u libraries
out there like network X and whatnot.
But that acceleration becomes important
so that it gives you the flexibility to
get deeper into your graph go through
multiple hops but at the same time you
can reduce the latency so your
performance of your graph improves uh a
lot. So this is the where the retrieval
piece comes into play where you can have
different strategies defined so that
when you're querying uh your data um and
get getting the responses you can have
better
responses and the other important piece
I personally worked on this piece so I I
can talk at length on this but uh I'm
I'm going to give you a very high level
um is evaluating the performance and
there are multiple factors that you can
evaluate around faithfulness um answer
relevancy uh precision recall
um um if you try to use an LLM model,
helpfulness, collectiveness, coherence,
complexity, verbosity, all these factors
becomes very important. So there is a
library pistol library called Ragas. Um
it is meant to evaluate your rag
workflow end to end. Anyone who used
Ragas for evaluating your graph rag? All
right, a few of them. Thank you. But it
is it is an amazing library that you can
uh uh use to evaluate your uh your rag
pipeline end to end because it evaluates
the response it evaluates the retrieval
and it evaluates what the query is. So
EV uh it it will evaluate your your
pipeline end to end which becomes very
handy when you're when you're trying to
test whether my retrieval is doing the
right thing or whether my uh the
questions that I'm asking is the LLM
interpreting it in in the right way or
not. So you can break down your
responses in uh the Raga's pipeline will
evaluate all those pieces and see what
your eventual score is. So it is a pip
install library. The other is LLM uh and
Ragas under the hood uses an LLM. Um no
surprises there. Uh by default it is
integrated with u GPT. uh but it
provides u um you the flexibility that
if you have your own um u model you can
bring it in as well and you can uh wire
it up with your API and you can use that
LLM to figure out on these four four
evaluation parameters that RAS offers.
So so it's a it's it's it's quite comp I
would say it's comprehensive but it's
really good in terms of giving you that
flexibility. The other path is
uh using a model that is meant to
evaluate specifically the response
coming out of LM and that is where this
model Lanimotron 340 billion reward
model that we released I think few years
ago at that time it was a really good
response model it's it's a 340 billion
parameter model so reasonably big but uh
it
evaluates um it's a reward model so it
will go and evaluate the response of
another LLM and judge it in terms of um
how the responses are looking looking
like on these five parameters but it is
meant to go and judge other LLMs that is
how it was
trained. So moving further I would like
to use this analogy that for
uh to create a graph rack system it will
take you uh which is 80% of the job it
will take you 20% of your time but then
to uh make it better which is the last
20% uh sorry which is the the 8020 rule
the last 20% will take 80% of your time
because now you are in the process of
optimizing it further to make it make
sure it works for the use case good
enough um um um for u for the
application that you're working on and
there are some strategies there which I
would like to walk you through. So one
as I said before which I couldn't stress
enough the way you are creating your
knowledge graph out of your unstructured
data becomes very important. The better
your knowledge graph the better results
you're going to get. And something that
we did as experimentation through this
use case that we were exploring with one
of our partners uh was can we fine-tune
an LLM model to get the quality of the
of the triplets that we are creating
better and does that improve results can
we do a better job at data processing
like removing reax apostrophes brackets
words that uh characters that don't
matter if we remove them does it give
you better results? So these are like
small things that um that you can think
about but it gives you it it improves
the performance of your overall system.
So that is where you I'm talking about
80% of your time small nitty-gritty of
the things that you are the knobs that
you
are fine-tuning with slowly and steadily
to make sure your performance gets
better and better and I would like to
share a few strategies that we did which
we got uh which led us to uh uh which
led us to get better results. So the
very first thing is uh rejects or just
cleaning out your data. Um we we removed
uh apostrophe as other other uh
characters that are not that important
if you think about uh triplet generation
that led us to uh um to better uh better
results. We we then implemented another
strategy of reducing the not not missing
out of longer output making it smaller.
that got us uh uh better results and we
also fine-tuned the um the llama 3.3
model or 3.2 model and that got us
better better results. So if you look at
the last three columns you'll see that
by using llama 3.3 as is we got 70 1%
accuracy. So this was tested on 100 uh
triplets to see how it is performing and
as it got sorry 100 documents. So as it
got better and uh as we introduced Laura
we fine tuned the llama 3.1 model our
our accuracy or uh performance went up
from 71 to 87%. And then we did those
small tweaks uh it improved the
performance better. Again remember this
is on 100 documents so the accuracy is
looking high but if your document pool
increases that will come down a bit but
in comparison to where we were before we
saw improvement and and that is where
the small uh tweaks come into play which
would be very very very helpful to you
when you're putting a a system a graph
rag or a rack system into
production. The other is from a latency
standpoint. Um so if your graph gets
bigger and bigger now you're talking
about a network which which goes into
millions or billions of parameter and uh
or millions and billions of nodes. Now
how do you how do you do search in um in
those millions and billions
u in the graph that has got millions or
billions of nodes and that is where
acceleration comes into play. So with
with with cool graph which is now
available through network. So network X
is also al also a pip install library.
Uh anyone who used not network X here
right few. Okay. Um so network is also a
pip install library. Uh under the hood
um it uses um acceleration and if you
see a few of the algorithms uh we um we
we did a performance test on that and um
you can see the amount of latency in
terms of overall execution reducing
drastically. So that is where you can
again small tweaks which will lead you
to better results. So these are two
things that we experimented which led us
to to better results in terms of
accuracy as well as reducing the overall
latency and these are small tweaks and
it it leads us to better
results. So then the question obviously
is should I uh use graph or should I use
semantic um based rack system or should
I use hybrid and I'm going to give you
the diplomatic answer. It depends but
but there are few things I would like to
you guys to take home to to um um which
will help you to come up to a decision
so that you can make an educated guess
that for this use case that I'm working
on a rack system would solve the problem
I don't need a graph and vice versa or I
need a hybrid approach so it depends on
two two factors one is your data um
traditionally if you look at retail data
if you look at FSI data if you look at
employee database of companies those
have a really good structure defined. So
those kind of data set becomes really
good use cases for graph based system
and the other thing to think about is
even if you have unstructured data can
you create a good uh graph knowledge
graph out of it. If the answer is yes
then it's worthwhile experimenting uh um
with u to go the graph path and it
depend it will depend on the application
and use case. So if your use case
requires to um to understand the complex
relationship and then extract that
information uh um to for the response
that you um for the questions that you
are asking only then it makes sense uh
to use graph because remember these are
compute heavy uh heavy systems. So you
need to make sure that these things are
taken care of. I am running out of time
I think but uh as I said before all
these things that I talked about I gave
you a 10,000 ft view but if you want to
get a 100 ft view where you are coding
into into things all these things is
available on GitHub even the finetuning
of the llama 1.1 Laura model and we had
a workshop a two-hour workshop so I gave
you a 20-minute talk but this whole
workshop is covered uh in two hours as
well and lastly um join our developer
programs we do release all these things
on a regular basis you if you join the
mailing list you get this information
based on your interest and as uh my
colleague mentioned I will be across uh
the hall at Neo4j booth uh to answer
questions if any I would love to
interact with you and see if you have
any qu uh any questions and I can answer
those questions. Thank you for your
time.
[Applause]
Thank you. Thank you Mate. That was
fantastic. We've got another great talk
coming up here.
J come on up.
And if I get this right, you're going to
take a philosophical perspective on
this. Yes. Yes.
Hello. Yeah. Thanks.
Five,
four, three, two,
one. Thanks.
You've got this.
Wait, where's the note there?
Um yeah. Oh,
it seems like there's a rehears.
Okay. So, I don't know if there's a way
to get speaker notes onto the screens at
the bottom. Do you guys know?
Yeah. on full screen. Do you need the
notes? Yeah, I need the note
there. I see the note.
You can also just walk through it on the
side and just Yeah, like that. Can you
collapse this collapse this?
I think it's better. Yeah. Yeah. Okay.
So, hi. Hi everybody. Uh my name is
Ching Kyong Lamb. Um I'm the founder and
CEO of PO.AI. AI uh a bit background
about my company uh PTO AI started two
years ago with a invitation from
National Science Foundation from the
SBIR grant funding investigating LLM. We
did a LMB driven drug discovery
application. Uh since then we branch out
to leverage what we learned about
building AI system for large
corporation. We are currently building
expert AI system for several clients.
Currently the system we build goes
beyond rack system. Um many of our
client is asking for AI system that
perform task like research and advisory
role based on their area of interest. Uh
today the talk is about sharing with our
fellow AI engineer what we learned so
far building this kind of system. Okay.
Uh what is knowledge? Okay. Generally
philosophically I say knowledge is the
understanding and awareness gained
through experience education and the
comprehension of facts and principle and
that lead to the next question is what
is knowledge graph right so knowledge
graph is a systematic method of
preserving wisdom by connecting them and
creating a network or interconnect
relationship that's important the graph
represent the thought
process and comprehensive tonomy of a
specific domain of expertise That's why
this is is very important for people
moving forward is about AI system then
think a lot and return uh advice instead
of just retrieve you know data from your
database right so that comes to the
development of this uh K a okay what is
K a kag stand for knowledge augment
generations and it's different from rack
okay it is enhanced language model by
integrating structure knowledge graph
for more accurate and insightful respond
making it smarter more structural
approach than a simple rack kag doesn't
just retrieve remember it understand
this is
different okay after in interviewing a
lot of my client okay so or we also
expert in a certain area of scale I
found that there are common ways of
their thinking decision making process
the way that make them expert in their
area knowledge graph seems to be a
perfect fit So here is a graph or state
diagram if you're a computer engineering
bra like me. So um it shows a wisdom the
the wisdom note as you can see is the is
a core right it's wisdom it just isn't
static it actively guide decision and
fus by other
element the output from the wisdom
actually goes to decision making in the
blue right wisdom isn't passive it guide
decision helping us choose wisely Okay.
And then the decision making analyze the
situation given in the circle in the uh
green and decision aren't make you know
in a vacuum. Okay. They analyze real
world situation. That's the difference.
Okay. So look at the wisdom input. Okay.
Look at the relationship feedback from
the knowledge to wisdom in gold color.
Example of that is knowledge to wisdom
like all your books smart and
encyclopedia wikipdia whatever you store
plus once that data get absorbed by
whatever model you use up there it need
to regurgitate that and understand
that's why it's very important that
wisdom is able to synthesize the data
after you ingested knowledge that's kind
of abstract but I I'll come come to that
later what I'm talking about okay from
Insight example of that is wisdom derive
pattern from chaos like some of my
client has a lot of social media they
their product how do they you know track
their product sediment from from social
media right so it's okay chaotic and
from x tweet right so so from that you
can see some pattern of their competitor
versus uh current what my product is
that that's like an example of that and
I will go to that later okay when all
these connected notes matter together
why do they matter matter all the notes
relate to one another to ever incre
enriching wisdom storing system. Okay,
this talk is about storing wisdom,
right? So knowledge tells you what it
is, right?
And experience tell you what worked
before. Insight invent what to try next.
Right? Like a pizza, knowledge is
recipe. Experience is knowing your oven
burn crust inside is like hey it is at
adding you know honey to the crust you
make caramelize perfectly right so the
most important part of the knowledge
graph is feedback loop okay feedback
isn't oneway street it learn from itself
look at the feedback from the uh going
back to all the note from insight wisdom
okay um situation inform future wisdom
experience deepen it inside. Sharpen it
like a tree growing roots. The more
effect the stronger it gets. Now I want
to ask you a question in general. Where
do you see this circle in your life?
Maybe a tough decision that you know
taught you
something. So one practical application
for leadership is wisdom. Avoid knee
jack reaction by learning from feedback.
As for personal growth, ever notice how
past mistake make you wiser? That's the
loop in the action all this. So the take
away from the slide in this is wisdom
isn't a trophy you earn. It is a muscle
you exercise. The more you feed
knowledge, experience, insight, the more
that guide you. Now I will show you how
it being mapped to my current client.
You know all this is like very abstract,
right? So how I one of my clients
actually doing a competitive analysis uh
they used to have a modeling department
doing that but they want AI to do that
right they asked me to build the system
this exactly what I did with the same
taxonomy of storing all this so this
taxonomy will be later on I talk about
how multi- aent is going to handle all
that here is one of the chatbot that I
build for my client to do you know not
just some uh we not just some chatbot is
our wisdom graph power AI designed to
turn data into strategy right dominant.
So what kind of question I talk about
talk about how do I win my competitor in
this market space that's kind of very
sophisticated question right so without
uh if you do simply just write by first
speaker talk about right right so it's
not going to cut it they're not going to
able to answer that kind of question
okay what I did is this uh we retain the
same testonomy and uh the wisdom is then
mapped the same engine there the wisdom
engine is like a orchestration agent
that does a lot of decision making
including advising what the ARM is able
to see bas based on the current
situation what to do next right so um
what I did is uh for the uh decision
making I map it to a strategy generator
so these customers are talking about a
competitive analysis right so um I map
the knowledge in term of knowledge what
do they have they have market data right
so I map this experience to HP is one of
a kind past campaign so they have a lot
of campaign doing a lot of marketing and
then um the insight is actually mapped
to uh in industrial insight they have a
database doing storing that and then of
course the most important is is the the
situation the situation is how how am I
doing how my product selling right so so
that that is like a situation and then I
map that to a competitor weakness that
means they say if you make the aware of
that you probably get a very good answer
and then the chatbot will probably be
doing the right thing advising so from
here very high level you know state
diagram or there how do I map it to a
system that drive well here comes the
trick so anybody here heard of
n all right all right all right right
all right right all right right it's all
good so so I I first encounter similar
situation when my past IoT project which
is not red developed by uh IBM right so
it's the same kind of thing it's like no
code but but underneath the hood there's
a bunch of code okay it's all nodejs
code okay so uh but but for the for for
for proving your concept and all that.
It's very very very flexible and I I
write highly recommend that and and and
here here you can take a look at the the
workflow the waveform I enable the
implementation of this complicated state
diagram with um what I say is there is a
different community know one of the very
powerful node is AI agent well
previously n is just a workflow
automation tool I'm not selling for n
here I'm just telling you I'm using it
uh for pro prototyping further down the
road maybe the client say too like I I
really need to goal is now have the
option to drive uh different model like
open AAI model entropic model and even
onrem model and then that the key in
making the state m the state machine
work is that about in a graph rag track
why are we talking about fusion inder
well I'm glad you asked because the next
big breakthrough was knowledge graph
with fusion and decoder so you can use
knowledge graphs with fusion and decoder
uh as a technique and this sort of
improves upon the fusion and decoder
paper by using knowledge graphs to
understand the relationships between the
retrieved passages and so it helps with
this efficiency bottleneck and improves
uh the the process. I'm not going to
walk through this diagram step by step
but this is the diagram in the paper of
the architecture where it it uses the
graph and then does this kind of
two-stage ranking of the passages and it
helps with uh improving the efficiency
while also lowering the cost. And so the
team took all this research and came to
came together to build their own um
implementation of fusion indicer since
we actually build our own models uh to
make that kind of the final piece of the
puzzle and it really helped our
hallucination rate. It really drove it
down and then we published a white paper
with our own findings of
it. And so then we kind of had that
piece of the puzzle and there's a few
other techniques that we don't have time
to go over but point being we're we're
assembling together multiple techniques
based on research to get the best
results we can for our customers.
So that's all well and good but like
does it actually work? Like that's the
important part, right? So we did some
benchmarking last year. We used Amazon's
robust QA data set and compared our
retrieval system with knowledge graph
and fusion decoder and everything uh
with our with seven different vector
search uh systems and we found that we
had the the best accuracy and the
fastest response time. So encourage you
to check that out and kind of check out
this process. benchmarks are really cool
but what's even cooler is like what it
unlocks for our customers which are
various features in the product. Um for
one because like most graph structures
we can actually expose the thought
process because we have that
relationships and the additional context
where you can show the snippets and the
subqueries and the sources for how the
rag system is actually getting the
answers and we can expose this in the
API to developers as well as in the
product and then we're also to have able
to have knowledge graph accel call it
multihop questions where we can um
reason across multiple documents and
multiple topics without any struggles.
And then lastly, it can handle complex
data formats where vector retrieval
struggles where an answer might be split
into multiple pages or maybe there's a
similar term that doesn't quite match
what the user is looking for. But we
because we have that graph structure and
and the and fusion and decoder with the
additional context and relationships,
we're able to uh formulate these correct
answers. So again, my main takeaway here
is that there are many ways that you can
get the benefits of knowledge graphs in
rag. That could be through a graph
database. It could be through doing
something creative with posters. It
could be through a search engine. uh but
you can you take advantage of the
relationships that you can build with
knowledge graphs uh in your rag system
and as you get there you can challenge
your assumptions and focus on the
customers to be able to get to the end
result to to make the team successful
and so for our team it was focusing on
the customer needs instead of what was
hyped staying flexible based on the
expertise of the team and letting
research challenge their assumptions
um so if you want to join this amazing
team we're hiring across research
engineering and product. Uh we would
love to talk to you about any of our
open roles. Uh and I am available for
questions. You can come find me in the
hallway or reach out to me on Twitter or
LinkedIn. And that's all I've got for
you. Thank you so much.
[Applause]
can you hear me now? There I am live on.
Okay. In the giant umbrella that is
graph rag, there are many techniques,
many approaches, many ways to get things
done. There's knowledge graph
construction, there's retrieval, but
then there's the notion of going post
rag and thinking about different ways of
thinking about what knowledge is, what
we actually doing in the first place.
So, next up is my good friend Daniel
from Zap to lead us through that.
Daniel,
let's move on.
Not yet. Oh, here we go. 5 4 3 2
1. Great. Well, welcome everybody. Uh,
thank you Andrea. Andreas as well for
the intro. Uh, I'm Daniel, the founder
of Zapai, and we build memory
infrastructure for AI
agents. And I'm going to tell you that
you're doing memory all wrong. Well, it
may not be you directly, but it may be
the framework that you're using to build
your
agents. I also think that knowledge
graphs are awesome. Otherwise, why would
we be here, right? And you should be
using them for agent memory, not just
for graph
rag. So, before I dive into expanding on
my hot takes, I want to touch on why
memory is so important. So we're
routinely building agents that forget
important context about our users. All
that dynamic data that we're gathering
from conversations between the agent and
the user. All the data, business data
from our applications, line of business
applications, etc. There's so much
richness about who the user is and yet
we're not enabling our agents with that
data. And our agents respond as a result
generically or hallucinate even worse.
And this this definitely isn't the path
to AGI or more concretely retaining our
customers. So memory isn't about
semantically similar content. Rag does
that really well. And when I when I talk
about rag here, I'm primarily talking
about vector database-based rag. uh not
necessarily graph
rag but consider the stylized example
where we have learned a brand preference
for Adidas shoes and unfortunately
Robbie's Adidas shoes fall apart so he's
rather
unhappy so the preference changes
however Robbie's follow-up question to
the
agent where he asked what sneakers he
should purchase is most similar to the
first Adidas fact and so if we're using
a vector a database, that fact may be at
the top of the search results and the
agent responds
incorrectly. So when using rag, each
fact is an isolated and immutable piece
of content. And this is a real problem.
The three facts on the left exist with
no understanding of
causality. Semantic search can't reason
with the
why things change over time. And this is
why rag approaches fail as memory. Rag
lacks a native temporal and relational
reasoning. And none of this should be a
surprise. Under the hood, we're just
working with similarity in an abstract
space. There's no explicit relationships
between these embeddings, these vector
representations of the facts that we've
generated for our memory.
However, when we look at knowledge
graphs, we can define explicit
relationships. Graphs can model the why
and at Zep, we've got them to model the
when as well behind the preference
change, which adds a temporal dimension
that your agent can reason over. And
this structural difference is
fundamental to how memory should
work. So, which is a good segue to
graffiti. Graffiti is Zep's open source
framework for building real time dynamic
temporal graphs and it addresses these
exact problems. Graffiti is temporally
aware and graph
relational. You can find it on GitHub uh
go to
git.new/graffiti. It has uh 10,000 plus
stars almost 11,000 quadrupled within
the last six weeks. So thank you
everybody who's tried out graffiti and
loved it. So let's dive into how each of
these attributes of graffiti
works. So this is the secret source.
Graffiti extracts and tracks multiple
temporal dimensions for each fact. It
identified when a fact is valid and
becomes invalid. On the right hand side,
you can see how when we're using the
example that I uh illustrated a few
slides back, how graffiti would pause
those different time
frames. And this enables temporal
reasoning. What did the user prefer in
February? And it can answer questions
that rags simply cannot handle or it
enables your agent to answer questions
that rags simply cannot handle.
And so when we look
at what rag can do, we actually sit with
a bunch of contradictory embeddings with
no resolution in the vector database. So
if we're updating the brand preference,
we'll have a new brand
preference fact in the in the vector
database.
However, graffiti understands that
broken shoes invalidate the love
relationship, which creates a causal
relationship between those three events
in the previous
slide. Broken shoes result in
disappointment, which results in a brand
preference
change. Graffiti doesn't delete the
history of facts as they change, as
they're invalidated, but marks them
invalid rather. And so we store a
sequence of state changes on the graph
which allows your agent to
then reason with those state changes
over time. So for example, the next time
I come back to the e-commerce agent to
purchase shoes, it's not going to
recommend the Adidas shoes to me.
And here's the resulting graph, a closer
approximation to how humans might
process and recall changing state over
time. On the graph, we can see that the
existing Adidas brand
preference is still there, but it hasn't
expired at date. We also see that
there's a new brand preference for Puma
shoes which is in which is valid and it
doesn't have an invalid
date. So graffiti doesn't abandon
embeddings. They're still incredibly
useful. Graffiti uses semantic search
and BM25 full text retrieval to identify
subgraphs within the broader graffiti
graph. And these can be traversed using
graph traversal techniques to develop a
richer understanding of memory. So we
can find adjacent facts that might fill
out the agents understanding of
memory. And the results are then each
fused together. And so this offers a
very fast accurate retrieval approach.
And graffiti has a number of different
search recipes built into it. So you can
really explore how to take different
approaches to um retrieving data for
your particular agent.
So, a little bit of a
bonus when we look at recent changes
that we've added to Graffiti, we allow
developers now to model their business
domain on the graph. Because a mental
health application will have very
different types of things it needs to
store and recall from memory to an
e-commerce agent.
And so graffiti allows you to build
constructs, custom entities and edges
that represent the business objects
within your particular uh business or
application. And so here we have an
example of a media preference where
we've been learning um all about a
users's preferred podcasts and music.
And we have defined an actual structure
here for media
preference. And what this does is it
allows us to then also
retrieve explicitly retrieve media
preferences from the graph rather than a
bunch of other noise that we might have
added to
memory. And this ontology really enables
you to bring a lot of depth to how
memory operates.
So I'm not advocating that you replace
rag everywhere. Rag, graph rag, the
various forms of graph rag and graffiti
each has its strengths and ideal use
cases. The key is recognizing when you
need each. Graffiti is really strong
when you're wanting to integrate
incrementally dynamic data into a graph
without significant recomputation. It's
really strong when you want to model
your business domain. It's strong where
it has very low latency retrieval.
There's no LLM in the path. If you've
tried graph rags, they often have an LLM
in the path. Incrementally summarizing
the output from the graph can take tens
of seconds. Graffiti operates in under
hundreds of milliseconds.
And so the key is recognizing which
solution
offers to your business, what it offers
to your business. And most agent
applications could use rag, a rag
approach and
graffiti. So just summing it all up,
agent memory is not about knowledge
retrieval. Temporal and relational
reasoning is so critical to coherent
memory. We need to track state changes
over time. We need to understand how
something like preferences or user
traits might change over
time and that's something that
contemporary rag solutions
lack. So we published a paper earlier
this year uh describing Zep's use of
graffiti and it's a deep dive into the
graffiti architecture and how Zep
performs as a consequence of using
graffiti under the hood. So you can
follow the link below to land at the
archive preprint if you'd like to take a
look and I'm sure the slides will be
available after the talk so you can uh
uh go to the
paper. So a quick plug for Zep. Zep go
go goes beyond simple agent memory to
build a unified customer record derived
from both chat history and business
data. So you can stream in user chat
conversations but also stream in
business data from your SAS application
from line of business applications like
CRM or billing systems and it builds
this unified holistic view of the user
really enabling your agent to have an
accurate and very comprehensive
real-time understanding of the user so
it can solve complex problems for that
user.
So stick around for the agent memory
lunch and learn which is the next
session. It's being led by Mark Bane and
in it uh amongst other folks uh I'll be
demoing Zep's approach to domain
specific memory built on Graffiti's
custom entities and edges. So uh thanks
for listening to me. Uh we have a few
minutes so I'm happy to answer questions
and I will Yeah, if there are
any no questions. Oh, there's one over
there.
Uh the question was, do you need to use
Zep to use graffiti? No. Graffiti is
open source. It's available on GitHub.
Uh you can go to the link git.new new
graffiti and uh all you'll need today is
Neo forj. So our partners Neoj uh can
assist you with a community edition
install and uh strongly recommend their
desktop product. It's wonderful and you
can get going very
easily. Another question here.
Yeah.
So underneath the
hood, how do you invalidate graph
edges? Are we using
LLMs? So graffiti makes extensive use of
LLMs to intelligently pause incoming
data which could be unstructured or
structured. So the unstructured
conversation, unstructured emails, um
structured data in JSON format and fuse
it together on the graph. And as part of
integrating, we're using LLMs to
identify in a pipeline, identify
conflicting facts. And so that's where
we get this ability to go from broken
shoes to disappointment to a switch in
brand preferences.
Um the LLM is able to understand
emotional veilance of uh the events that
it is
seeing. One more question.
Yeah, depending on the context. So the
question was how do we handle
revalidation of facts if a state flips
back to a prior state and so it depends
on the context. A new edge might might
be created that represents this uh a
successor fact or the invalid at date
might be nullified.
Yeah. Yeah, that's a really good
question. So why can Graffiti do real
time updates but Microsoft Graph Ragg
cannot?
So micro graph rag is uh an
oversimplification is
summarizing document chunks or documents
at many different levels and creating
repeated summarizations at different
levels. So a summary of a summaries of a
summaries etc. And that's very
computationally expensive. So if any of
the underlying data changes you're
ending up with a cascading number of
summarizations. It's expensive and
complicated. Graffiti is designed to
identify specific nodes and edges that
are
implicated in an
update and then is able to invalidate
with a a surgical precision the edges
that are implicated in the
conflict. or we just add new edges or
gra or uh nodes into the graph where
it's relevant. So we're able to use um a
variety of search uh pipelines as well
as a number of different huristics to
really make very focused changes in the
graph which are lightweight and cheap.
Here we go. How does how
does that data? How do you Yeah, that's
a good question as well. So, there are
two ways that uh graffiti
operates. The fir last question the f
the first one is
that graffiti will build the ontology
for you and will very carefully try to
dduplicate edge and node types.
Secondly, as I mentioned a little bit
earlier, we allow you to
define an ontology
using paidantic, zod, uh, gostructs,
etc. All right, I think we're at time.
So, thank you everybody.
And as Daniel mentioned, there's lunch
being served outside right now,
actually. So, I encourage you all to go
get a bite to eat at 1:00. Come back
into the room. We're gonna have a panel
discussion about overall agentic memory
and different implementations of it and
you're going to be part of that panel as
well, right? Yeah. So, it'll be a great
session. So, come back at one o'clock
for a longer session into a memory. Hi,
I have a question. Are there
limitations? Why don't I hop down? Yeah.
Are there any limitation when it comes
to the data set graph can handle because
I
have did a great job. Thank you. I will
come back. Um about 10 minutes before 1.
Okay. Yeah.
Yeah. Did you go
for a lunch break? Okay, cool.
[Music]
Yeah,
she What's going on in this room? That's
why I love our room. She's doing that,
you know.
check check. One, two. Okay, they must
Well, I put him in there just because
Check, check, check.
Make sure I have the image.
You can wear this on your belt. You can
wear it on your You can do whatever you
want. You can put it Could you help me?
As long as I think pocket is the best. I
I usually put it to hide the cable.
There's a camera on it. You like the
cable to be invisible. So, could you
help me? Yeah, sure. Just uh tuck it in.
Of course. Feel free. You're welcome to
all set.
Thanks.
Can we do a test for all of us before we
head to the
stage? Um, is the Thanks. Is the uh
computer all set? Everything fine?
Perfect. I think I need to mirror,
right? Mirror the screens. Okay, I'll do
that.
And the Ethernet is already here. Could
we It's right here. It's right here. Oh.
Oh, wait.
So, you just own this, right? You can
start this. You're all set. You good to
go? I think I need like five minutes if
we have three three minutes. Yes, that's
that's the right
amount. All right.
Can we do a test? He's going to do that.
I see.
I see his. I see.
You said something about mirroring your
screen. Mhm. Up there. So, we have to
like set that up. Yeah. Yeah.
You can practice that. You could
actually tell that to Daniel and Pacilia
just in case. Okay. So that there is no
I mean there are always glitches but
less of them. Yeah.
Oh, can I do this test or you need a
moment? You need a moment. Okay,
great. Thank you.
Let me straighten that.
Come on back to
[Music]
beautiful. All right. All
right. Once you get up there, you're
going to
Nope. Hello. Hello. Hello. Hello. All
right.
That's right. This is the musical
section of the afternoon. Uh, hi
everyone. Welcome to the graph rag track
and we're having a lunch and learn. And
I should remember myself and I've told
the other speakers to stay here in the
middle of the stage uh for the lunch and
learn we we have the great treat that my
good friend Mark Bane Mark who's over
there Mark who's going to be taking us
through agentic memory doing a kind of a
broad sweep like you know dive into the
agentic memory but then we're also going
to have a panel discussion around it and
a couple of demos. This is going to be a
longer session than the rest of the
graph track. It's about 45 minutes.
Totally worth staying for the entire
time. Should be amazing. Mark, are you
ready to talk? Of course. My friend Mark
Bane, please. All
right. One, one, one. All right. How is
everyone doing here?
I'm super excited to be here with you.
Um, this is my first time speaking at AI
Engineer. And, um, we have an amazing
um, group of speakers, guest speakers.
Vasilia Marovitz from Cognney, Vasilia.
Um, oh, there is Vasilia, Daniel Chalev
from Graffiti and Zepai and Alex Gilmore
from Neo4j. Um,
the the plan looks like this. I will do
a very quick power talk and about about
the topic that I'm super passionate
um the AI memory. Next we'll have four
live demos uh and we'll move on to some
new solution that we are proposing a
graph rack chat arena uh that I will be
able to demonstrate and I would like you
to follow along once it's being um
demonstrated and at the very end uh
we'll have a very short Q&A session.
Um there is um a Slack channel that I
would like you to join. Um so please
scan the QR code right now before we
begin and let's make sure that everyone
has access to the um to these materials.
There is um a walkthrough shirt on the
channel that will go
through closer to the end of our
workshop. But I would like you to start
setting it up if you if you may on your
laptops if you want to followalong. All right, it's a workshop graph
chat. You can also find it on Slack and
you can uh join the channel. So a little
bit about myself. Uh so hi everyone
again. I'm Mark Bane and I'm very
passionate about the memory what is
memory the deep physics and applications
of memory across different technologies.
Um you can find me at markbane uh on
social media or on my website and let me
tell you a little bit of a story about
myself. Uh so when I was um 16 years old
I was very good at maths and I did math
olympiads with many brilliant minds
including Voyek Sarmba the co-founder of
OpenAI and thanks to that deep
understanding of mass and physics
I did have many great opportunities to
be exposed to the problem of AI memory.
So first of all I would like to recall
um two conversations that I had with
Voych and Ilia in
2014 in September when I came here to
study at Stanford. Um, at one party we
met with Ilia and Voytech who back then
worked at Google and they were kind of
trying to pitch me that there will be a
huge revolution in AI and I kind of like
followed that. I was a little bit
unimpressed back then. right now. I
probably
um kind of take it as a very big
excitement when I look back to the times
and I was really wishing good luck to to
the guys who were doing deep learning
because back then I I didn't really see
this prospect of GPUs giving that huge
edge uh in
compute. Uh however uh during that
conversation was like 20 minutes at the
very end I asked
Ilia all right so there is going to be a
big AI
revolution but how will these AI systems
communicate with each
other and the answer was very perplexing
and kind of sets the stage to what's
happening right now uh Ilia simply
answered I don't know I think they
invent their own
language. So that was 11 years ago. Fast
forward to now. Um the last two years
I've spent doing very deep research on
physics of AI and kind of like dove into
all of these most modern AI
architectures including attention
diffusion models, VAEs and many other
ones. And I realized that there is
something critical, something
missing. And this power talk is about
this missing thing.
So over the last two
years I kind of followed on on my last
years of doing a lot of research in
physics, computer science, information
science and I came to this conclusion
that
memory AI memory in fact is any data in
any format and this is important
including code
algorithms and hardware.
were and any causal changes that affect
them. That was something very
mind-blowing to to reach that conclusion
and that conclusion sets the tone to
this whole track, the graph track.
In fact, I was also perplexed by how
biological systems use memory and how
different cosmological structures or
quantum structures they in fact have a
memory. They kind of
remember
and let's get back to maths and to
physics and geometry. When I was doing
science olympiads, I was really focused
on two three things. Geometry,
trigonometry and algebra. And I
realized in the last
year that more or less the volume
of loss in physics perfectly matches the
volume of loss in mathematics. And also
the constants in mathematics, if you
really think deeply through geometry,
they match the
constants both in mathematics and in
physics. And if you really think even
deeper, they kind of like transcend over
the all the other
disciplines. So that made me think a
lot. And I found
out that the principles that govern
LLMs are the exact same principles that
govern
neuroscience and they are the exact same
principles that govern mathematics. I
studied I studied papers
of Perilman. I don't know if you've
heard who is Pearlman. Perilman is this
mathematician who refused
um to take a $1 million award for
proving the
um for for proving the one of the mo
most important
conjectures about symmetries of three
spheres.
Um, and once I realized that this deep
math
of spheres and circles is very much
linked with how attention and diffusion
models work. Basically the formulas that
Pearlman reached are
linking
entropy with curvature and curvature
basically if you think of curvature it's
attention it's gravity so in a sense
there are multiple disciplines where the
same things are appearing multiple
times and I will be publishing a series
of papers with some amazing ing
supervisors who
are co-authors of two of these
uh meth methods methodologies
um the transformers and
VAEs and I came to this realization that
this equation governs everything governs
mass governs physics governs our AI
memory governs neuroscience biology
physics chemistry and so on and so
forth.
So I came to this equation that memory
times compute would like to be a squared
imaginary unit
circle. If that existed ever, we would
have perfect symmetries and we would
kind of not exist because for us to
exist, this asymmetries needs to show
up. And in a sense, every single LLM
through weights and
biases, the weights are giving the
structure. The compute that comes and
transforms the data in sort of the row
format. The compute turns it into
weights. The weights are basically if
you take these billions of parameters,
the weights are the sort of like matrix
structure of how this data looks like uh
when when you really find relationships
in the row data. All right. And then
there are these biases, these tiny
shifts that are kind of like trying to
like in a robust way adapt to this model
so that it doesn't break apart but still
is still is very well reflecting the
reality. So something is missing. So
when we take weights and biases and we
apply scaling laws and we keep adding
more data, more compute, we kind of get
a better and better and better
understanding of the reality. In a
sense, if we had infinite data, we
wouldn't have any biases. And this
understanding is again the principle of
this track of
graph. The disappearance of biases is
what we are looking for when we are
scaling our
models. So in a sense, the amount of
memory and compute should be exactly the
same. it's just slightly expressed in a
different way. But if there are some
there in any
imbalances then something important
happens. And I came to another
conclusion that our universe is
basically a network
database. It has a graph structure and
it's a temporal structure. So it keeps
on moving following some certain
principles and rules.
And these principles and
rules are not necessarily
fuzzy. They have to be
fuzzy because otherwise everything would
be completely
predictable. But if it would be
completely predictable, it means that me
myself would know everything about every
single of you about myself from the past
and myself from the future. So in a
sense, it's impossible. And that's why
we have this sort of like heat diffusion
entropy
models. They allow us to exist. But
something is
preserved.
Relationships. Any single asymmetry that
happens at the quantum
level, any single tiny asymmetry that
happens preserves causal
links. And these causal links are the
exact thing that I would like you to
have as a takeaway from this workshop.
The difference between simple rack,
hybrid rack, any types of rack and graph
rack is that we are having the
ability to keep these causal links in
our memory systems. Basically, the
relationships are what preserves
causality. That's
why we can solve hallucinations.
That's why we can
optimize hypothesis generation and
testing. So we will be able to do
amazing research in biosciences,
chemical
sciences just because of understanding
that this causality is preserved within
the relationships. And these
relationships when there are these
asymmetries that are needed they kind of
create this curvature I would say. So we
under we intuitively feel every single
of you is choosing some specific
workshops and talks that you guys go
to. Right now all of you are attending
to the talk and workshop that we are
giving. It means that it matters to you
and it means that potentially you see
value and this value this information is
transcended through space and
time. It's very subjective to you or any
other
object and I think we
really need to understand this. So LMS
are basically this weights and biases.
So correlations they give us this
opportunity to be
fuzzy. You know actually one thing that
I learned from Voytech 10 8 11 years
ago was that hallucinations are the
exact necessary thing to be able to
solve a problem where you have too
little memory or too little compute for
the combinatorial space of the problem
you are solving. So you're
basically imagining you're taking some
hypothesis basing based on your history
and you're kind of trying to project it
into the future. But you have too little
memory, too little compute to do that.
So you can be as good as the amount of
memory and compute you have. So it means
that the missing part is something that
you kind of can curve thanks to all of
these causal relationships and this
fuzziness. and
oops
reasoning is reading of these
asymmetries and the causal links.
Hence, I really believe that agentic
systems
are sort of the next big thing right now
because they are following the network
database
principle. But to be
causal, to recover this causality from
our
fuzziness, we need graph databases. We
need causal relationships. And that's
the major
thing in this emerging trend of
graph that we are here to talk about.
And I would like to at this moment
invite on stage our three amazing guest
speakers. And I would like to start with
Vasilia. Vasilia, please come over to to
the stage. Next will be
Alex and Daniel.
and I'll present something myself. All
right. So, uh, Vasilia will show us how
to lurch, search and optimize memory
based on certain use case at hand. All
right, let's test.
Um, so let's just make sure this works.
Okay. So, um,
nice to meet you all. Uh, and I'm
Vasili. I'm originally from Montenegro,
small country in the Balkans. Um,
beautiful. So, if you want to go there,
my cousins Igor and Milos are going to
welcome you. Everyone knows everyone. So
uh you know if in case you're just
curious about memory I'm building a
memory tool on top of the graph and
vector databases. My background is in
business big data engineering and
clinical psychology. So a lot what Mark
uh talked about kind of connects to
that. Um I'm going to show you a small
demo here. Uh the demo is to do a
Mexican standoff between two developers
where we are analyzing their GitHub
repositories and these uh data from the
GitHub repositories is in the graph and
this Mexican standoff means that we will
let the crew of agents go analyze look
at their data and try to compare them
against each other and give us a result
that should represent how uh who should
we hire let's say out ideally out of
these two people. So uh what we're
seeing here currently is how Cognify
works in the background. So Cognify is
working by uh adding some data turning
that into a semantic graph and then we
can search it with wide variety of
options. We plugged in crew AI on top of
it. So we can pretty much do this on the
fly. So um here in the background I have
a client running. This client is
connected to the to the system. So um
it's now currently uh searching the data
sets and starting to build the graphs.
So let's uh see it takes a couple of
seconds but uh in the background uh we
are effectively ingesting the GitHub uh
data from the GitHub API building the
semantic structure and then uh letting
the agents actually search it and make
decisions on top of it. So as every time
with live demos things might go wrong.
So I have a video version in case this
does. Let's
see and I'll switch to the vid. Oh here
we go. So uh the semantic graph started
generating and as you can see we have
activity log where the graph is being
continuously updated on the fly. Data is
being stored in memory and then uh data
is being enriched and the agents are
going and making decisions on top. So
what you can see here on the side is
effectively the agentic logic that is
reading, writing, analyzing and using
all of these uh let's say preconfigured
set of weights and benchmarks to to
analyze any person here. So cogn is a
framework that's modular. You can build
this task. You can ingest from any type
of a data source. 30 plus data sources
supported now. You can build any type of
a custom graph. You can build graph from
relational databases. semi-structured
data and we also have this memory
association layers inspired by the
cognitive science approach. And then
effectively um as we kind of build and
and enrich this graph on the fly, we see
that uh you know it's getting bigger,
it's getting more popular and then we're
storing the data back into the graph. So
this is the uh stateful temporal aspect
of it. we kind of build the graph in a
way that we can add the data back that
we can analyze these reports that we can
search them and that we can let other
agents access them on the fly. The idea
for us was let's have a place where
agents can write and continuously add
the data in. So um I'll have a look at
the graph now so we can inspect it a
bit. So if we click on on any node we
can uh see that uh the details about the
commits about the information from the
from the developers the PRs whatever
they did in the past and and which repos
they contributed to and then at the end
as the graph is pretty much filled we
would see the final report kind of
starting to come in. So let's see how
far we got with this. So it's
taking it's preparing now the final
output for the hiring decision task. So
let's have a look at that when it gets
loaded. We just finished this this
morning. I hope to had a hosted version
for you all today, but didn't work
through AI's causing some troubles. So
uh let's uh we had to resolve this
one. So let's
see. Yes. So I will
just show you the video with the end so
we don't wait for it.
So here you can see that towards the end
uh we can see the
graph
and we can see the final decision which
is a green node and in the green node we
can see that we decided to hire lasslo
our uh developer who has a PhD in graphs
so it's not really difficult to make
that call and we see why and we see the
the numbers and the benchmarks. So thank
you. This has been very fast three
minute demo. So hope you enjoyed and if
you have some questions I'm here
afterwards. We we are open source so
happy to see new users and if you're
interested try it. Thanks.
Woohoo. Thank you. Thank you Vasilia. Um
next up is Alex. So Vasilia showed us
something I call semantic memory. So
basically you take your raw data, you
load it and cognify it as they like to
say. Come on, come on up, Alex.
And that's the base. That's something we
already are doing. And next up is Alex
will show us Neo4j MCP uh server. The
stage is yours.
test. Four, three, two, one. We're good.
Okay. All
right. Okay. So, hi everyone. My name is
Alex. Um, I'm an AI architect at Neo
Forj. Um, and I'm going to demo the
memory MCP server that we have
available. Um, so there is this
walkthrough document that I have. Um,
we'll make this available in the Slack
or by some means so that you can do this
on your own. Um, but it's pretty simple
to set up. Um, and what we're going to
showcase today is really like the
foundational functionality that we would
like to see in a aentic memory sort of
application. Um, primarily we're going
to take a look at semantic memory in
this um, MCP server, but we are
currently developing it and we're going
to add additional memory types as well
um, which we'll discuss uh, probably
later on in the presentation.
Um so in order to do this we will need a
neo forj database. Neoraj is a graphn
native database that we'll be using to
store our knowledge graph that we're
creating. Um they have a aura option
which is um hosted in the cloud or we
can just do this locally with the neoj
desktop app. Um, additionally, we're
gonna do this via Claude desktop. And
so, we just need to download that. And
then we can just add this config to the
um, MCP configuration file in Claude.
And this will just connect to the Neo
Forj instance that you create. Um, and
what's happening here is we're going to
uh, Claude will pull down um, the memory
server from Pi and it'll host it in the
back end for us. And then it'll be able
to use the tools that are accessible via
the MCP server.
And the final thing that we're going to
do before we can actually have the
conversation is we're just going to use
this brief system prompt. And what this
does is just ensure that we are properly
recalling and then logging memories
after each interaction that we
have. Uh so with that um we can take a
look at a conversation that I had um in
claw desktop using this memory server.
Um and so this is a conversation about
starting an agentic AI memory company.
Um and so we can see um all these tool
calls here. And so initially we have
nothing in our memory store which is as
expected. But as we kind of progress
through this conversation we can see
that at each interaction it tries to
recall memories that are related to the
user prompt. And then at the end of this
interaction it will create new entities
in our knowledge graph um and
relationships. And so in this case, an
entity is going to have a name, a type,
and then a list of observations. And
these are just facts that we know about
this entity. And this is what is going
to be updated um as we learn
more in terms of the relationships.
These are just identifying how these rel
uh how these entities relate to one
another. And this is really the core
piece of why using a uh graph database
as sort of the context layer here is so
important because we can we can identify
how these um entities are actually
related to each other. It provides a
very rich context. And so as this goes
on we can see that we have quite a few
interactions. We are adding observations
creating more
entities. And at the very end here we
can see we have quite a lengthy
conversation. we can say, you know,
let's review what we have so far. And so
we can read the entire knowledge graph
back as context and Claude can then
summarize that for us. And so we have
all of the entities we found, all the
relationships that we've identified, and
all the facts that we know about these
entities based on our conversation. And
so this provides a nice review of what
we've discussed about this company and
our ideas about how to create it. Now,
we can also go into Neoraj browser. Um,
and this is available both in Aura and
local. And we can actually visualize
this knowledge graph. We can see that we
discussed Neo Forj, we discussed MCP and
Langraph. And if we click on one of
these nodes, we can see that there is a
list of observations that we have. And
this is all the information that we've
tracked throughout that conversation.
And so it's important to know that like
even though this knowledge graph was
created with a single conversation, we
can also take this and use it in
additional conversations. We can use
this knowledge graph with other um uh
clients such as cursor IDE or windsurf.
And so this is really a powerful way to
um create a like memory layer for all of
your
applications. Um and so with that um
I'll pass it on. Thank you. All right,
give a round of applause to Alex.
Thank you, Alex. The next up is Daniel.
Um I will just share personal um beliefs
about MCPS. Um I was testing MCPs of
Neo4j graffiti Cognney Mzier just before
the workshop and I'm a strong believer
that this is our future. We'll have to
work on that and in a second I will be
showing a mini graph chat arena. And
next up something very very important
that Daniel does is temporal graphs.
Daniel uh is co-founder of graffiti and
zep. They have 10,000 stars on GitHub
and growing very fast. The stage is
yours. Daniel, please show us what you
do. Thank you. So, five, four, three,
two, one. Did that work? Seems to have
right. So,
um I'm here today to tell you that
there's no onesizefits all memory.
um and why you need to model your memory
after your business domain. So, if you
saw me a little bit earlier and I was
talking about Graffiti, Zep's
open-source temporal graph framework,
um you might have seen me just speak to
how you can build custom entities and
edges in the graffiti graph for your
particular business domain. So business
objects from your business domain. What
I'm going to demo today is actually how
Zep implements that and how it easy it
is to use from Python, TypeScript or Go.
And what we've done here is we've solved
a fundamental problem plaguing
memory. And we're enabling developers
to build out memory that is far more
cogent and capable for many different
use cases.
So I'm going to just show you a quick
example
of where things go really wrong. So many
of you might have used chat GPT before.
It generates facts about you in memory.
And you might have noticed that it
really struggles with
relevance. Sometimes it just pulls out
all sorts of arbitrary facts about you.
And unfortunately when you store
arbitrary facts and retrieve them as
memory, you get inaccurate responses or
hallucinations.
And the same problem happens when you're
building your own
agents. So here we go. We have an
example media assistant and it should
remember things about jazz music, NPR,
podcasts, the daily, etc. All the things
that I like to listen to. But
unfortunately, because I'm in
conversation with the agent or it's
picking up my voice when I'm, you know,
it's a voice agent. Um, it's learning
all sorts of irrelevant things like I
wake up at 7 a.m. My dog's name is
Melody, etc. And the point here is that
irrelevant facts pollute memory. They're
not specific to the media player
business domain. And so the technical
reality here is as well that many
frameworks take this really simplistic
approach approach to generating facts.
If you're using a framework that has
memory capabilities, agent framework,
it's generating facts and throwing it
into a vector database. And
unfortunately the facts dumped into the
vector database or reddus mean that when
you're recalling that memory, it's
difficult to differentiate what should
be returned. We're going to return what
is semantically similar.
And here we have um a bunch of facts
that are semantically similar to my
request for my favorite tunes. Um we
have some good things and unfortunately
Melody is there as well because Melody
is a dog named Melody and that might be
something to do with tunes. Um and
so bunch of irrelevant
stuff. So basically semantic similarity
is not business
relevance and this is not
unexpected. I was speaking a little bit
earlier about how vectors and are just
basically projections into an embedding
space. There's no causal or relational
uh relations between them. And so we
need a solution. We need domainaware
memory not better semantic search.
So, with that, I am going to
unfortunately be showing you a video
because the Wi-Fi has been absolutely
terrible.
Um, and let me bring up the
video.
Okay.
So, I built a little application here
and it is a finance coach and I've told
it I want to buy a house.
And it's asking me, well, how much do I
earn a year? It's asking me about what
student loan debt I might have. And
we'll see that on the right hand side,
what is stored in Zep's
memory are some very
explicit business objects. We have
financial goals, debts, income sources,
etc. These are defined by the developer
and they're defined in a way which is
really simple to understand. We can use
paidantic or zod or go
strcts and we can apply business rules.
So let's go take a look at some of the
code here. We have a TypeScript
financial goal schema using Zep's
underlying SDK. We can define these
entity types. We can give a description
to the entity type. Uh we can even
define fields, the business rules for
those fields. So the values that they
take on. And then we can build tools for
our agent to retrieve a financial
snapshot which runs multiple zep
searches at the same time concurrently
and filters by specific node
types. And when we start our Zep
application, what we're going to do is
we're going to register these particular
goals uh sorry objects with uh Zep. So
it knows to build this ontology in the
graph. So let's do a quick little
addition
here. I'm going to say that I have
$5,000 month
rent. I think it's rent.
And in a few seconds, we see that Zep's
already paused that new message and has
captured that $5,000. And we can go look
at the ch the graph. This is the the Zep
front end. And we can see the knowledge
graph for this user has got a debt
account entity. It's got fields on it um
that we've defined as a developer. And
so again, we can really get really tight
about what we retrieve from Zep by
filtering. Okay, so we're at time. So
just very quickly, we wrote a paper
about how this all of this works. You
can get to it uh by that link below. And
appreciate your time
today. You can look me up
afterwards. Great paper, by the
way. All right. Uh once I'm getting
ready um I would appreciate if you
confirm with me uh whether you have
access to Slack. Uh is the Slack working
for you the Slack channel? All right. I
think we are slowly running out of time.
So I'd appreciate if you have any
questions to any of the speakers. Please
uh write these questions on Slack and we
will be outside of this room and we are
happy to answer more of these questions
just after the workshop.
I right now move on with um a use case
that I developed and to this graph rack
uh chat
[Music]
arena to be
specific
before delving into aic memory into
knowledge
graphs. I led a private cyber security
lab and worked for defense clients, a
very big clients with very serious
problems on the security side. And I
used
to in one project I had to navigate
between something like 27
29 different terminals and
shells
and it requires knowing lots of
languages like if you think of like
different Linux distros every firewall
and networking devices usually has its
own shell proprietary often there is
PowerShell so you need to know like lots
of languages to communicate with these
machines to to work with such clients
and I realized that LLMs are not only
amazing to translate these languages but
they are also very good to kind of
create a new type of shell a human
language shell. There are such shells,
but such shells, they would really be
excellent if they have episodic memory,
the sort of temporal memory of what was
happening in this shell historically.
And if we have access to this temporal
history, the events, we kind of know
what the users were doing, what their
behaviors are, we kind of can control
every single code execution function
that's running, including the ones of
agents. So I spotted with some investors
and advisers of mine, I spotted a
niche, something we call agentic
firewall, and I wanted to do a super
quick demo of how it would work.
So basically you would um run commands
and type pwd and in a sense we I suppose
lots of us had computer science classes
or or we worked in shell and we have to
remember all of these commands like um
show me running docker containers like
it's docker ps right but if you go for
more advanced commands we can
Uh, I think it's for a reason. Yeah, I
think it's for a reason.
Um, one
second. Sorry about that.
All right, it's there. Okay, thank you.
In general, I would need to know right
now some command that can extract me,
for instance, the name of the container
that's running and its status. Show me
just
um image and
status. I can make mistakes like human
language fuzzy mistakes.
Um show if Apache is running.
All right, show the
command we did
three commands
ago. So basically, if you plug in the
agentic, if you plug in the agentic
memory to things like that, I think I
think it got it wrong, but you get me
right. So if I get through like
different shells and terminals
um and I have this textual context that
what was done and the context of the
certain machine of what is happening
here and it kind of spans across all the
user all the machines all the users and
all the sessions in PTY TTY I think that
we can really have a very good context
also for security so that space um the
temporal locks, the episodic locks is
something that I see will boom and
emerge. So I believe that all of our
agents that will be executing code in
terminals will be executing it through a
maybe not all but the ones that are
running uh on the enterprise gate they
will be going through agentic firewalls.
I'm I'm close to sure about that. So
that's my use case. Um, and now let's
move on to GraphRack Chat Arena. So, you
have on Slack
uh a link to this doc and this doc is
allowing you to set up a repo that we've
created for this workshop and we'll be
promoting it afterwards. So about a year
ago, I met with Jeru from Lamal Index
and we were chatting quite a while about
like how to evolve this conversational
memory and he gave me two pieces of
advice. One of them think about data
abstractions, the other think about
evolves. Data abstractions I kind of
quickly solve within like two months.
Evils I realized that there won't be any
evolves in form of a benchmark. This all
of these hot potatoes and all of that
it's fun. I know that there are great
papers written by our guest speakers and
other folks about hot potatoes, but it's
not the thing. You can't do a benchmark
for a thing that doesn't exist.
Basically, the agentic graph memory will
be this type of memory that evolves. So,
you don't know what will evolve. So, if
you don't know what will evolve, you
will need a simulation arena and that
will be the only
right evil.
So one year fast forward and we've
created a prototype of such a gentic
memory arena. Think about it like web
arena but for memory. And let me quickly
show you that you can go to this
repository. I did a fork of that there
is mezzero, there is graffiti, there is
cogni um and there will be two
approaches. one approach will be
um sort of the repo the the library
itself and the other is through MCPS
because we don't really know what will
work out better so whether repos or the
MCPS will work out better so we'll need
to test these different approaches but
we need to create this arena for that so
you basically clone that repo and we use
ADK for that so we get this nice chat
where you can talk to these agents
And you can switch between agents. So I
want to talk with Neo and there is a
Neo4j agent running behind the scenes.
There is a cipher graph agent running
behind the scenes and I can kind of for
now switch between these agents. Maybe
I'll increase the font size a little
bit. So the Neo agents basically
answering the questions about this
amazing technology, the graphs,
specifically Neo forj.
and I can switch to
cipher and then an agent that is
excellent at running cipher queries
talks with me and I'm writing add to
graph data mark and I'm passionate about
memory architectures and basically what
it does is it runs these layers that are
created by cogni by mezero by graffiti
and all the other vendors of semantic
and temporal memory solutions
or specifically created by an MCP server
that Alex was demonstrating, the Neo
Forj MCP server. So, I'm really looking
forward to how this uh technology
evolves. But what I really what I
quickly wanted to show you is that it
already works. It has this science of
being this identic memory arena. So I
can ask my graph through questions and
the agent goes to the connection. This
is just one. You know what's amazing?
It's just one Neo4j
graph. It's just one Neo4j graph on the
back end and all of these technologies
that can be tested how the graphs are
being created and retrieved. It's it's
like when I think of that it's like the
most brilliant idea that we can do with
agentic memory simulations. So I get
answers from the graph. Here is the
graph. I can basically rerun uh the
commands to see what's happening on this
graph. And let me just move
on and next thing is I would like to add
to the graph that Vasilio will show how
to integrate Cognney and So I add new
information and the cipher writes it to
the
graph and then I want to do something
else. It's it's super early stage still
but then I transfer to graffiti and I
can repeat the exact same process. So I
can right now using graffiti search what
I just added and I can switch between
these different memory solutions. So
that's why I'm so excited about that.
And we do not have time to like practice
it together, do the workshop, but I'm
sure we will write some articles. So
please follow us. And I would appreciate
if you have any questions, pass them on
to Slack. I I will ask Andreas whether
we have time for a short Q&A or we need
to move it to to like breakout or
outside of the room. Take like five
minutes. Five minutes. All right. So um
that's all for for now for today. I I
really uh would like um Vasilia, Daniel
and Alex to come back to stage so you
can ask any of us. Please uh direct the
questions to to any of us and we'll try
to uh answer them. Yeah, let's go. Hi,
I'm Lucas. Um I want to ask a a
fundamental question. How do you decide
what is a bad memory over time? uh
because you you could like as a
developer and as a person we evolve the
the line of thought right so one thing
that you thought was good like three
years 10 years ago may not be good right
today uh so how do you
decide a very good question so um I I'll
answer in maybe you guys can help I will
answer in a very scientific way so
basically the one that causes a lot of
noise the noisy one doesn't make a lot
of sense
So you decrease noise by
redundancy and by relationships. So the
less relationships and the more
noisiness the so in a sense and not not
well connected node has a potential of
not being correct but there are other
ways to validate that
and would you like to follow on? Yeah,
sure. Uh, a practical way, um, we let
you model the data with Pantics. So, you
can kind of load the data you need and
add weights, uh, to the edges and nodes.
So, you can do something like temporal
waiting. You can add your custom let's
say logic and then effectively you would
know how your data is kind of evolving
in time and how it's becoming less or
more relevant and what is the set of
algorithms you would need to apply. So,
this is the idea not solve it for you,
but let help you solve it with tooling.
Uh but yeah there is depends on the use
case I would say. Yeah I don't add I
think it's a great explanation. I I
think I what I would add is that there
is missing causal causal links. Missing
causal links is what is most
probably a good indicator of fuzziness.
Yeah. Next question.
Can you hear me? How would you bet embed
in um security or privacy into the
network or the application layer? If
there's a corporate, they have top
secret data or I have personal data that
is a graph. I want to share that but not
all of
it. Oh, that's that's a really good one.
I I think I'll answer that um very
briefly. So, basically, you do have to
have that context. You do have to have
that these decisions intentions of
colonels of majors and anyone like in
the enterp like seesaw and anyone's in
in the enterprise stack and in a sense
it also gets kind of like fuzzy and
complex. So I expect this to be a very
big challenge that's that's why I want
to work in that. But I'm sure that
applying ontologies, the right
ontologies first of all to this
enterprise cyber security stack really
kind of provides this guard guard rails
for navigating this challenging problem
and and decreasing this fuzziness and
errors. Thank you. Yeah, I would also
just add like all these applications are
built on Neo forj and so in Neo forj you
can like do RO based access controls and
so you can prevent users from accessing
data that they're not allowed to see. So
it's something that you can configure
with that.
This question is for Mark.
Yeah, go on. Go on. Go on. You were
about to say something. Please go. Just
one thing like we also noticed that if
you isolate per graph per user or kind
of keep it like very physically separate
for us it really works well. People
react to that really well. So that's one
way. Yes. Independent graphs, personal
graphs. Yeah. Mark in your earlier
presentation you mentioned and this
equation that related gravity entropy
and something and also memory and
compute to IQ square. Could you show
those two again and explain them again?
Of course. Yeah. If if we have time.
Other than that um it's probably for a
series of papers to properly explain
that. So that's one memory times compute
equals I square. The other one is that
if you take all the attention diffusion
and VAS which are doing the smoothing it
preserves the sort of
asymmetries. So very briefly speaking
let's set up the vocabulary. So first of
all curvature equals attention equals
gravity. This is the very simple most
important principle here. I I will need
to when writing these papers we are
really tightly trying to define these
three next diffusion heat
entropy it's the exact same thing we
just need to align definitions and if
it's not exact same thing if there are
other definitions we need to show what's
really different and now if you think
about
attention it kind of shows the sort of
like pathways towards certain
asymmetries if you take a sphere if you
start bending that sphere and make it
like you know like you you kind of try
to extend it. Two things happen. Entropy
increases and curvature increases in a
sense and and Pearlman what he did he
proved that you can like bend these
spheres in any way. 3D spheres 4D and 5D
and higher like level spheres were
already solved. So he solved for 3D
sphere and these equations are proving
that basically there won't be any other
architectures for LMS. it will be just
attention diffusion models and VAS like
maybe not just VAS but like kind of like
something that moves uh leaves room for
biases. All right, thank you all. Uh I
really appreciate you coming. I hope it
was helpful. Thank you the guest
speakers and we'll answer the questions
uh outside of the room. Appreciate that.
Okay, we've got about uh maybe a
10-minute break before the next speaker
is up, but we've got a bit of setup to
do. So, this is a great time to grab a
coffee. Michael is going to be talking
to us
next about practical graph rag, right?
Yeah.
Hi. If you are staying for the next
session, I believe you have to go out
and get your badge scanned because
that's how they keep track of how many
people are at each session.
So, that was the directive. Thank you.
Thank you.
We'll hack later. Thanks.
Thank you. Thank you. Um,
yeah. Thank you everyone. We're closing
out this for turnover. Appreciate you.
Have a very nice presentation. I like
your way of presenting from another.
Please go out and get your batteries
scanned if you're going to stay in the
room. Let's head out because they need
to get ready. So, I will be there. Let's
talk. I'll be there in 30 seconds. Okay,
just go grab my stuff.
Am I a robot?
So very interesting. Of course. Let's
go. Yes, we will. Um, go on. Love the
physics uh connection you built there.
Can I do you write blogs about this? Can
I discover some of your um I will be
writing such like deep science like
theoretical physics papers. first
theoretical physics then I mean I have
drafts okay that are being like reviewed
it's it's it's it's really like one
second
uh so it's really challenging to kind of
question general relativity and per it's
like built on perilman and all of this
like quantum physics it's just like I I
only feel comfortable doing that when I
have very good supervisors so it takes
time I basically so the The way it was
is I was starting with like Cognney and
graffiti and me zero. We were like kind
of like building things, but I like I
want to get into science. So um follow
me on LinkedIn and on uh the website.
Okay, I can probably write some uh post
uh about it briefly. But what we are
trying to do is like do this deep
theoretical physics papers first and
after that so so papers like one to
three will be about that papers like 35
will be about relating that to uh
transformers diffusion models heat
transfer and all of these other things
and in a sense
um I I I feel like doing popular science
someone will take care of that. So, so
we are trying to do like real research.
What's your website again? Uh, it's
markbane.com. I I can show it to you.
One second.
Um,
um, could take a picture. Of course.
Yeah,
of course. Uh, can you can you end my
one second? Can you take it? Yeah.
Thanks. Yeah.
Yeah, we'll take care.
Did you get mic back?
Oh, okay. Cool.
Okay. So, he's going to be one.
Okay.
Okay, go ahead and do the count back
from five. Hello. Hello. Say 51.
Michael,
count back from five, please.
A little slower. Oh, good.
Give me a countdown back from 10. 10 9 8
7 5 6 5 4 3 2 1. All right, you're
good. So go ahead and
[Music]
this this part I'll
fix it.
Sure.
Okay, count back from five for me. Five,
four, three, two, one, zero.
Is that okay? Yeah. Yeah, that's fine.
Okay. you know best.
Beautiful.
All right. Thank you very much.
Thank you.
So, we
just at the beginning have all these
slides about like the papers. Do we want
to skip some of them? Because I had this
like summary slide that had all the
search stuff on one slide.
How do you want to do it? Was it like
slides.
I mean, I'm just going to click through
them. Okay. Yeah. So, and I'll go here,
right? So, from here. Yeah. Switch. She
said you need to stay at the podium. So,
you have to step back and then I go here
because of the live streaming. Okay.
It's going to YouTube. It's fine. Cool.
Okay. So, I'll just intro. I think we
should be up here together for the
intro. Yeah. But then if you don't want
to stand here and watch me then you can
sit down.
So you can just do this and then
Yeah.
Do you have a clicker? No, I forgot mine
at home. Do you have one? Yeah, I got
one.
I mean,
let's try.
Oh, I think just one USB
stick. Oh, USB.
We're always
ready.
Good. Now we can
That's
good. Hello everyone. Hope you had some
good coffee. Please come in. Uh we are
talking about graph rack today. That's
the graph rack trick of course. Uh and
we want to look at patterns for
successful graph applications uh for um
making LLMs a little bit smarter by
putting knowledge graphs into picture.
My name is Michael Hunga. I'm VP of
product innovation at V4J. My name is
Steven Shen. I lead the developer
relations at Neo Forj and um actually
we're we're both co-authoring. This is
fun because we're both already authors
and finally we've been friends for years
and we finally get to co-author a book.
We're co-authoring Graph Ragg the
definitive guide for O'Reilly. So
basically we didn't sleep this past
weekend because we had a book deadline.
Yep.
So, um, I'm going to talk a little bit
about kind of at a high level what graph
is, why it's important, what we're
seeing in the media, and then Michael's
going to drill down into all of the
details and patterns, and give you a
bunch of takeaways and things you can
do. This is probably if if you want to
know how to do graph rag, Michael's
quick dive on this is the best
introduction you can get. So, I'm also
excited. Awesome. Let's get going. Okay,
so the case for graph rag is where we're
going to start. And the challenge with
using LMS and using other patterns for
this is basically they they don't have
the enterprise domain knowledge. They
don't verify or explain the answers.
They're subject to
hallucinations. Um, and they have
ethical and data bias concerns. And you
can see that very much like our our
friendly parrot here. Um, they are all
the things which parrots behave and act
like except a cute bird.
So we want to do better than this with
graph rag and figure out how we can use
domain specific knowledge accurate
contextual and explainable answers. And
really I think like what a lot of
companies and what the industry is
figuring out is it's really a data
problem. You you need good data. You
need to have data you can power your
system with. Um one of the patterns you
can do this with is rag. So you can
stick your external data into into a rag
system. you can get stuff back from a um
a database for the pattern, but vector
databases and rag fall short because
it's it's lacking kind of your full data
set. It's it's only pulling back a
fraction of the information by vector
similarity algorithms. Typically, a lot
of the especially modern vector
databases which everyone's using,
they're they're easy to get started
with, but they're not robust. They're
not mature. They're not something which
has scalability and fallback and gives
you that what you need to get into build
a strong robust um enterprise system and
vector similarity is not the same as
relevance. So results you get back from
using a basic rag system. They're they
give you back things which are related
to the topic but it's not complete and
it's typically also not very relevant.
And then it's very hard to explain
what's coming out of the system. So we
need answer lifeline. Yeah. Graph rag.
And what graph is is we're
bringing the re we're bringing the
knowledge and the context in the
environment to what LLMs are good at. So
you can think of this kind of like the
human brain. Our our left brain is um
our right brain is more creative. It
does more like like building things. It
does more um extrapolation of
information. Whereas our left brain is
the logical part. That's what actually
has reasoning, has facts, and can enrich
data. And it's built off of knowledge
graphs. So, a knowledge graph is a
collection of nodes, relationships, and
properties. Here's a really simple
example of a knowledge graph where you
have two people. They they live
together, you have a car, but when you
look into the details, it's actually
like a little bit more complex than it
seems at first because they they both
have a car, but the owner of the car is
not the person who drives it. This this
is kind of like my family. My wife does
all the bills, but then she hands me the
keys whenever we get on the freeway. She
she hates driving. So, knowledge graphs
also are a great way of getting really
rich data. Um, here's an example of the
Stack Overflow graph built into a
knowledge graph where you can see all of
the rich metadata and the complexity of
the results. And we can use this to
evolve rag into a more complex system,
basically graph rag, where we get better
relevancy. We're getting more relevant
results. we get more context because now
we can actually pull back all of the
related information by graph closeness
algorithms. We can explain what's going
on because it's no longer just um
vectors. It's no longer statistical
probabilities coming out of a vector
database. We actually have nodes. We
have structure. We have semantics we can
look at and we can add in security and
role-based access on top of this. So
it's contextrich, it's grounded. This
gives us a lot of power and it gives us
the ability to start explaining what
we're doing. where now we can we can
visualize it, we can analyze it and we
can log all of this. Now um this is one
of the the initial papers the the graph
rag paper from Microsoft research where
they went through this and they did they
showed that you could actually get not
only better results but less token
costs. It was actually less expensive to
do a graph rag algorithm. Um there have
been a lot of papers since then which
show all of the different research and
interesting work which is going on in
the graph rag area and um this is just a
quick view of the different studies and
results which are coming out but even
from the early data.orld study where
they showed a three times improvement in
graph rag
capabilities and the analysts are even
showing how graph rag is trending up. So
this is the um Gartner um kind of hype
cycle from from 2024 and you can see
generic AI is kind of you know on the
downtrend. Rag is getting over the hump
but graph rag and a bunch of these
things actually are providing and
breathing more life into the AI
ecosystem. So a lot of great reports
from from Gartner showing that it's
grounded in facts. It resolves
hallucinations together. knowledge
graphs and AI are solving these problems
and it's getting a lot of adoption by
different industry leaders by big
organizations um who are taking
advantage of this and actually producing
production applications and making it
work like LinkedIn customer support
where they actually wrote this great
research paper where they showed that
using a knowledge graph for customer
support scenarios actually gave them
better results and allowed them to
improve the um quality and reduce the
response time for getting back to
customers. Um, median perissue
resolution time was reduced by
28.6%. I mentioned the data.world study
which basically was a comparison of
doing um, rag on SQL versus rag on graph
databases and they showed a three times
improvement in accuracy of LM responses
and let's chat about patterns Michael
because I think everyone's here to learn
how to do this. Exactly. So let's let's
look at how to do this actually. Right.
So and um if you look at graph rack uh
there actually two sides to the coin. So
one of course you don't start in a
vacuum you have to create your knowledge
graph right. So VC basically multiple
steps to get there. Initially you get
unstructured information. You
substructure it. You put it into a
lexical graph which represents documents
chunks and their relationships. In a
second step, you can then extract
entities using for instance LLMs with
this graph schema to extract entities
and relationships from that graph. And
in a third phase, you would enrich this
graph for instance with graph algorithms
doing things like you know page rank,
community summarization and and so on.
And then when you have this uh built-up
knowledge graph, then you do graph rack
as the as the search mechanism um either
with local search or global search and
um other ways. Right? So let's first
look at the first phase of like
knowledge graph construction a little
bit. Um so like always in data
engineering there is if you want to have
higher quality outputs you have to put
in more effort at the beginning right soit's basically nothing comes for free.
There's no free lunch after all. But
what you do at the beginning is
basically paying off multiple times
because what you get out of your
unstructured documents is actually
highly high high quality high structured
information which you then can use to
extract contextual information for your
for your queries which allows the rich
retrieval at the
end. Okay. And so after seeing uh graph
rack being used uh by a number of users
customers we've seen uh we looked at
research papers we we saw that a number
of patterns emerging uh in terms of like
how we structure our graphs how we query
these graphs and so on and so we started
to collect these patterns and put them
on graph.com
um and we want to I wanted to show what
what this looks like. So we have
basically uh example graphs uh in the
pattern the pattern has a name
description uh context and we see also
queries that are used for extracting
this information. Right? So for instance
here's an uh mix of a lexical graph and
a domain graph and then we can have the
query that fetches uh this information.
Let's look at the three steps in a
little bit more detail on the um on the
graph model side. So on one side we have
uh for lef figure graphs you documents
and the elements. So that could be
something simple as a chunk. But if you
have structured element documents, you
can also do something like okay have a
book which has chapters which have
sections which have paragraphs where the
paragraph is the semantically cohesive
unit that you would use to for instance
create a vector embedding of that you
can use later for vector search. But
what's really interesting in the graph
is basically you can connect these
things all up right so you know exactly
who's the predecessor who's the
successor to a chunk who's the parent of
an element and using something like a
vector or text similarity you can also
connect these uh chunks as well by an K
nearest neighbor or similarity graph
where you basically store similarities u
between chunks and then you put on the
relationship between them and an and
weighted score basically how similar the
two chunks and then you can use all
these relationships when you extract the
context in the retrieval phase to for
instance find what are related chunks by
document by uh temporal sequence by
similarity and other things right so
that's on the on the lexical side um
this looks like this so if for instance
you have an RFP and you want to break it
up in a structured way then you
basically create the relationships
between these chunks uh or the the these
subsections at the text do the vector
embeddings and then you do it at scale
and then you get a full uh lexical uh
graph graph out of that. Next phase is
entity extraction. Uh which is also
something that has been around for quite
some time with NLP but LLMs actually
take this to the next level with their
multi- language understanding with their
high flexibility good language skills
for extraction. So you basically provide
an graph schema and an um instruction
prompt to the LLM plus your pieces of
information, pieces of text. Now with
large context windows you can then put
in 10,000 100,000 tokens for extraction.
If you have you can also put in already
existing ground truth. So for instance,
if you have ex existing structure data
where your entities, let's say products
or genes or partners or clients are
already existing, then you can also pass
this in as part of the prompt. So that
the LLM doesn't do an extraction, but
more an recognition and and finding um
approach where you find your entities
and then you extract relationships from
them and then you can store additional
facts and and uh additional information
that you store uh as part of
relationships and entities as well. So
basically in the first part you have the
lexical graph which is representing
document structure. But then in the
second part you extract the relevant
entities and their relationships. If you
have already an existing knowledge graph
you can also connect this to an existing
knowledge graph. So imagine you have an
um CRM where you already have customer
clients uh and and leads in your
knowledge graph but then you want to
enrich this with for instance uh
protocols from call transcripts and then
you basically connect this to the
existing structure data as well. So
that's also a possibility and then in
the next phase what you can do is you
can run graph algorithms for
enrichment which then for instance can
do clustering on the entity graph and
then you generate uh something like uh
communities where an LLM can generate
summaries uh across them as such right
and uh for especially last one it's
interesting because what you identify is
actually cross document uh topics right
so because it's basically each document
is an basically temporal uh vertical
ical representation of information. But
what this is is actually it looks at
which topics are reoccurring across many
different documents. So you find these
kind of topic clusters across uh
documents as well. Cool. So if you look
at the the second phase, the search
phase, which is basically retrieval uh
part of red. What we see here is
basically that in a graphic retriever
you don't just do a simple vector look
up to get uh returns uh results returned
but what you do you do an initial index
search it could be vector search full
text search hyper search spatial search
other kinds of searches to find the
entry points in your graph and then you
basically uh can take as you can see
here um starting from these entry points
you then follow the relationships up to
a certain degree or up to a certain
relevancy to fetch in uh additional
context and this context can be coming
from a user question. It can be external
user context that comes in. For
instance, when someone from let's say
your uh finance department is looking at
your data, you return different
information and if someone from the
let's say engineering department is is
looking at your data, right? also takes
this external context into account how
much and which context you retrieve and
then you return to the LLM to generate
the answer. Not just basically text
fragments like you would do in vector
search but you also create the return
these um more complete uh subset of the
of the contextual graph uh to the LLM as
well. And modern LLMs are actually more
trained on uh graph processing as well.
So they can actually deal with these uh
additional pattern structures where you
have uh node relationship node patterns
uh that you provide as additional
context uh to the LLM. Um and then of
course I mentioned that you can enrich
it using graph algorithms. So basically
you can do things like uh clustering,
link prediction, pitch rank and other
things to enrich your data. Cool. Let's
look at some uh practical examples. We
don't have too much time left. Uh so one
is knowledge of construction from
unstructured sources. So there's a
number of libraries. Uh you've already
heard some uh today from people that do
these kind of things. Um so one thing
that we built is an a tool that allows
you to take PDFs uh YouTube uh
transcripts uh local documents, web
articles, Wikipedia articles and it
extracts your uh data into an graph. And
let me just switch over to the to the uh
demo here. Uh so this is the this is the
tool. uh so I uh uploaded uh information
from different Wikipedia pages, YouTube
videos, articles and so on. And here's
for instance an Google DeepMind uh
extraction. So you can use a lot of
different LLMs here. And then you can
also if you want to in graph enhancement
provide graph schema as well. So you can
for instance say a person uh works for
uh a company and uh add these patterns
uh to your um to your schema and then
the LLM is using this information to
drive the extraction uh as well. And so
if you look at the data that has been
extracted from uh deep mind that is this
one here we can actually
see from the Wikipedia article um two
aspects. one is the document with the
chunks which is this uh part of the of
the graph right and then the second part
is the entities that have been extracted
from from this uh article as well. So
you see actually the connected knowledge
graph of entities which are companies,
locations, people and technologies. So
it followed our um followed our schema
to extract this and then if I want to
run graph rack you have here a number of
different retrievers. So we have vector
retriever, graph and full text, entity
retrievers and others uh that you can
select. Uh all of this is also an open
source project. So you can just go to
GitHub and have a look at this. And so I
just ran this before because internet is
not so reliable here. So what has deep
mind worked on? And I get an detailed
explanation. And then if I want to I can
here look at details. So it shows me
which sources did it use. Alphafind
Wikipedia another PDF. I see which
chunks have been used which is basically
the full text and hybrid search. But
then I also see which entities have been
used from the graph. So I can actually
really see from an explanability
perspective these are the entities that
have been retrieved by the graph
retriever passed to the LLM in addition
uh to the text that's connected to these
entities. So it gets an richer response
uh as such and then you can also do eval
on that with with feras as
well. Um so while I'm on the screen uh
let me just show you another thing uh
that we worked on which is more like an
engetic approach where you basically put
these individual retrievers into an an
configuration where you have basically
domain specific retrievers uh that uh
are um running individual suffer
queries. So for instance, if you look at
uh let's say this one, it has uh the
query here and basically a tool with
inputs and a description and then we can
have an agentic um loop using these
tools basically doing uh graphic with
each individual tool taking the
responses and then doing uh deeper uh
tool calls. Uh I'll show you an deeper
example in a in a minute. So this is
basically what I showed you. This is all
available as uh open source libraries.
You can use it yourself in from Python
as well. Uh it showed neo converse which
is also able not to just output text but
also uh charts and other visualizations
uh networks uh visualizations as well.
And what's interesting here in the
agentic approach, you don't just use
vector search to retrieve your data, but
you basically break down a user question
into individual tasks and extract
parameters and run these individual
tools. Um, which then are either run in
sequence or in a loop to uh return the
data. And then you get basically these
uh outputs back and uh basically for
each of these things different
individual tools are called and and used
here. And the last thing that I want to
show is the uh graphite python package
uh which is basically also encapsulating
uh all of this in construction and the
retrieval into one package. So you can
build the knowledge graph. You can
implement the retrievers and create the
pipelines here. And here's an example of
where I pass in uh PDFs plus a graph
schema and then basically uh it runs uh
the import into NEFJ and then I can uh
in the Python notebook visualize uh the
data later on. And with that I leave you
with one second uh the takeaway which is
on graph.com you find all of these
resources a lot of the patterns and uh
we'd love to have contributions and love
to talk more. I'm outside at the at the
booth if you have more questions. Yeah.
So now that was great and I think you're
getting it all from the expert with all
the tooling. Actually Michael's team
builds a lot of the tools like knowledge
graph builder. Um, very excited you all
came to the graph rag track and hope to
chat with you all more. If you have
questions for me and Michael, just meet
us in the Neo Forj booth across the way.
Thank you. Thank you.
Thank you. Thank you, Michael and
Stephen. That was fantastic. My my big
takeaway was that there is so much to
look at. It's amazing.
[Music]
This is uh this one for power
Wi-Fi. Okay. Thank you so much. So in
this next talk is going to be taking us
through a multi- aent framework for
network analysis. Is this right?
Correct. Fantastic. Correct. Looking
forward to it. Yes. Awesome.
I'm so sorry.
So that we could get a sound. All right.
One, two, three, four,
five. Five, four, three, two, one.
Microphone check. One, two, one,
two. All right. Good afternoon,
everyone. My name is Hola Mabad. I'm a
product guy from Cisco. Um, so my
presentation is going to be a little
more producty than techie, but um, uh, I
think you're going to enjoy it. And so,
um, I've been at Cisco working on, uh,
AI for the last three years. And, um, I
work in this group called outshift. So,
outshift is Cisco's incubation group. uh
our charter is to help Cisco look at
emerging technologies and see how this
emerging technologies can help us
accelerate the road maps of our
traditional business units and uh so um
by uh by training I'm electrical
engineer um doubled into network
engineering enjoyed it and I've been
doing that for a while but over the last
three years focused on AI um our group
also focuses on quantum technology so
quantum networking is something that
we're focused on and um if you want to
learn more about what we do. Uh we
outshift at Cisco. Uh you can learn more
about that. So uh for today we're going
to dive into this uh real quick and um
like I said I'm a product guy. So I
usually start with my customers problems
trying to understand what are they
trying to solve for and then from that
work backwards towards creating a
solution for that. So as part of the
process for us we usually go through
this incubation phase where we ask
customers a lot of questions and then we
come up with prototypes we do a testing
b testing and then we kind of deliver an
MVP into a production environment and
once we get product market fit that
product graduates into the Cisco's
businesses so this customer had this
issue they said when we do change
management we have a lot of challenges
with failures in production how can we
reduce that can we use AI to reduce that
So we double clicked on that problem
statement and we realized it was a major
problem across the industry. I won't go
into the details here but it's a big
problem. Now uh for us to solve the
problem we wanted to understand does AI
really have a place here or it's just
going to be rulebased automation to to
solve this problem. And we looked at the
workflow we realized that there are
specific spots in the workflow where AI
agents can actually help address a
problem. And so we we kind of
highlighted three, four and five where
we believe that AI agents can help
increase the value uh for customers and
reduce the pain points that they were
describing. And so we sat down together
with the teams. We said let's figure out
a solution for this. Um and so uh this
solution consists of three big buckets.
The first one is the fact that it's a it
has to be natural language interface
where network operations teams can
actually interact with the system. So
that's the first thing and not just
engineers but also systems. So for
example in our case we built this system
to talk to an ITSM tool such as service
now. So we actually have a agents on the
service now side talking to agents on
our side. Um the second piece of this is
a multi- aent system that sits within
the within this application. So we have
a agents that are tasked at doing
specific things. So an agent that stacks
as doing impact assessment, doing
testing, doing uh reasoning around uh
potential failures that could happen in
the in the network. And then the third
piece of this is where we're going to
spend some of the time today, which is
network knowledge graph. So we have a a
the concept of a digital twin in this
case. So what we're trying to do here is
to build a twin of the actual production
network. And that twin includes a
knowledge graph plus a set of tools to
execute test testing. And so, um, we're
going to dive into that in a little bit,
but before we go into that, I I we we
had this challenge of, okay, we want to
build a representative representation of
the actual network. How are we going to
do this? Um, because if you know
networking pretty well, networking is a
very complex uh technology. You have a
variety of vendors in a customer's
environment, variety of devices,
firewall, switches, routers, and so on.
And then all of these different devices
are spitting out data in different
formats. So the challenge for us was how
can we create a representation of this
real world network using knowledge
graphs in a data schema that can that
can be understood by agents. And so the
goal was for us to create this ingestion
pipeline that can represent the network
in such a way that agents can take the
the right actions in a meaningful way
and predictive way. And so for us to to
kind of proceed with that we had this
three big buckets of things to consider.
So we we had to think about what are the
data sources going to be. So if you
again in networking there controllers
systems there the devices themselves
there agents in the devices there are
configuration management systems all of
these things are all collecting data
from the network or they have data about
the network. Now when they spit out
their data they're spitting it out in
different languages Yang JSON and so on.
another set of considerations to have
and then in terms of how the data is
actually coming out it could be coming
out in term of streaming telemetry it
could be configuration files in JSON it
could be some other form of of data how
can we look at all of these three
different considerations and be able to
set come up with a set of requirements
that allows us to actually build a
system that that addresses the
customer's painoint again and so um the
team uh from a product side we had a set
of requirements we we wanted a system
that uh a knowledge graph that can have
multimodal flexibility
uh that means you can talk key value
pairs, you understand JSON files, he
understands uh relationships across
different entities in a network. Second
thing is performance. Uh if a if an
engineer is quering a knowledge graph,
we want to have instant access to the
node information about the node no
matter where the the location of that
node is. That was important for our
customers. The second thing was
operational flexibility. So the schema
has to be such that uh we can
consolidate into one schema framework.
Uh the fourth piece here is where the
the the rag piece comes into place. So
we've been hearing a lot about graph rag
for for for a little bit today. Uh we
wanted this to be a system that has
ability to have vector indexing in it so
that when you want to do semantic
searches at some point you can do that
as well. And then in terms of just
ecosystem u um stability, we want to
make sure that when we put this in the
customer's environment, uh there's not
there's not going to be a lot of heavy
lifting that's going to be done by the
customer to integrate with their systems
and again it has to support multiple
vendors. So these were the requirements
from a product side and then our
engineering teams kind of we started to
consider some of the options on the
table. Uh new forj obviously market
leader uh and the various other open
source tools. At the end of the day the
engineering teams decided to kind of do
uh some analysis around this. So I can
I'm showing the table on the right hand
side. It's not an exhaustive list of
things that they considered but this
were the things that they looked at that
they wanted to see okay what is the
right solution to address the
requirements coming from product and um
uh we they kind of we kind of all
centered around the first two here no 4G
and Arango DB but for historical reasons
the team decided to go with Arango DB
because we had some use cases that were
in the security space uh that was kind
of a recommendation system uh type of
use cases that we wanted to kind of
continue using and so um But we are
still exploring the use of neo forj for
some of the use cases that are coming up
as part of this project. So um we
settled on on a rangodv for this and uh
we eventually came up with a solution
that looks like this. So we have this
knowledge graph solution. This is an
overview of it. Um on the left hand side
we have all of the production
environment. We have the controllers the
the splunk which is a sim system traffic
telemetry coming in. All of them are
coming into this ingestion service uh
which is doing an ETL transforming all
of this information into one schema open
config. So open config schema is a
schema that is designed around
networking primarily and uh it helps us
to because there's a lot of
documentation about it on the internet.
So LM understand this very well. So um
this setup is primarily a a database of
uh of uh networking information that has
open config schema as a primary way for
us to communicate with it. So uh natural
language communication through an
individual engineer or the agents that
are actually interacting with that
system. And so we built this in the form
of layers. So uh if you if you're if
you're into networking again um there is
a set of entities in the network that
you want to be able to interact with. Uh
so we have layered this up in this way
such that if uh there's a tool call or
there's a decision to be made about a
test for example let's say you want to
do a test about uh configuration drift
as an example um you don't need to go to
all of the layers of the graph you just
go straight down to the raw
configuration file and be able to do
your comp comparisons there. If you're
trying to do like a test around
reachability for example then you need a
couple of layers maybe you need raw
configuration layers data control data
plane layers and control plane layers.
So um it's structured in a way that when
the agents are making their calls to
this system uh they understand what the
request is from the from the uh system
and they're able to actually go to the
right layer to pick up the information
that they need to ex to execute on it.
So this is kind of a high level view of
what the graph system looks like in
layers. Now
um I'm going to kind of switch gear
switch gears now and go back to the
system. Remember I described a system
that had agents a knowledge graph and
digital twin as well as natural language
interface. So let's talk about the
aentic layer and before I kind of talk
about a specific agent in um in this
system on this application we are
looking at how we are going to build a
system that is based on open standards
for all of the internet and this is one
of the challenge we have within Cisco.
We we are looking at a system a a set of
a collective open source collective that
includes all of the partners we see down
here. So we have uh outshift by Cisco we
have lang chain Galileo we have all of
these uh members who are supporters of
this uh of this collective and what
we're trying to do is to set up a system
that allows agents from across the
world. Uh so it's a big vision uh that
they can talk to each other without
having to do heavy lifting of
reconstructing your agents every time
you want to integrate them with another
agent. So it consists of identity uh
schema framework for defining an agent
skills and capabilities the directory
where you actually store these agents
and then how you actually compose the
agents both at the semantic layer and
the synthetic layer and then how do you
observe the agents in process all of
these are part of this collective uh
vision as as as a group and if you want
to learn more about this is on
agency.org RG and I also have a slide
here that kind of talks about um there's
real code actually that you can leverage
today or if you want to contribute to
the code uh you can actually go there
there's a GitHub repo here that you can
go to and and you can start to
contribute or use use the use the data
um there's documentation available as
well and there's sample applications
that allows you to actually see how this
works in real life and uh um we know
that there's MCP there's A2A all of
these protocols are becoming uh very
popular uh we also integrate with all of
these protocols because the goal again
is not to uh create something that is
bespoke. We want to make it open to
everyone to be able to create agents and
be able to make these agents work in
production environments. So back to the
specific application we're talking about
based on this framework, we delivered
this set of agents uh we build a set of
agents as a group. So we have five
agents right now as part of this
application. Um there's an assistant
agent that's kind of the planner that
kind of orchestrates things across the
globe across all of these agent agents
and then we have other agents that are
all based on react reasoning loops.
There's one particular agent I want to
call out here the query agent. This
query agent is the one that actually
interacts directly with the knowledge
graph on a regular basis. Um we have to
fine-tune this agent because um we
initially started by doing a uh
attempting to use rag to do some
querying of the knowledge graph but that
was not working out well. So we decided
that for immediate results, we're going
to fine-tune it. And so we did some
finetuning of of the of this agent with
some schema information as well as
example queries. And so that helped us
to actually reduce two things. The
number of tokens we were burning because
every time we were before that the AQL
queries were going through all of the
layers of the knowledge graph and in a
in a reasoning loop was consuming lots
of tokens and taking a lot of time for
it to result to return results. after
fine-tuning, we saw a drastic reduction
in number of tokens consumed as well as
the amount of time it took to actually
come back with a result. So that kind of
helped us there. Um so um I'm going to
kind of pause here. I'm talking a lot
about there's a lot of slide wear here.
I want to show a quick demo of what this
actually looks like. So tying together
everything from the natural language
interface interaction with an ITSM
system to how the agents interact to how
that collects information from knowledge
graph and delivers results to the
customer. Okay. Yeah. So um the scenario
we have here is a a network engineer
wants to make a change to a firewall
rule. They have to do that to
accommodate a new server into the
network. And so what they need to do is
to first of all start from ITSM. So they
submit a ticket in uh in their
in service now. Now our system here the
the v the UI I'm showing here right here
is the UI of the actual system we've
built the application we built. We have
ingested information about the uh
tickets here in natural language and so
the agents here are able to actually
start to work on this. So I'm going to
play a video here just to make it uh uh
more relatable. So the first thing
that's happening here is that these
agents uh the first agent is asking that
the inter for the for the information to
be synthesized in a summarized way so
that they can understand uh what to
quickly do. The next action that has
been asked here is for you to create an
impact assessment. So impact assessment
here just means that I want to
understand will this change have any
implications for me beyond the immediate
uh target area and that's going to be
summarized and we are now going to ask
the agent that is responsible for this
particular task to go and attach this
information into the ITSM ticket. So I'm
going to say uh attach this information
about the impact assessment into the
ITSM ticket. So that's been done. Now
the next step is to actually create a
test plan. So test plan is one of the
biggest problems that our customers are
facing. Um they they run a lot of test
but they miss out on the right test to
run. So these agents are actually able
to reason through a lot of information
about test plans across the internet and
based on the intent that was collected
from the service now ticket is going to
come up with a list of tests that you
have to run to be able to make sure that
this firewall rule change doesn't make a
big impact or create problems in
production environment. So, as you can
see here, this agent has gone ahead and
actually listed all of the test cases
that needs to be run and the expected
results for each of the tests. So, we're
going to ask this agent to attach this
information again back to the ITSM
ticket because that's where the approval
board needs to see this information
before they implement before they
approve the implementation of this
change in production environment. So, we
can see here that that information has
now been attached back by this agent to
the ITSM tickets. So, two separate
systems but agents talking to each
other. Now the next step is actually run
a test on all of these test cases. So um
in this case the configuration file that
is going to be used to make the change
in the firewall is sitting in the GitHub
repo. And so we're going to do a pull
request of that config file and going to
take that information. So this is the
GitHub repo where the where we're going
to do a pull request. We're going to
take the link for that pull request and
paste it in the
ticket and so that when the executor
execution agent starts doing its job is
actually going to pull from that and use
it to run this test. So um at this
moment we we have we're going to start
running the test. We're going to ask
this agent to go ahead and actually run
the test and execute on this test. And
so um I have attached the change sorry I
don't have my glasses. I've attached my
uh change candidates to the ticket. Can
you go ahead and run the test? So what
is going to happen here is if you look
on the right hand side of this screen
here, a series of things are happening.
The first thing is that the this agent
called the exeutor agent goes looks at
the test cases and then it goes into the
knowledge graph and it's going to go
ahead and actually do a snapshot of the
most recent visual or most recent
information about the network. is now
going to take the pull request that it
pulled from GitHub, the snapshot it just
took from the knowledge graph. It's
going to compute it together and then
run all of the individual test one at a
time. So we can see that it's running
the test one test, test one, test two,
test three, test four. So all of this is
happening in what we call a digital
twin. So a digital twin again is a cons
combination of the knowledge graph, a
set of tools that you can use to run the
test. So an an example of a tool here
could be batfish or could be routnet or
some other tools that you use for
engineering for network engineering
purposes. So once all of these tests are
completed uh this tool actually is going
to this agent is going to now generate a
report about the test results. So um we
give it some time to run through this.
It's still running the tests but when it
once it concludes all of the tests it's
going to report what actually uh the
test results are. So which results which
tests actually passed which ones failed.
for the ones that have failed is going
to make some recommendations of what you
can do to go and fix the problem. Um um
I'm going to skip to the front here to
just quickly get this on uh done quickly
because of time. Um so um it's attached
the results to the ticket and this is
the report that it's spitting out in
terms of this is the report for the test
that were run. So this execution agent
actually created a report about all of
the different test cases that were run
by the system. So um very quick short
demo here. Uh there's a lot of detail
behind the scenes but I can answer some
questions offline. Um the the the couple
of things I want to leave us with is
that uh before I go to the end of this
uh is that evaluation is very critical
here for us to be able to able to
understand how this delivers value to
customers. Um we're looking at a variety
of things here. So the agents themselves
the knowledge graph digital twin and
we're looking at the what can we
actually measure quantifiably. Now for
the knowledge graph, we're looking at
extrinsic metrics particularly not
intrinsic ones because we want to map
this back to the customer's use case. So
this is the summary of the of what we
see in terms of evaluation metrics. Um
we are still learning this is a this is
for for now it's it's an MVP. Um but
what we are learning so far is that
those two key building blocks the
knowledge graph and an open framework
for building agents is very critical for
us to actually build a scalable system
for our customers. And so, um, I'm going
to stop with 8 seconds to go. Thank you
for listening to me. And then if you
have questions, I'll be out there.
Yeah.
Thank you so much, Ola. That was
fantastic. I love getting a deep dive
and always a perspective from a product
guy is always good to hear. Keep us set
in reality. Thank you.
So for for the graph track closing out
the day on this track, it's gonna be my
friend Tom Smoker from
YAL who's gonna be talking about legal
documents and how to turn those into
knowledge, right? Yeah, part of it.
Yeah. Awesome.
Quick check on your audio.
Five, four, three, two, one.
Back up. Still up. Oh, there you are.
Beautiful.
Okay.
Cool. Thanks everyone.
Um, when we're ready, ABK, just let me
know.
Good. Cool. I can't see a whole lot.
Thank you. I'll get started. Okay. Uh,
yes. Oh, no. Stand by. One moment. We
got to change the reports. No worries.
The drives. I'm sorry.
Okay, we're ready. Thank you. Thank you.
I have bad eyesight and an Australian
accent. So, this is a not a great
combination. So, I appreciate you
working with me. Thank you. Uh, hello
everyone. I am here to talk about graph
rag as we're here for the track, but I'm
talking about what to do in the legal
industry and what we do in the legal
industry and what does it look like to
turn documents into graphs and use those
graphs in the age of
AI. I tend to have to qualify why I'm at
places. Uh, there's various reasons why
I could be talking today. Uh, you choose
the one that you want to, but generally
I've been working on graphs for about a
decade. Uh I have a good relationship
with the near forj team uh and I've been
doing graphs for a long time but
primarily I am the technical founder of
a company called yhar.ai and we find
cases first uh before lawyers do and
then give them to lawyers. Now how we
find these cases is a process that I'll
go through but we use a variation of
graphs multi- aent systems signals etc.
And I'll detail through today how we do
that at a high level and a low level.
And I'm happy to answer questions at any
point. This is broadly what we do. We
work in law. This is an example. We find
class action mass cases before other
people do. Um we have agents. Uh we have
graphs. We store that information. We
scrape the web. We qualify that with a
proprietary process. And uh we deal with
lawyers every day and understand exactly
how they think and build these cases.
And the cases I'm referring to would be
like many people used a pharmaceutical
product. That product has caused them
harm. Science has proved that harm and
we can collect those people and
collectively sue the pharmaceutical
company. So we support the law firms
that do that. And as I'm talking and
everyone here for a graph rag track can
start to imagine that I'm starting to
develop a bit of a schema there. I'm
describing individuals. I'm describing
products. Those products have
ingredients. Those ingredients have
concentrations. Those concentrations may
have an ID number. And all of a sudden
you can start to imagine there is this
largeworked schematized bit of data that
has particular points in it that are
very valuable and very visual and very
useful to domain
experts. So I'm going to start to use
some definitions because there is
knowledge graphs have been around for a
long time and ABK would know that more
than I would. But I started my PhD and
well my masters in graphs in 2016 and it
was not nearly as popular as it is now
and it's fascinating to see how far it's
come. But I do think it's important for
me to define how we use them and how we
think about
them. Broadly to me, graphs are
relations. That's part of the visual
element. There's a backend element as
well. But it's the benefit of using
graphs is that I can see what is
connected to something else. I can be
explicit about what is connected to
something else. And I can do mass
analytics on what is connected to
something else. All the way from I can
see it down to I can do large scale
analytics on it. Is the value of the
relations. And when I use relations,
it's not necessarily node to node. It
can be node to node to node. It can be
multihop. It can be as varied and as
forked and as distributed as you want.
This is why we use graphs in our
process. Broadly throughout the process
of running this company and previously
as an academic, this is what I think is
easy about graphs. People look at them
and go well that's fantastic. I have a
great understanding of what this is. And
someone else says me too. And there
isn't necessarily a consistency in what
those two people just said. They may
have a different understanding of what
is
represented broadly throughout my
career. These are the things that are
difficult about graphs, right? And you
can say that they're nodes connected to
edges. You can say they're distributed.
You can say they're backed up. There's a
variety of ways in which people use the
data uh that they have, the way they
store it, and the way they talk about
it. And now, as graphs have become very
necessary and consistent for things like
graph, rag, for things like structured
data, etc. More and more people are
coming to this relatively niche area
previously that even at the time wasn't
necessarily agreed upon what it was. So
I do like to define what it is we're
using. So graphs and multi-agent
systems, these are the two things that I
want to define as there's a variety of
ways that people use
them. This is how we use multi- aent
systems, right?
So now multi-agent systems are all the
way from very specifically define what
you're dealing with and chain those
together and use an LLM to glue it all
together or it is in our case break down
a complicated white collar workflow down
into a specific set of steps that I can
IO test right and each of those steps
have different requirements different
frequencies different state and that
state can be controlled often in our
case by a graph
This is why we like to use them when
we're building an application for the
legal industry. Not sure if you guys
know this, but lawyers don't really like
when things are incorrect, right? It is
basically the whole industry is make
this very specifically correct and
proper and definitely in the right
language. So when it comes to building
applications, probabilistic large
language models don't necessarily work
for that just in isolation. I need to
have a very specific control and
structure and schema for the way that we
build these systems. and I need to be
able to test and be able to pinpoint
exactly what is going right and wrong at
any point in
time. Here are some of the issues with
that, right? And we've heard about multi
well, at least I've heard about
multi-agent systems a lot. I'm sure
other people have as
well. Sometimes the part in the workflow
is much more important than the other
part. Sometimes there's parts in the
workflow I don't particularly care
about. Uh there are also agents in the
world. Agents imply that these things
are very capable, but I can write a bad
prompt very easily and all of a sudden I
have a bad agent. So when it comes to
what is the agent that I trust, very
few. We spend a lot of time guardrailing
as much as we possibly can. We spend
time making sure that the memor is not
just immediate but it's episodic. We
spend time capturing the information
state over time and then pruning that
state. And again to bring it back,
capturing, expanding, pruning,
structuring and then querying state for
us happens in a graphical format because
the necessity of having the structure,
having the extendability and then having
the ability to remove that extension is
really important for us. Then finally,
I'm trying not to make this too in deep
depth and too many numbers,
but 95% accuracy for a single agent, I
think, is a tall order at this point.
Maybe people have entirely accurate
agents. I'm very happy for you. I don't
have that exactly right now. I have
systems that I can put in place like
guardrails and humans in the loop that
can bring these agents to a point that
it is accurate enough that people are
willing to use them. However, five 95%
accurate agents chained together
sequentially. That's 77% expected
accuracy. That's not that many agents in
a row. If you think about a workflow,
that's five steps. And if I'm basically
saying that if each of those five steps
are 95% accurate, already quite a hard
thing to ask, especially if there's an
LLM involved, now we're at 77% of the
time it gets to the end of that workflow
in the way that I want. That is part of
probably if I was to summarize my main
problem, it would be that it' be
decision-m under uncertainty throughout
the process of building these
systems. That's the background. That's
that's how we understand these systems.
We use multi- aent systems and we're
naturally skeptical. We use graphs every
day and we have a natural skepticism of
exactly how these things are stored and
structured. But we use them specifically
and consistently in the way that we
like. So I am using the term agent
because everyone's using the term agent.
We build litigation agents. Litigation
is the process of well I'm going to
summarize but we work with class
action/masstor law as I said before get
everyone together they were harmed put
that harm all in place and then sue a
pharmaceutical company. Now, we don't do
any of the litigating as a company or
the suing, but we do support the lawyers
who do that. We do that in a few
different
ways. Here is one of the ways that we
look at the legal industry. Right?
Without exception, everything needs to
be perfect. It needs to be accurate. It
needs to be written in the correct way.
Right? There's also once you have that
correct format, creative arguments. The
best lawyers are very very very detail-
oriented and then very very creative in
the way that they can apply those
details to a case. For example, there
was an issue with uh Netflix and they
were uh capturing data from their users
as they do and they should and I'm a
Netflix user and they capture my data
and I appreciate it because they give me
the better shows that I'd like to watch.
However, there is a legal limit as to
how much information they can capture
from me, right? And you cannot surpass
that legal limit or you can but then you
can go into the process of litigation.
Now, if you surpass that, there needs to
be a precedent as to why someone could
say, "You cannot capture this much
information." And the particular
precedent I'm referring to is many years
ago, Blockbuster was sued by keeping too
many details about the literal physical
DVDs that people rented. That is a
reasonably creative way to say, "Look, I
remember that Blockbuster happened, and
what Netflix is doing isn't that
different. It may be in a digital
format. It may be at a larger scale. It
may be into an algorithm instead of
someone who's recommending it. However,
that is an interesting application of
what I'm doing.
So these problems then which is ne
necessary accuracy and then creativity
on top of that accuracy and then all of
that information is kept in separate
places and a lot of that creativity
comes from the latent knowledge in the
expert's head starts to come to a bit of
a four when you say well I have these
probabilistic agents that you could
argue aren't that creative right I have
these agents that most of the time do a
pretty good job and can be creative in a
way that frankly can be quite
frustrating especially to a lawyer
So, this butts heads in terms of exactly
how lawyers want to deal with this
information. And again, I'm painting a
very broad brush. I'm not a lawyer. My
co-founder is. If anyone is a lawyer in
the audience is offended, I do
apologize. But this is broadly what I've
seen to be
accurate. We help with legal discovery
as well, right? Like I described before,
there could be an unnamed pharmaceutical
company. A pharmaceutical company's
great, but they happen to have done some
harm, right? And it is in their best
interest to give all of the information
to the law firm and describe exactly
well not exactly describe in as many
ways as possible. Here is 500 gigabytes
of emails that don't matter. Go nuts,
right? Figure out exactly what happened
at what point and bring up the
information. Now that is a challenge at
the moment. A lot of the time it's
manually reviewed. There are shortcuts
and processes by necessity because a lot
of these lawsuits are on a particular
timeline. It is physically impossible to
read all of the information that is
given in the discovery of the processing
of a lawsuit. However, and this is just
a generic graph I use because I'm not
allowed to use the ones that I'm
currently working on. However, if you
can take all of that information, you
can extract the information and
structure it in such a way that it is
consistent, all of a sudden that
mountain of emails becomes a lot of
information I can immediately dismiss
and a bunch of generally genuinely
useful information that I can look at.
And not just that, when it comes to a
graph, I can actually augment the
information from discovery and then I
can give that visual to the expert who
can make an immediate decision. I'm
going to loop back to the example I was
working describing before, which is the
pharmaceutical example. So again, if
ingredients are a certain concentration,
that concentration is at a problem. That
problem happened at a certain time.
There is only going to be a few people
in that graph of potentially millions of
nodes that are a problem, right? in the
same way that there are only few people
in that mountain of documents that were
a problem. However, now I've changed the
form factor such that I can specifically
hone in on what matters and not just
hone in in a datadriven way. I can hone
in in a visual way and natural language
such that the lawyer who knows exactly
what that natural language means or the
expert who knows exactly what that
natural language means can make a
decision that's data
driven. This is also a process of if we
can build this information exactly and
I'm giving the fundamentals. This is a
graph rag talk. We want to bring this
graph in. The graph I just described is
not that large. The graph I just
described has a consistent schema and
the graph I just described can be
relatively easily retrieved. I'm not
going to say that retrieval is
completely solved. I am going to say we
have agents in production right now that
lawyers can in natural language query
and further understand the lawsuit and
the individuals that they're
representing. Now we get to case
research. So that was more discovery,
right? Mountain of documents. Case
research would be a lot of people used
said product and they're complaining
about it online. And this is a lot of
the value of our company and what we do.
People can complain all the time. They
can shout into the void of a niche
subreddit or they can go on Twitter or
they can be on a forum that they're used
to. They can be an IRC where they can be
wherever they want, right? But they're
using similar language about a specific
thing. And so when it comes to
traditional case research, that
information isn't really discovered. A
lot of the time it happens through
talking to another individual,
subscribing to a newsletter. etc. How do
people find the
information? So, and this is a graphic
I've taken from our website, which I
promise looks significantly better than
the slides that I make, but I tend to uh
try and talk to them. Uh here is how
case research in our case for our
business works and that is we start and
scrape the entire web. Now, anyone can
scrape the entire web. It's doable. It's
a technical challenge, but it's doable
and you can scrape it at a frequency and
the services etc. What we do is scrape
the web and then qualify the leads of
that scraping. We filter down all of the
information down to specifically what
the individuals want. We have schemas
that we work with particular law firms
and lawyers. And those schemas get us
down to just the information that they
care about. And look, maybe there is,
but right now, at least for me, there's
no such thing as a perfect case. There's
no such thing as a perfect lawsuit. It
depends on the lawyer or the partner or
the firm who's willing to take that on.
So, it is not a problem of best. It's a
problem of specific and personalized.
And that is where things like LLMs are
particularly useful at the moment.
That's where things like multi-agent
systems are fantastic. That's where
things like structured information and
graphs all of a sudden a different
lawyer can have a different multi- aent
system and a different graph that backs
up their specific way that they like to
work as opposed to having a compromise
previously on the way that everyone else
like to work to maybe hear something if
they can. And from there once we've
honed down just to the signals that they
care about the qualified signals that
are specific to them that signal can
then further generate a report and that
report can be entirely specific to the
lawyer as well. So when it comes to
report generation again a multi- aent
system that's backed up by a schema and
that schema is consistent and pruned and
that schema looks like controlled state
with a graph that can build the reportthat the lawyer wants and every report
is going to be different but the
structure is going to be the same for
each lawyer and each lawyer has a
different process.
What I'm broadly describing is mass
scraping the web down to a specific
signal generated just for the lawyer.
It's entirely personalized service
that's been automated and that is the
process of what we do and this is part
of how we are able to manage and use
state and graphs and multi- aent systems
to bring the information
together. Cool. I'm going to go through
I think I have one case study um that I
want to describe just conscious of time.
This happens. Um, it's not great. No one
really wants it to. There may be
situations in which there's a bunch of
people who bought a car who really
wanted it to catch fire. We don't
necessarily deal with them. What we do
find is that there are people who are
driving their car and it starts a smoke
and then it catches fire and there's not
the behavior that they intended for to
happen, right? It was not on the
brochure when they bought it. It's not
what they want. Those people immediately
go and complain as they should, right?
They go to government website. They go
to carcomplaints.com. They're on a
specific subreddit or forum. And once we
can start to track that, which we can,
and once we can start to scrape and then
structure and then schematize and then
analyze, we can start to basically build
a density of complaints for a specific
vehicle, for a specific year, for a
specific problem. And that density is a
combination of how many complaints
multiplied by the velocity of
complaints. So a certain amount per
month over a, you know, number of
months. All of a sudden, we get to the
point where we're finding these leads
particularly early. And now as we're
building models, we're starting to find
these leads early and earlier and that
we don't necessarily need the velocity
straight away. We can start to figure
out what are the previous lawsuits which
were all public and very well documented
and exactly what happened in that
process. And so for a large law firm,
maybe eight or nine months post people
starting to complain, they can take that
lawsuit on if they want to. uh for us we
can find it uh within about 15 minutes
and then generally it takes probably a
month for you to be confident that this
is the signal that you want and so we
can find things significantly earlier
that process again scraping the web
filtering down producing the specific
report this is an example that we did
and again uh we deal with what the
lawyers want so this lawyer again he
made the case that uh people's cars are
catching fires they don't really want
them to those are the cases that he
would like to take on it's of a certain
amount of money it's of a certain make
model it's in a certain jurisdiction etc
those specific filters that schema can
be applied throughout the entire
process. That's basically the graph.
Each of these lawyers have a specific
graph that they want. And not just that,
they can filter and feedback that
information. So it's not just a static
graph. I mean the benefit of a graph
structure at least well one of the
benefits of a graph structure I should
say is that it's an extensible schema
and that I can update and I can query
across and I can understand that
information. So uh while we are dealing
with rag I would say we have less of a
chat rag interface. While the lawyers
definitely do appreciate that, a lot of
what we have when it comes to rag or
retrieval augmented generation would be
generating these reports because as much
as a lawyer does want an answer, what
they also want is the form factor that
they're used to. And so all of these
graphs are consistently made and built
each day and then some subgraph from
that broader monolithic structure is
then brought in and composed into a
report that a lawyer can
action. Kind of what's what's next and
I'll talk about the future a little I
mean what I described is kind of what
we're doing but this is what we're
doing. Final lawsuits early and
compensate harm and then people can have
that information if they want to. Um
we're able to do this entirely
technically we're able to scrape the web
structure etc. We're able to iteratively
build up a schema as we want to. uh this
is not just a genai problem and I think
this is an important thing that I've
seen around this conference and people
may be seeing is that genai is not
better than machine learning uh and LLMs
are not you know better than traditional
ML systems but there are situations in
which one is fantastic and one is not if
you look at multi-agent systems and
again I was previously an academic in
multi- aent systems and no one ever
listened to me so this is a bizarre
situation but that when you used to
structure the multi-agent systems
together somewhere along that workflow
you would have to stop or say this is
not doable because I cannot plug these
two bits of information together. It's
too probabilistic or it's too random or
it's too inconsistent or the way to
describe it is not a binary feature.
Right? It is I really just want to kind
of type what I want. Right now with LLM
you can but it's very much for us not an
LLM filtered system. It's an ML filtered
system that LLMs have allowed us to pipe
together such that you can actually
provide value completely end to end
which I think was previously not doable.
And for us, again, we've been using
graphs for a long time. For us, the
ability to iteratively build that graph,
prune that graph, and every single
report gets better because we're able to
manage the state is why people like
working with us because we can
consistently follow and track exactly
what they want
specifically. Cool. I think I'm just
about at time. Kind of got in early, but
that's been the talk specifically around
I'm happy to talk to anyone about the
specifics, um, graph rag, etc.
multi-agent systems, but that's how we
use the process. Thank you very much.
[Applause]
Oh, cool.
Yeah. I don't want to do I don't want to
touch it if I don't need to. What's the
best way? Oh, sorry. Let me come down.
I'll take Can I plug unplug this? Is
that okay? Thank you.
for our day.
Thank you very much. Talk to you soon.
Wow, your information is so awesome. Do
you guys do you have a business?
uh in the specific
Thank you everyone for attending the
sessions in this room. We do have to
clear this room out to set it for
tomorrow. So we thank you and there's
plenty of
workspace out there.
I promise they still have Wi-Fi out
there. It's probably even better. They
might even have coffee and lemon bars.
Thank you. We're going to have our
questions outside in the track. Thank
you. He's going to meet you outside. I
promise he's not going to go anywhere.
Be glad I don't have music.
What's that? We usually just turn the
music up, but they didn't clear any
copyright. They didn't clear any music.
No music for us.
Yeah. Yeah.
Can you tell I'm a producer?
Yes.
Awesome. Thank you.