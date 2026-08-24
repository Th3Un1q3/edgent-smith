[Music]
so for this talk uh basically what we
thought was it'd be cool to give kind of
practical examples and lessons of uh
problems and solutions that we
identified while building uh the droids
uh and so for context about Factory uh
our mission is to bring autonomy to
software engineering and what that means
concretely we build these products that
we call droids they are autonomous
systems that are applied to different
stages of the software development life
cycle think code review documentation
testing all the way to end to- end
coding tasks like a refactor a migration
Feature work uh and so each of the
droids uh has like separate cognitive
architectures which are mapped to the
tasks at hand and uh in particular the
uh you know droids like review Droid or
the documentation Droid which handle
processes which we think are kind of
more on guard rails are pretty different
from something like the code Droid which
is able to take nearly any natural
language task and make an attempt or
complete uh a coding task that is
associated with that like request uh and
so the idea for this talk is let's just
start describing what we think of as an
agentic system uh this
like agentic systems have a lot of
different interpretations a lot of
different definitions we think that uh
there's three characteristics which are
kind of most uh representative of an
agentic system the first is planning I
think you've probably seen a lot of this
in this track the idea that the agentic
system can make decisions about one or
future or many future actions that it's
going to take uh
decisionmaking some people call this
reasoning uh I think that on a lot of
these systems just the ability to make a
decision have some criteria and some
algorithm that's associated with making
that decision is kind of critical in
order for agentic systems to take on
more general or broad tasks where the
decision space is very
wide uh and then you have environmental
grounding uh and so you know a lot of uh
systems have planning they have
decision-making but I think the
existence of an agent within an external
environment is very critical to
understanding some of the unique
properties of agentic systems when
you're actually implementing them um so
being able to read and right to these
environments is is a you know a critical
part of this process uh and
so let's talk about planning first uh so
the first idea that we kind of
encountered is inspired by control
systems and Robotics the idea of the
pseudo common filter is as you you are
working through a plan what happens is
you tend to notice that your agentic
systems will lead will be led astray
their reasoning will change rapidly and
as you kind of iterate through
especially long plans you can imagine
that in order to migrate even a small
section of a code base you might have
literally hundreds of steps in a process
and so inspired by a lot of the folks
that on our team come from backgrounds
in self-driving and Robotics uh the
pseudo common filter is basically p ing
intermediate reasoning and you can get
pretty complex about how you modify or
share the intermediate reasoning through
the different plan steps but as you pass
that intermediate reasoning through the
execution of the plan steps uh it allows
the like individual decisions that
happen on the plan to slowly converge
towards at least consistent reasoning uh
the kind of core issue with this is it
also facilitates error propagation a
simple mistake especially early on in
the plan can lead to like you know
strong Downstream
effects subtask decomposition this is
pretty well known even reacts that like
some of the earlier agentic uh action
systems uh have some form of subt
decomposition uh but you know what we
found is that experimenting with
different forms or structures of subt
decomposition in our planning process uh
has led to a lot of like pretty
interesting Downstream positive effects
uh in in particular it when you
basically increase the resolution or the
Fidelity of your subtasks in a given
plan it gives you more fine grain
control it allows you to Define kind of
the action space a lot more clearly
however the risk is you're introducing a
lot of decisions for the llm to make the
more like small tiny tasks you introduce
the harder it is for the system or the
agentic system to decide what's right
um then you have model predictive
control this is again you know not a new
idea not invented by anyone here but the
idea of evaluating outcomes of your
subtasks and your current state uh and
enabling kind of adaptive replanning
based on real-time feedback that occurs
during the execution of the plan so you
know if you have you know rapidly
changing environment or information this
can occur especially in you know
situations for us where there are other
humans actively engaged in either
development process or some other
workflow while your agent is executing
perhaps a long running workflow uh and
so if you have you know you can honestly
like find a lot of information about
these techniques and kind of reason
around you know you don't have to
necessarily jump into the true like
basian statistics predictive modeling
stuff I think a lot of the like General
ideas of replanning taking in the
trajectory information and making sure
that you keep that up to date uh is
honestly enough to see some like pretty
solid quality improvements on your
agents and then finally uh explicit plan
criteria so I think you actually kind of
see this pretty often for very simple
agents and then people start to remove
explicit plan criteria in order to
increase generalizability uh but uh what
we found is that clearly defining kind
of successful structures or at least
successful initial States for plans uh
can lead to like very strong kind of
Downstream effects uh and and you know
this can be done in a lot of different
ways instruction tuning uh you know few
Pro uh few shot prompt examples you can
validate like your plans with different
kind of hard-coded logic uh you know
ultimately all of this is about error
reduction and keeping your like
trajectories as successful as possible
as long as possible uh but it's
difficult to build and scale these
because basically what I'm recommending
is that you hardcode a lot of logic into
your system uh I think this is like a
general idea that people maybe you know
depending on your domain this may seem
appealing or not appealing But
ultimately we're probably not building
AGI like tomorrow or next week or in the
next six months and so I think taking
some of the lessons from the kind of
like symbolic era of AI is useful if you
have like a domain challenge that you
want to solve in the next three months
uh for us you know we think about
delivering real value to customers today
and that means that a lot of what we do
is thinking about things like explicit
plan criteria hardcoded logic uh and I
think that a lot of folks may not like
be open to admitting that but I think
it's a very important part of the the
process of building these kind of
agentic systems um so now talking about
decision making and I know this is also
meant to be kind of like a word vomit
honestly because I think hopefully you
guys are like building agents and you
care a lot about this stuff and it can
spark or Inspire some ideas in your own
systems when you're working on them um
so first for decision making consensus
mechanisms uh there's a lot of these
self consistency is a very popular one
prompt ensembles cluster sampling you
know basically the more inference at run
time that you run and the more that you
can like build a clever way of selecting
ideal or optimal samples from those like
many number of inferences the higher the
accuracy it's just going to cost more it
may introduce longer inference weight
times if you're not parallelizing uh but
we found this very important uh to
getting highquality decisions that are
consistent uh next you have explicit and
analogical reasoning these also have a
lot of different names Chain of Thought
uh checklists chain of density
analogical prompting you know basically
you want the system to explicitly
outline its reasoning or decision-making
criteria to reduce the complexity of the
decision-making process so when you have
for example a checklist of things that
let's say you want to make a decision
about left or right if you just create
create a checklist of what constitutes a
reasonable left and what constitutes a
reasonable right your system will do
better at choosing left or right um
obviously though this introduces
challenge if you have like very broad
domain stuff uh and or you like have a
decision which has a huge action space
in which case techniques like Chain of
Thought reasoning uh you know chain of
density honestly like there's like
Galactic tree of Mega brain thought that
like there's a lot of these like
techniques that exist and I think uh you
know exploring these is super worth it
uh for improving performance uh
fine-tuning this is kind of a copout
answer but I actually think it is pretty
valuable once you really get into having
data uh for specific decisions that you
want to make it may just be true that
the best thing to do is to spend a
weekend pulling the latest open source
model generate a bunch of training data
with a high quality model validate it
with a bunch of your team members and
just train like or fine tune a model uh
this is expensive and it locks in the
quality of your system
like a lot of the like benefit of
relying on basically being able to
sample from different models is every
time a new state-of-the-art model comes
out your system gets better I think
that's a huge benefit however for
certain decisions especially those that
are really out of distribution uh fine
tuning is a pretty effective way uh to
make a good decision uh and then
simulation so simulation of decision-
making is super tricky uh this is
definitely going to be very domain
specific if you're working with software
development simulation is luckily kind
of built into like the thought process
here the ability to execute code the
ability to reason through code
trajectories uh is super doable and so
for us simulation makes up a huge amount
of how we think about decision-making
processes so sampling multiple decision
paths uh simulating them both with real
and and kind of like llm imagined
execution paths uh techniques like
language agent Tre Arch which basically
says amongst this simulation of decision
nodes let's Implement like a fancy Monte
Carlo Tre search algorithm and uh you
know it's it's kind of like Monte Carlo
research it's not exactly but you know
let's do fancy algorithms to decide
where we want to move based on the
simulation results uh and so you can do
all these things and ultimately the the
kind of core goal here is you want to
have some evaluation of whether or not
your system makes good decisions when
you want it to make good decisions you
can take all of these techniques apply
them and then see what's working what's
not working look at the pros and cons
and then adapt um so that's
decision-making now we have
environmental grounding so the first uh
you know this is often times called tool
use I think that that's like an
equivalently like valid way to describe
AI computer interfaces but I think the
idea of like building these is kind of
the interesting challenge so there's
dedicated tools that are very common
like you can like pull down Lang chain
and start using a calculator uh a
sandboxed even python script execution
like I'm pretty sure you can clone a
open source repo today that implements
cla's artifacts like in your own like
environment it's awesome how great the
open source Community has pushed tool
use uh but I think a lot of the kind of
edge of tool use and where you start to
move towards building custom AI computer
interfaces is when you need workflows or
trajectories which don't exist with the
kind of known tool set that you have
today so if you have a calculator you
can definitely run a calculation but
what if you know that very consistently
you are going to use a calculator take
the output of that calculator and maybe
pass it to another system and then
you're going to read the parse the logs
and then take the output of those parse
logs and do some like additional
transformation if you're going to
consistently do that and you want your
agent to just come up with that every
single time then that's probably not the
right mental model for what like the
agent should be thinking about or making
a decision about uh instead what you
want to do is say how can we build this
tool and then build the interface to the
llm for this tool so that you can kind
of streamline those types of uh actions
that you want to take uh and so this is
honestly really effective especially in
domains like code where there's tons of
Dev tools like I mean there's infinite
numbers of tools that people have made
to be really good at developing software
that are honestly really effective and
they just have kind of weird interfaces
maybe it's a CLI maybe it's like command
shift clicking to goto definition on
your vs code all these things that exist
in like the world need a way for an llm
based system to invoke and reason around
the outputs uh so we spend a ton of our
time building these AI computer
interfaces um
then I I kind of alluded to this but uh
designing explicit feedback processing
is I think a very critical step of
grounding your agent in an external
environment uh in particular if you have
for example logs I think is the great is
like a great example of this uh your
cicd probably outputs an enormous amount
of data about you know all the tests
that ran all the debug statements all
this kind of garbage that you don't care
about if you know that you're going to
need to process that data and use it at
some point it's definitely good to build
into the system explicit kind of paths
or decisions or tools that take all of
this feedback process it and then maybe
even do like a step which is solely
about llm reasoning uh I guess the
example here is you have your logs you
parse through it and then you say well
what is you know I know the llm is going
to want the failing tests so let me get
the failing tests and also provide a
brief like explainer of what the rest of
the logs were doing uh that type of like
feedback processing is pretty critical
uh into making these systems work really
well it also applies to I'm talking a
lot about external tools and external
mechanisms like the llm or agentic
system interacting with something else
there's also the llm or a gentic system
interacting with itself s and so as you
as the agent kind of reflects and
reasons about error trajectories
processing that feedback in a meaningful
way and passing it back to the llm uh is
super important because a lot of the
time the llm is not great at actually
criticizing its own action it's just
good at listening to you tell it to
criticize itself uh and so that we found
to be very
important uh bounded exploration so you
definitely want your agents to be able
to gather as much context as they can
about the problem
space as you introduce additional ways
of gathering this context probably at
the beginning of the problem not always
but probably uh there is a huge benefit
for uh models that can handle this like
very long context models if you use
Gemini Pro 1.5 or uh Sonet 35 honestly
there's a lot of models now that have
very long context Windows um you can
continue to you know include information
but at a certain point you need to kind
of say let's jump into the problem and
what we found is that finding the right
balance of bounded exploration time is
very difficult to actually know in
advance uh and honestly requires a lot
of evaluation uh and so if you can allow
your agent to gather this context have
longer exploration phases collect data
decide which data is or isn't relevant
and kind of begin the problem with the
maximum like Ood of success then that is
like one of the single most important
things to having a successful trajectory
uh in the in the kind of extent
um and then human guidance uh so this is
also a little bit of a copout answer but
I think it's important to like describe
you know as you have your agentic system
interact with humans you want to decide
when in those interaction patterns do we
want to ask the human to interfere or
when do we want them to provide guidance
so as you know with careful ux design
and like interaction design I think that
this can be extremely effective at
allowing your systems to go from 30 or
40% reliability to 90 or 100%
reliability um but you know ultimately
this is balancing autonomy with human
oversight and so it's a trade-off that
you have to make um anyway so those are
all the things that we learned at
factory there's many more and if you'd
like to join us we are hiring AI
Engineers software Engineers go to
market everybody so please give me an
email
[Music]