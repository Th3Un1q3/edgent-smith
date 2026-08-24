[Evals Workshop] Mastering AI Evaluation: From Playground to Production

[Music]
Hey everyone,
thanks for joining us for the eval
session today. This is the first
workshop that we'll be leading. There's
another one at 3:30, so you get to be
the first people to to go through it.
Uh, very exciting stuff. If you've
gotten a chance to sign up for Brain
Trust, uh, you know, please do that now.
If not, we also have some workshop
materials and a Slack channel for you to
follow along.
In the Slack channel, we also sent out a
poll if you'd like to respond with a
little emoji underneath the message.
That'd be great. Uh, in the Slack
channel also, there is the the workshop
guide. So, in in case you're not uh able
to get the QR code for whatever reason,
uh go into the Slack channel and you'll
be able to pull up that document.
Before we jump in, obviously maybe just
a quick intro of uh Carlos and I. My
name is Doug. I am a solutions engineer
at Brain. Um have a background in data
and finance. Actually, my my third week
here at Brain. Um but but looking
forward to kind of leading you all
through the platform and giving you a
sense for how you can master evals with
Brain Trust.
Yeah, my name's Carlos Essan. I'm also a
source engineer helping out with some of
our great customers at Brain Trust. I'm
a little bit more tenured, been here six
weeks and before I was in the info world
working at Hashi Corb doing some uh
stuff with Terraform and Vault. Uh but
yeah, super exciting to be here today at
the AI world fair. Uh we have a lot of
exciting things to go over with you.
So just to go over the highle agenda,
we're going to be alternating between
lectures with slides and hands-on
activities. So we're going to start with
understanding, you know, why even eval,
what is an evalu
uh task there and then move back into
the lecture, talk about the SDK, how you
can do the same thing via the SDK. it
can be a bit more powerful in certain
situations as well. Then go into
production like logging. So day2 stuff,
how are you how are you observing your
users interacting with your production
app or production feature? And then
finally, we're going to be incorporating
some human the loop. So trying to uh
establish some ground truth for the
ideal responses, improve your data sets,
and overall improve the performance of
your of your app.
If you've gotten a chance to check out
the poll in the Slack, uh, feel free to
submit a response. Really curious to see
how everybody is currently evaluating
your AI systems.
Just as a, you know, question that I'm
out of curiosity, could I ask for a show
of hands, how many people have seen
Brain Trust before, gone to brain.dev,
and interacted with it? Cool.
That's great. So, we have some some uh
pupils that have already gone and and
explored a little bit. That's exciting.
And a lot of people that are brand new.
So, starting off with just an
introduction. What are evals? Uh how do
you get started?
First, I wanted to just show off some
mentions of evals in the public space.
Uh you may recognize some of these
names. they see the importance of eval
which you know may or not uh point you
that that this is something important
that we should be thinking about when
pushing changes into production when
we're developing these these AI
features.
So why even do eval? Well, they they
help you answer questions. That's
ultimately what they're for. You know,
uh what type of model should I use?
What's the best cost for my use case?
what's going to perform best in all of
the edge cases that my users will be
interacting with.
Is it going to be consistent with my
brand? Is it going to uh you know uh
talk to the end customer to the end user
in the same voice that I would want a
human? Am I improving the system over
time? Am I able to catch bugs? Am I able
to troubleshoot effectively? So all of
this can be can be answered with the
help of eval which is what we'll be
discussing today.
The best LLMs uh don't always guarantee
consistent performance. So this is why
you need to have a testing framework in
place. Right? We have hallucinations uh
occurring at a pretty high rate.
Performance is also degrading when you
make changes. it's difficult to
guarantee that the change that you're
putting through isn't going to regress
the the application and you know the
changing a prompt even if it may seem
like it's improving it will actually
regress it. So you need to have some uh
scientific empirical way of testing
these changes and making sure that your
AI feature is performing at the level
that your users expect.
So how do evals help your business?
Well, they cut dev time. You'll be able
to push changes into production a lot
faster. Uh, eval will live at the center
of your development life cycle. They
will reduce costs as the due to the
automated nature of eval. You'll replace
manual review. Uh, it will then lead to
faster iteration, faster releases.
You'll also be able to optimize the
model that you're using, make sure that
it's the best bang for buck. Your
quality will go up and you'll be able to
scale your teams. It will enable
non-technical users and technical users
to also have a say in the prompt choice
in the model choice and just the overall
um management of the performance in in
the production traffic.
These are some of Brain Trust's customer
outcomes. So, we've been able to uh help
some of these great companies move a lot
faster, increase their team
productivity, and increase their AI
product quality.
So now moving into some of the core
concepts of brain trust. Uh so we're
really targeting three things. Prompt
engineering, right? So we're thinking
about how we're writing the prompts.
What's the best way to provide context
on our specific use case to the prompt
so that we are optimizing its response.
Right? The middle piece evals. Are we
measuring improvements? Are we measuring
regressions? Is this being done in a
statistical way uh that's easy to
review, easy to understand? And then
finally, AI observability. Are we
capturing what's happening in
production? Do we know if our users are
happy with the outputs, unhappy? Are we
able to uh prioritize certain responses
so that we can keep iterating, keep
improving?
Great. So now moving uh to the eval
section. So what what is an eval? So the
the definition we've come up with is
that it's a structured test that checks
how well your AI systems perform. It
helps you measure quality, reliability,
and correctness across various
scenarios. Ideally, you're capturing
every scenario that a user will live
through when interacting with your AI
feature.
When it comes to brain trust and writing
evals, there's really three ingredients
that you need to understand to be able
to to work effectively. The first is a
task. So this is the thing that you're
testing, right? This is the code or
prompt that you want to evaluate. It can
be a single prompt or a full agentic
workflow. The complexity is really up to
you. The one requirement is that it has
an input and an output.
Then we have our data set. So this is
the set of real world examples or test
cases that we want to uh push through
the task to see how it performs. And
then the score that's the logic behind
uh the the evouse. So, how are we
grading the output of our prompt on our
data set? Uh, these can be LLM as a
judge scores or they can be full code uh
functions
and the caveat is that they need to
output a score from 0 to one which will
then be converted into a percentage.
Question. Yeah. What are the test cases?
Is it also agent generated?
It can be at first. The question was, is
the data set synthetic? Can it be
synthetic? And the answer is, it's a
great way to get started quickly is
having an AI generate those initial use
cases, but as you progress, as you
mature, it's great to ground those in
logs so you're capturing the real user
traffic, the real interactions that
users are having and integrating those
into your data sets.
Great. So now I wanted to talk about
offline evals and online eval. So
there's two mental models to think
through. Offline evals are what you're
doing in development, right? So this is
the structured testing of the AI model
of the the prompt uh that you are going
to then eventually uh show off to to
customers in production. So this is for
proactive identification of issues,
right? uh this is what we'll be doing
today in the playground in brain trust
and also via the SDK. Uh but then on the
other side is online eval. So this is in
production uh real traffic is being
captured and being measured. It's being
graded just like your offline evals are
being graded. And this is going to allow
you to diagnose problems, monitor the
overall performance and capture user
feedback in real time so that you can
understand, oh, this edge case isn't
included in my data set. This is a weak
point in my current AI product. I need
to spend some time uh attacking it and
improving it.
A big question that we get asked is what
should I improve? Right? Uh I have my
prompt, I have my eval, you know, how do
I know what's wrong? Uh and I think this
matrix really helps simplify this
question. So if you have a good output
from, you know, your own judgment
looking at what the LLM is giving you
and it's a high score, then great,
right? you've verified yourself that the
output is is high quality and also the
the scores the evals have also come to
the same conclusion. If you think it's a
good output but it's a low score then
that's a signal that you need to improve
your evals. Maybe the score isn't
actually representing what a human would
think, right? Uh if it's a bad output
but a high score, same thing, right? It
doesn't match what a human would think
looking at the output. So you need to
improve your evals. And then finally, if
it's a bad output and a low score, your
evals are working correctly. That's
good. And now you need to focus on
improving your AI app. So, I hope this
helps explain how you should be thinking
through uh your scores and and what to
what to tackle in which moment.
So, now we're going to zoom into each of
those ingredients or components starting
off with the task. Uh so, as I
mentioned, right, a task is really just
an input and an output. It can be a
single LM call or a whole agentic
workflow. It's really up to you what you
want to test. Uh so in this pattern,
we're just going to be creating a simple
prompt. Uh this is what the activity
today is going to encompass
and uh you can use dynamic templating
with mustache. So you can provide your
data set rows as part of the the prompt
and that will be tested uh and you'll
get to see that in action soon.
What if you have more than just a
prompt? What if you have a multi-turn
chat a whole conversation that you want
to evaluate? So you can do that in brain
stress today. You can provide the whole
conversation as extra messages. So
providing that whole chain of of uh
messages back and forth with the user
and the assistant. You can include tool
calls as well to simulate those tool
calls and evaluate that big chunk that
context that whole conversation at once.
Tools are also something supported in
brain trust. So that's oftent times
something that your AI applications will
leverage uh talking to external services
or grabbing information from somewhere
else. Uh so you can add tools to brain
trust and have the tool available for
your prompt uh to use
and just to mention that's great for rag
use cases. So I know that's a a hot word
right now. So if if you have that in you
know in mind brain trust can handle it.
We support tools. We support rag um
agents another hot word right now. So we
also allow you to chain your prompts,
right? So you can have three prompts
chained together. The output of the
first prompt will become the input of
the next and so on. Uh so you can start
uh testing end to end uh all these
prompts back and forth, right? And and
do the same thing that you would with
with a single prompt.
Great. Okay, so now moving into data
sets. So this is the test cases, right?
You're going to keep iterating over
time, but initially maybe you're using
something synthetic. Um, there are three
fields that you need to understand for a
data set. Only one of them is required
though, and that's the input. So that is
the the prompt, the user provided uh
use case, the the prompt that would be
provided by by the user would be the
input. You could think of it that way.
And then you have the expected column
which is optional which is the
anticipated output or the ideal response
of that that prompt. And then finally
you have your metadata which can allow
you to to capture any additional
information that you may want to
associate to that specific row in the
data set.
Some tips for data sets is to start
small and iterate. Uh it doesn't need to
be the largest data set of all time. It
doesn't need to include all of your use
cases, right? Just get started. Use
synthetic data at first. And the
important piece is to keep improving,
right? Keep iterating. So if you start
logging your real user interactions, you
know, even if it's just in staging or
internally in your organization, you can
start to increase the the scope of the
data set and it will start to become
closer to the the overall uh domain of
of use cases that that users will will
interact with. And then finally, you
want to start implementing human review.
Uh this will allow you to establish
ground truth, improve your data set,
improve the expected column. um which
will be great for for your evals
and su zooming into scores. So this is
uh you have two options here and the
type of score that you want to use. LM
is a judge. This is great for uh more
subjective or contextual feedback.
What would a human need to understand
when looking at the output? What
criteria would they consider? Uh this is
more of a qualitative question that you
want an answer to, right? using that LM
as a judge. On the codebased score, this
is deterministic, right? So, you would
want exact or binary conditions. This is
more of an objective question. Um,
and it's the important piece is to try
to use both. So, you want some LLM as a
judge scores, but you also would like
some codebased scores, and they they'll
help you meet in the middle and
understand the the quality.
So, some tips here. uh you know, if
you're using an LM as a judge, maybe use
a higher quality model, a more expensive
model to to grade the the cheaper model.
Uh make sure that the LM as a judge has
a focus. So don't give it, you know,
four or five criteria to consider. Zoom
into one specific piece and expand and
explain the steps it should think
through to to come to its conclusion.
If you're writing LM as a judge, maybe
you should eval the judge and make sure
that the prompt that you're using is
matching what a human would think. So
that's another great way of improving
your scores. And you know, just make
sure that it's confined and you're not
overloading it with all the context in
the world, right? You want it to be
focused on the relevant input and output
uh for consistency.
Great. Almost at the end here. So the
there's two things to understand about
the brain trust UI specifically. So
there's the the playgrounds and this is
for quick iteration of your prompts uh
agent scores data sets right it's really
effective for comparing uh you can do AB
testing with prompts you can do AB
testing with with models and then you
can save a snapshot of the playground to
your experiments view and the
experiments is for comparison over time
so you'll be able to track how your
scores change over weeks months uh and
everything that your team is doing
across the UI across the SDK will also
aggregate in the experiments view. So
you can analyze everything and
understand okay this new model came out
today how is it performing to the prompt
from two weeks ago.
Great. So now we've reached the first
activity. Uh so if you could please go
to the activity document and it will
take you through the journey of of
running your first evout in the brain
UI.
Please raise your hand if you have any
questions or run into any issues.
We'll be walking around and just uh
making sure there's no blockers.
Yeah, if you check Slack, we'll also go
back to the QR code.
So, did everybody have a chance to get
these QR codes?
Uh the middle one is going to be the
most important. And this is where you're
going to access the materials for the
workshop.
Yeah, I'll repeat the question. The the
question was around uh extra messages in
the prompt and if you are overseeing
agents and you know multiple types of
users, multiple different roles are uh
all talking back and forth and you want
to distinguish
their roles, right? and all being all
within the the playground UI. Um
so you can right now there is no
additional delineation between uh the
assistant the user the tool call and um
I believe that's it. So having the the
user be branched and it play different
roles is something that you would need
to rely on the the SDK for that
additional flexibility.
my other question,
right?
Yeah. And and we'll cover the SDK in the
in the next section. I think maybe the
biggest takeaway is that there is no
limit really on the complexity that that
you feed to that like as that task,
right? The the only requirement is that
input and that output. like maybe
something is a little bit more tailored
to the brain trust playground and the UI
where some things are actually a little
bit more tailored to that SDK. Uh so
that's that's we can jump into that in
that next section. Um maybe it makes
sense to like as we're going through
like the the workshop I'll kind of walk
through this as well just so you can all
kind of see me go through it. But feel
free to raise your hand. Uh we can we
can walk around and and answer
questions.
for Slack. Are you able to access the
document via the is the the slide deck's
not public? Is that it's not Oh, that
for the slide deck. Is this Yeah, we
we've just Yeah, the question was this
is all in the UI, right? Is this That's
the only place we've been thus far,
right? Uh just talking a little bit
about the different components of the
brain trust platform.
Um, so let me let me walk through that,
right? Give you a sense for what we just
kind of showed to you in slides, right?
So you can't access the slide deck.
We can we can update that. Yeah. Yeah.
Um, just let's kind of walk through this
uh so we can get a sense for what what
we're what we're building here. Uh some
of the things that that Carlos just
walked through. Um I have a lot of this
stuff already installed. I hope that you
kind of walked through this, right? We
need uh certain things on our system to
actually go and run this. So we have
node, we have get. Um we're going to
sign up for a brain trust account.
Creating a brain trust or already done
this, so I'm not going to kind of bore
you through that that step right there.
This project unreleased AI. Um if if you
if you don't do that, you'll see two
projects in your account, but um just
this is where we're going to actually
create our prompts and our scores and
our data set from the repo that we're
going to clone into uh our local
machine.
Part of this demo requires an OpenAI API
key. That's just what we're using under
the hood. That's certainly not a
limitation of of brain trust. Um you can
use and maybe just to kind of highlight
something here.
You can uh you can use really any AI
provider out there. So if you've gone
into Brain Trust account, you've
probably seen this. You've entered your
OpenAI API key here. This is what is
going to allow you to to run those
prompts in the playground. You can see
you have access to many other providers.
You have access to cloud providers like
uh bedrock and and so on. And then you
can even uh use your own custom
provider. But for this workshop right
now we are using open AI. Question.
Sorry. Are you able to run
locally models? Yes. Yeah. Question was
can you run brain trust locally using
local models? Yeah. Um we we have uh if
you look a little bit further out
there's a section for what we call
remote evals. Might not have time to get
to it in this particular section but
know that you can go to that and and
play with that feature as well.
Um
sorry coming back down here. Um
so we're going to clone this repo.
Right. This is a right this is the
application that we're creating. The
idea is to uh give it a a GitHub URL and
look for most recent commits since the
last release and then summarize those
right for us as as developers. So that's
the application that we're going to use.
Uh we're going to create some different
API keys locally. So if you've cloned
your repo, uh you'll have av.local
file. I'll show you my example.
You're going to also input these your
brain API key here and then your OpenAI
API key. This is optional down here. Uh
it's just if you don't want to get rate
limited by GitHub. Probably not probably
not going to create a lot of requests
right now. So you probably don't need
this.
Um really important step here. So I'm
going to come back into uh brain trust.
So as part of our install, we're
actually going to go create some of
these resources. uh within our brain
trust project that we just created. So
I'm going to run pnpm install.
This will actually go push some of these
resources and you'll find these uh in
the brain trust folder the resources and
we'll jump into that but just wanted to
highlight that. So now if I look back
into my project I should see that
unreleased AI and the different things
that we've created. We have two
different prompts now right? These are
the the prompts that we use to generate
the change log as well as the the test
cases, the data set that we'll use as as
part of this.
Yeah.
All right, let me stop there. Anybody
having issues just kind of going through
that initial setup phase?
Excuse me.
Uh, we haven't made those public yet. I
think I'm trying to do that now. Yeah.
Do you have a do you have Slack? Uh,
Were
you able to join the workshop eval
channel?
Yeah, the Wi-Fi is not working.
Okay. Well, I I'll walk you through.
Yeah. How are we connecting the repo to
the project?
Um, yeah. So, when we ran PNPM install,
we ran a a script in the background
called just brain trust push. And if I
look at uh that file here, there's
different things that we've configured,
right? We've configured uh my change
log. So this is actually the brain trust
uh SDK under the hood. Uh this is where
we're creating that prompt in that
project unreleased AI. And so there's a
couple things that we can do here from
an SDK perspective. This is like you
think about uh you know version
controlling all of these different
things and actually pushing them into
the brain trust UI. So there there's a
lot of different ways to work with brain
trust. I think we mentioned earlier
either via just like the the UI or
actually via the SDK, but that's that's
how a lot of this stuff got created.
Cool. Let's let's kind of walk through
this uh this first activity. Um we're
going to we're going to access the
unreleased AI project. So if we go to
the prompts, so this is what we just
created.
Uh we created two different prompts,
right? This is essentially what we can
start to play around with, right? We
have this one uh and and Carlos
mentioned earlier there there's this
mustache syntax. We can actually input
uh variables here into into our prompts
and this is going to actually map to the
the different data sets that we can
actually use as part of this project. So
here's our first prompt. That's about
impossible to see. That was impossible.
Okay. No, no, that's fine. I appreciate
that. Thank you. And the lighting is
hard. So yeah. Oh, maybe we can change
the appearance to light mode or no.
Yeah. Where's that? put the user up
here.
How's that?
Thank you. No, I appreciate that.
How's this?
Okay, cool. Um, so really just reviewing
the stuff that we created. We created
these two prompts. Here's our data set
that we're going to use when we run our
evals and our experiments. Uh, you can
get a sense for for this. Here's my
input. I have a series of commits and
then I have a repository URL and I have
the when the last release was that's
that since field. So these this is again
the thing that we'll use inside of that
playground to create uh to create evals
and and to use to iterate from. And then
the last thing that uh I'll call out
here
is the scores. Uh so we created a few
different scores that we'll want to use
to actually score uh these prompts. So
we have an accuracy, formatting, and
completeness score. And again, this is
just in that that repo and that
resources.ts file. Uh we have maybe just
to to point out uh linking a little bit
of what Carlos was talking about to the
actual code that you're seeing. We have
LLM as judge scores. As you can see
here, uh really again trying to pinpoint
here the accuracy, right? uh we're not
overloading a single LLM as a judge
score with accuracy, completeness, and
formatting. Going to be very uh sort of
um detailed or you know scoped down to
that particular thing. And then last one
we have a codebased score, right? So
this is a little bit more uh binary,
right? Is the the formatting of this
change log that the LLM generated does
it map to what we expect? And so we can
use some code to do that. So that's what
we created via that script.
Yeah. How do we get that sandbox
project?
Yeah. So, if you go back to the the lab
setup when you run when you run that
install. So, I'm using PNPM.
All right. I don't know if if you use
that if you're using that locally, you
can you can also use npm. So, what is
the key for OpenAI API key? What is the
key? Do you not have an OpenAI API key?
instruction.
Okay. Um I don't know if we have one to
distribute at the moment.
Yeah. If you don't have
I'll do this later. Well, if if you go
like the part of the setup here, right
when we go to if you come in here to a
playground as an example,
right? And we're going to pull in one of
those prompts. So, we can pull in both
of these prompts to do again like what
Carlos was talking about that that's
sort of like AB testing.
It's going to ask for some open AAI
models, right? It's if you don't
configure an OpenAI API key inside of
your Brain Trust account, you don't have
a provider to actually run this this
task against.
Um, but but this is this is the
playground, right? This is what Carlos
was talking a little bit about earlier
uh about being able to do some AB
testing, right? I have uh my two prompts
that I've loaded in. The idea here is to
to load in those different ingredients,
right? Our tasks, our our data set, and
then our scores. So you'll you'll look
down here. We're going to select that
data set and then we're going to select
the different scores that we want to
score this task against. And I'll load
in my accuracy, formatting, and
completeness.
Can do a couple things here. I can click
run. This will actually in parallel go
through that uh that data set and use
each task that we've defined and then it
will score those. Right? So the idea
here is to again like this provides that
sort of rapid rapid iterative uh
feedback loop that we often times need
to build these types of products. So
here are my, you know, like my example
rows. Again, these could be synthetic.
These could be a a small subset of rows
that are coming back from my
application. But now I can get a sense
for prompt A, prompt B. How are these
performing with my scores? Uh, you know,
relative to the things that I have here.
But uh then I'm able to do a lot of
different things here. I I can uh look
at maybe a summary layout, get a sense
for the scores. So uh at the top, this
is sort of like my baseline. up here is
my base task and this is my comparison
task. So you can get a very high level
uh look at these different scores and
how they fared with the different
prompts that we've loaded in here. Now
the other thing that we can do that
Carlos mentioned is uh experiments. So
often times we'll want to capture this
these scores over time. So when we do
make changes we understand how those
scores fared a week ago, a month ago or
or whatever it is. So I can click this
experiments button and you'll see the
different things that we've loaded up
into this playground are already uh here
within this uh modal. We'll click create
and this will actually create the
experiment that you can go to here. And
again this will uh if I click maybe one
out this is allow us to track this over
time. This is what we can also lay in uh
in our CI kind of workflow. So we go
make a change to that prompt make a
change to that model. What are the
impacts to uh the scores relative to
what we had over history?
Sorry, can you what is the completeness
score? What is the completeness score?
Yeah, we can dig into that a little bit.
Um this is an LLM as a judge score. So
the idea, right, we're just going to
give it um instructions. The LLM is
going to score the output based on what
we've provided in this prompt. Uh you'll
also note I'm just really pulling in the
uh the structure of my data set, right?
And so you obviously can write and and
another thing that Carlos mentioned is
like scoring the score or eval evaling
the score. So how well is this thing
actually doing um based on the output
that that we are seeing within our
application.
Okay, that's really activity one, right?
It's uh reviewing some of that stuff and
then it's creating that playground and
showing you all like the the sort of way
that we can uh iterate here within brain
trust to create better AI or genai
products, right? Like this allows me to
now well okay so maybe this isn't the
right model. Maybe if I do uh maybe I
want to see this new GPT model. I can
run this and now I can see how the the
model changed for that particular score
uh how the scores changed when I changed
the underlying model. Right? But now I
have these you have like all of these
different inputs that could happen to
the these applications. It's a way for
us to track and understand when I do go
and tweak this thing. There's actual
data behind it, right? This isn't like
vibe check. This isn't um yep, I think
that looks good. I looked at this row.
It seems like it's better output. This
is data behind it and we can actually
understand as we tweak that prompt,
tweak that model, how does that impact
our uh our scoring and then again you
can like overlay this within CI and so
on.
Question.
Yeah. Um, I pulled the project down and
uh I have the brain trust
and everything just don't know where I
do the
project that is on my machine to the
Yeah. Okay. So, you you cloned the repo.
Yeah.
Can we get a where people are. Yeah,
please. We can back up considerably. I I
can I can just, you know, with you we
can fix this. Um, you've cloned the
repo, correct? Yeah. Okay.
In your enenv.local, do you have
aenv.local file? I should have. Uh,
there is aenv.local.ample
file. So, you can copy that into the
env.local. Those are the the keys that
we want to fill in. Have you filled
those in? No, I did not. Okay. So, if
you haven't within your brain trust or
created an API key,
am I the only one? I'm guessing no.
Yeah, I don't think so. I think the
internet connection is probably the
biggest thing we're fighting here. Yeah,
luckily all this all the instructions
will be available after the workshop.
Same with the slides. I'm about to share
the the slide link. So tough to update
with the connection, but um at least
seeing Doug go through the same process
will give you an understanding of, you
know, what we were hoping you'd have
that hands-on experience doing. Um we
don't have too much time to to wait on
this specific activity. So I think in a
few minutes we'll keep going and
hopefully you'll be able to set up your
keys so that you can catch up when when
you have some time.
Yeah, just in the interest of time,
we'll we'll probably move forward, but
just to complete that, if you go into
your settings within your project or
excuse me, within your uh brain trust or
you'll see API keys. This is where
you're going to create this API key. You
did that. Okay, perfect. Create that.
You put that in thatv.local file and
then you run pnpm install. So that that
is my in my home directory, right?
That's it's wherever you cloned that
repo. So at the root of that uh you put
the the brain trust API key in
yourv.local file and you should have a
spot for it already if you're using sort
of the template from the example.
And then when you run pnpm install
again just to highlight this
it's actually running this command brain
trust push. So, we're taking the the
resources that we've configured in our
in our project and is pushing it via our
API key to the brain trust or
cool.
All right.
uh maybe going forward a little bit here
to talk about uh the flip side of this
right we've been kind of in the UI for
the most part uh in our playground doing
that that iteration changing prompts
changing models and so on I think it's
important to understand that we can do a
lot of this via the SDK as well uh we
also have a Python SDK if that's the
kind of uh flavor you're you're most uh
used to using or the language but uh
that that top portion here uh is
essentially what we did right in that
that install that post install script we
defined our assets in code we defined
scores we defined prompts um we defined
a data set even and then we push that
into our brain trust or that the benefit
here is that again we can use our repo
right we can leverage version control to
ensure that the things that we want uh
to change are actually version
controlled alongside of everything else
that we're building within that
application so there are really two
modes to actually work with with the
brain trust platform it's its UI or its
SDK. Again, there's really no limits
that we place on on the on the user of
the platform. It's going to cater to
maybe a different uh persona, a
different use case. Uh but you can use
kind of both of these different things.
The other thing that we haven't done yet
uh that we did uh within the playground
when we ran that experiment, we we ran
those evals, right? We actually
evaluated uh the task against the data
set with our scores. You can also define
evals in code, right? You can define the
eval within your repo and a very similar
command brain trust eval. Now we can
push that up to the brain trust platform
and essentially run that same thing
track it in that experiments. I have now
an understanding over time how my uh my
evals are performing as I go and change
things all those different things.
A little bit more uh insight here you
probably saw with some of that code.
This is the uh the the command we're
going to run brain trust push. And you
essentially give it either the name of a
file that have eval or you can give it
the name of a folder uh as long as your
uh your files have eval.ts as their
naming convention. And we're just going
to go run those evals in that parallel
fashion that you saw within the UI.
A couple things maybe I mentioned
earlier but just important to highlight.
You should do this when you want source
controlled prompt versioning. You want
consistent usage across your your
different environments and you also want
to leverage online scoring.
Uh mentioned this obviously the the
eval.ts that's essentially what the SDK
is looking for uh when we go and run
those evals. It makes it really easy to
run a a larger subset of those without
specifying each single file that you
want to go run those eval. Um but you
can see and I'll I'll let me jump into
the actual activity. You can see the
eval that we've created. It's it's what
we've been talking about, right? The
three ingredients that we need. We need
that task, we need that data set, and
then we need at least uh one score there
as well.
How do you bootstrap a data set like
with multiple examples? Is there given
feedback in loop or is an LLM being used
to create?
Yeah, so the question was like how do
you bootstrap a data set? Um I think
it's a good question. I I think you
could certainly start with synthetic
data or you could even start with um you
know you you release a feature right
you're going to you're going to start
logging that feature this is another
thing that we haven't yet covered but
you can actually use the logs from that
to add to the data set so now you have
actual real life data thing to not do is
wait until you have 100 200 like you
have this golden data set if you think
back to that matrix that Carlos was
showing there are the different ways in
which we could start to think about
improving in the application based on
what we observe. So start with something
small and again it could be synthetic
but then you can once you start to
evaluate it then you have a different um
you have different inputs on what you
need to do to go and improve an a scorer
or improve the application. But it's
it's really I think maybe up to you the
the like the best practice or the thing
that I would think about is like don't
don't stop yourself because you only
have a small subset of data.
Okay.
Yeah. So, for the for the test you're
running, if you're using an LLM as a
judge, so like for the percent
completeness score, you're using GPT41
as a judge.
That's subjectively scoring the test
that you're running, right? So, like for
the for the for two runs that are that
one after the other, you could end up
with different scores, right? If you're
using like LL as a judge to run.
Um,
so the question was like, would I get
different scores?
Um, because I'm using an LLM to do this,
right? And it's not really
deterministic. Um, I think that's the
the reason why you would use a better
model so you don't see something like
that. Um, I don't know, Carlos, you have
any other thoughts there? Yeah, I mean,
I think you're speaking to the nature of
an LLM being non-deterministic. So, yes,
there may be some variability. What we
see our customers do, especially with
the SDK, is do trial evals. So, you will
run it maybe five times and then take
the average of those. So, there are
things that you can do to try to beat
that, but it is the nature of the beast
and you have to learn to work with it.
And then the other thing is how are you
scoring like a percent completeness if
the task of the LLM is like to judge
like put it in categories like excellent
good are you mapping those to scores or
yeah so I think that the question is and
if I come to the score and you look at
the completeness so the LLM here yeah it
has to decide based again on like the
criteria that we give it um if it comes
up with excellent that maps to one and
so on. But again, this the score that it
gives has to be between zero and one.
Yeah,
it's really helpful when you're using an
LLM as a judge to go through the brain
trust logs and read the rationale. So,
it will explain why it chose, you know,
100% or 75% and you can use that to tune
the LM as a judge and improve it. um
it likely will not, you know, you don't
want it to say 100% for everything,
right? If if that's the case, you need
to improve your evals. And even if it's
saying, you know, 30% for everything, it
doesn't necessarily mean that it's
performing horribly. Uh what really
matters is the baseline that you're
comparing it to. You know, how did it
perform yesterday on these scores on
this data set? Uh you shouldn't be
comparing just, you know, it needs to be
80%. Not necessarily. It matters what
happened yesterday, what you're
comparing to previously.
Yeah. And this is where it becomes
really beneficial to to be able to
actually drill into what happened within
that task. Uh so being able to not only
understand the the calls that the LLM
makes, the tools that it invokes, but
actually drilling into those scores that
we're using and then like Carlos
mentioned, what is the rationale that it
gave uh to give it a good score here?
Does that make sense? This becomes again
another way of like this is the human
review portion or part of building a
genai app. Yeah. Does brain tree offer
any kind of like optimization?
So you have your email down you got tons
of different.
Yeah, that's a good question and it's
something that we're thinking a lot
about is how can we add LLM to optimize
this process for you. Not just for
prompt like you mentioned, but also for
data sets and for scores. We're one to
two weeks away from releasing our first
version of this. Uh we're going to call
it loop and it will do exactly what
you're saying. It will help you optimize
the prompts and improve your emails.
Just to build on that, imagine like this
um this feature loop. it has access to
previous results as it's doing it. So it
understands when it makes that change,
is it better than it was previously. So
it's it's it's sort of like that agentic
type workflow where it has access to
tools, but it's able to uh to iterate on
that prompt and run those experiments uh
with you of course like in the middle to
to prompt it to do different things, but
it has access to those previous exper
experiments and the results of that. So
it knows like the general direction it
needs to go to get improvements. Yeah.
So how do you build that?
We use brain trust. Yeah. Exactly. It's
a way of dog fooding. So the question
was how do we evalow our AI feature? And
it's you know of course we have to use
brain trust and it's it's honestly
really cool to to look at the project
and see all the logs coming in and and
looking at the scores that we've chosen
to go with. Um yeah, brain trust is
really helping and it was actually
something that Anker our CEO has talked
about the process of of actually getting
to a point where we were excited to
release something like this. Previously
the models were not performing to the
level that we were needing them to
perform to. So every few months he would
run a new benchmark on this specific use
case and it wasn't until you know the
last month that a model finally uh
reached that that expectation.
Yeah, they gave me a mic, so hopefully
you can hear me. Um, cascading off the
gentleman in the front's question around
um, the subjectivity of using the LLMs
as a judge in these types of cases,
do you offer any way to gain access to
that rationale programmatically such
that you could evaluate the thought
process of the LLM as it's doing? It's
kind of meta like onestep review, but
adding in that second layer where you
could identify weak spots perhaps if
there's something that's hyper workflow
oriented or has a very strict process
you're looking for the LLM to follow.
Yeah, I mean I think you probably saw
when I highlighted here, correct me or
thumbs up if you saw this or Yeah. Okay.
This is all accessible via via API. Uh
coming back down here. So like the the
rationale that the LLM gave, we could
certainly build something on on top of
uh the these ration uh and then generate
you know again like eval type of
workflow.
Cool.
Yeah. Yeah. Question. So I'm just
curious like there's a mic if you'd like
it. Thank you.
Yeah. So, uh yeah, I'm I'm just curious
like how should we build our confidence
around like you know the result of OM as
a judge because I mean uh you know how
do we trust the result because is after
all the model like evaluate the data set
and it's could like we could get like
you know maybe a good result but
actually it's like maybe large model is
just overconfidence or something like
that. It's like we need to evaluate or
eval results using like humans like at
the beginning so that we can build a
confidence like yeah just curious any
experience like you have here. Yeah
definitely that's a great question. So
um I guess everybody heard don't need to
repeat. Um
I think there's two things that you can
do. One that you mentioned which is
involving a human reviewing that LM as a
judge and
confirming that is it's thinking in the
right way. It's outputting the correct
score. Um another approach that you
could do as well as the human in the
loop is uh using deterministic scores.
So full coding functions that are trying
to grade the same type of criteria using
regular expressions or some other logic
that and you can approximate right. So
if the LM is a judge is giving a zero
but the you know the deterministic code
score is giving a way higher score then
you know that there's something that
needs attention needs to be fixed. the
matrix as well that we showed at the
beginning that pointed to you know
should you improve your evals or improve
your AI app that's also a great resource
yes thank you
um how are you guys thinking about the
role if you think there is a role um for
traditional machine learning models in
eval
totally deterministic code and then on
the other you have LLM as a judge do you
think there's kind of a middle ground
for things like intent classification
models entity
uh recognition, uh sentiment
classification and clustering and and
kind of more traditional machine
learning approaches that kind of sit
somewhere in between, you know, the the
the totally deterministic versus totally
non-deterministic spectrum of code
versus LLMs. Like do do you think that
there's a role for those type of models
and what do you think that looks like?
Yeah, that's a good question. Um
I think it's still to be determined how
this all shakes out. There are some
customers, companies that we talk to
that are going full deterministic. They
don't use LM as a judge and then there
are others that are very much going in
the LLM as a judge route. And I think
the reason that there's a split is
because they both work. Uh so you know I
don't know I don't know how this will
eventually shake out if we'll reach in
the middle or if you know determinism
will win. Um, what I can say though is
that it's highly dependent on the use
case, the problem that you're solving
and experiment with both and then you
can determine which one is working best.
I guess those are like also largely
codebased, right? The the things that
you're talking about and so maybe they
lean a little bit more toward towards
that. Yeah, I mean I'd say they're still
kind of neural approaches are still
entirely deterministic, but thank you.
Yeah. No, I got you. Um it's it's sort
of like that that middle ground. Um
yeah, I don't I don't have a great
answer for you. I do think uh using
brain trust uh you you do have the
ability to at least configure both of
these the LM as a as a judge and then
the scorer and then you can again using
the the human review process find the
ones that that actually map to the the
right output the best and then that's
how you start to build your application.
But it's it's a really good question.
Thank you.
How's the activity going? I know we are
getting you know last 25 minutes of of
the session. We still have two more uh
little slide chunks to go through. So
maybe in you know two minutes or now we
could move to the slides and then keep
it going. Again this will all be
available after uh so feel free to keep
working on it.
Yeah, maybe just really quick, we could
run the the eval just from here. You
could see um
we're actually going to take the
the eval defined here, right? So, we
have our our task, we have our scores,
then we have our data set essentially
what we just did within the UI pushing
that into the brain trust platform. Uh
and then you can even see like this is
where it's running right now.
So again, being able to do these in a
couple different ways, either via the
the SDK or from the the playground
itself.
I think you explained this already and
maybe I was distracted by the Wi-Fi, but
how do I think about the difference
between the playground and the
experiment? Yeah, that's that's a great
question. Let's see if we can just
quickly go back to the slide.
Playground you could think of as quick
iteration
experiment. So a playground ephemeral
right experiments long lived historical
analysis
if that helps answer your question. Um
they're becoming more and more the same.
You know historically the experiments
had a bit more bells and whistles. So I
you know typically teams would gravitate
towards the experiments but we found
that they really liked the quick
iteration they really liked using the UI
and so we started beefing it up and now
they become pretty much the same. So so
yeah playground more ephemeral quick
iteration you want to save the work that
you've done to an experiment so that you
can later review it and see the scores
update and change over over time. I
think it throws me off. So when I do an
evaluate
in my text editor, I should use the UI
playground UI for that. Yes. And remote
evals which will allow you to define via
the SDK the eval but then expose it into
the playground. So some it's it's like
the bonus activity in the document at
the very end. So maybe you should check
that out and we won't have time in this
session but if you come to the one at
3:30 we will.
Any other questions?
Okay, cool. So, moving into lecture
three. Uh, so this is, you know, once
you've finished development, it's
reaching customers. You're in
production, right? Now, what do you do?
Well, the the important thing is
logging. You want some observability.
You want to understand what's going on.
How are they using it? Are there any
gaps? Are they unhappy?
It can help you debug. uh a lot faster.
It can allow you to measure quality
instantly on that live traffic. You can
turn those production traces, what
you're logging, you can turn it into a
data set and bring it back into the
playground, keep improving the prompt
and you know it allows a lot of
nontechnical people to understand what
the end user is thinking. So you can
close this feedback loop. We have a lot
of PMsmemes
using brain trust and going through the
logs and and looking at that user
feedback to understand what gaps and and
improvements may exist.
So how do you log into brain trust? Uh
well this is done via the SDK right it
needs to plug into your production code.
Uh so these are some of the the steps
here or the the tools that you can use.
So you know you need you need to
initialize a logger that will
authenticate into brain trust. It will
connect it to a project. So now your
logs will go to a specific project inbrain trust. Um some great ways to to
get started with really one line of code
is to wrap your LLM client. So you can
use wrap open AAI uh around that LLM
client and now any communication will
get logged with your prompt response.
also uh metrics. So how many tokens were
sent back and forth, the latency, all
errors, everything just by adding that
that wrap open AAI. You can do the same
with Versell AI SDK. Uh or you could use
OTEL. So we also integrate with OTEL. Um
so if you want to go that route, it's
also available.
If you want to log and trace arbitrary
functions, we also support that. You can
just use a trace decorator around the
function. um really helpful for keeping
track of any uh functions that are
helpful to to understand and keep track
of. And then if you need to add
additional information like metadata,
you can use span.log. So it's it's very
capable, very flexible, but there's
still these, you know, oneline code ways
to to get started.
So now that you're pushing all of your
logs into Brain Trust, you're capturing,
you're observing real user traffic, now
we're going to get into that, you know,
online scoring piece as opposed to
offline, right? So online is measuring
the quality of live traffic. So you can
decide how many logs that are coming in
will get evaluated and scored. Uh it
could be 100%, it could be 1%, it's up
to you. This allows you to set early
regression alerts. So if it starts
dropping below, you know, 70%, 60%,
ultimately it depends on the score that
you're using and what you've established
as the baseline. But if it starts
dropping below a critical amount, you
can set up alerts and notify the correct
team. Uh you can also AB test different
prompts. You can set up tagging and
understand, oh, this trace coming from
this user is from prompt A versus this
one from prompt B. And you can compare
uh the the grades, right? that the score
results coming back in.
So, this is great for just improving
feedback, moving quickly, and
understanding if there's been a drop in
quality.
How do you create an online scoring
rule? Well, everything is done via the
UI. You go to your project
configurations, click on online scoring,
and then you can add your rule. This is
where you'll define what scores you want
to be used on that live traffic. And
then uh crucially that sampling rate. So
maybe at the beginning you start with a
lower sampling rate and then you can
increase it once you trust the metrics
coming in. You can also choose what span
you want this online score to run on. So
it defaults to the root span but you can
get more granular and specify you know I
want this nested child span to be uh
scored.
Once you start collecting these logs,
collecting these online scores,
oftentimes teams want to view them in
interesting ways and customize the
lenses on those logs. So that's where
custom views come in. You can apply
filters, sorts, you can customize
columns on the logs with whatever
information you'd like. And now you can
start saving those views and making them
available for the rest of your team to
just come to the logs and select, oh, I
want to go to, you know, the logs under
50% view or, you know, their own custom
view that they've made that's specific
to what they care about. Uh, so it's
it's a great way of collaborating and
and uh speeding up the process of
viewing the important things to you.
Great. So, you know, we went through the
slides. Now, we would jump back in to
the
to the activity document. There we can
look at the actual uh code, see where
the the logging is being captured in our
files, spin up the application. So, you
can actually view the application in
your dev environment, interact with it,
and you'll see those prompts and outputs
being logged in Brain Trust. Uh, so if
if you've gotten that far and you have
the the dependencies installed, then I
would recommend doing a PNPM dev and now
you'll have your application up and
running, interact with it a few times
and uh you'll see that populate in your
project logs.
Once you do that, then you can go to
your online scoring settings, set up a
rule, and you can keep interacting with
the app. And now you'll see it um
populate with that online score that you
just enabled.
Maybe quick example for for those that
are still having sort of Wi-Fi issues.
Uh come back down here.
So, I'm going to come and uh spin this
up. So, as Carlos mentioned, uh PNPMdev,
this is going to spin up that server on
localhost 3000. Uh you should see
something that looks like this.
Uh there's a few things that you can
just click these. This is sort of like
the easy button to get going. Uh this is
the the GitHub URL. It's again it's
looking for the the commits that have
been made since the last release and
it's going to summarize uh again using
the the prompts that we've configured
here and then start to categorize them.
But now the the interesting part of this
if you come back into the brain trust
platform
is if you look at the logs. So this is
what just happened on the brain trust
side. Uh so we sort of have this top
level uh trace the generate change log
request and then essentially the the the
tool calls you can think of as right
we're getting the commits we're getting
the latest release. We're fetching those
commits we're then loading that prompt.
So we're actually loading the prompt
from from brain trust and then you can
start to you know you can click through
a lot of these and as Carlos mentioned
when you use those wrappers you get all
of this sort of goodness out of the box
right so what are the the number of
prompt tokens what is the estimated cost
this is uh this becomes really helpful
as you start to monitor over time right
uh probably not set up yet because we
don't have uh too much going on but like
actually understanding what does that
token uh amount look like over time what
does the cost look like over time as we
change models uh and so on. But that's
how really easy this is. And maybe just
to complete that that loop, if you come
over to
the uh resource, not the resources, the
app generate route.ts, you'll start to
see some of this stuff. So, I'll just
highlight a couple things. We're
wrapping this SDK AI SDK model. So, this
again is is how we're really getting all
of that that that metrics and uh it's
it's really allowing for us to log a lot
of that information with very little
lift from from ourselves as developers.
But then you also have the ability to uh
configure things in a different way. So
maybe we have um different inputs or
different outputs that we want to
actually log in a particular span or
actually we want to log metadata, right?
This becomes really powerful when we
want to actually go into those views,
right? And we can actually start to
filter these things down. We can even
filter by that metadata. So uh this is
where again you can hit the easy button.
we're going to wrap our our LLM client
with those SDKs or we can actually get a
little bit more detailed and start to
log uh the particular input and output
information that we want metadata and
now we can sort of uh set these
different things. So if I come out here
uh I can even create uh actually when we
look when we add in the scores here we
can create filters based on those
scores. So I want to create a view that
says hey anytime my completeness score
goes below 50% I want to create a view
for this. This is going to enable my
human reviewers to go in and actually
understand that. And then if you look up
here in the top right, we can actually
add this span to a data set really
easily. So we find this thing, right?
That'll actually add a lot of value in
that offline eval type of process. Click
this. Now we have a net new row in that
data set that now adds a lot of value,
right? This is sort of like that that
feedback loop, right? We've we've done
that offline eval type of work. We have
uh found the right prompt, the right
model, all these different things. It's
in production. We are logging it. Now
we're sort of um understanding that
maybe in a human review type of way. Add
that span of the data set. This adds
again to the the offline type of
portion. Again, you just see this like
this sort of flywheel effect of creating
really powerful Genai apps.
Yes. Is there an uh generated for this
online log as well? Like as we ran it,
is there an eval created for it? and do
we add it to the data set based on if
the eval score is good because we don't
want like bad examples in the data set.
That's one way of thinking it. You don't
need to run an eval as the user's
interacting with it. That's what the
online scoring does. So once you set up
the online scoring rule, it'll output a
score based on the judge that you've
chosen as the the online scoring rule.
Um and exactly what you said, right? You
could either filter it and select the
good responses, add those to a data set
or vice versa, select the bad responses
and understand why are they bad, how do
I improve them, make them better
just to complete that and and kind of uh
how do we configure this? Right? We we
Carlos walked through like what this
would look like. Um this is you know my
score my rule, right? Obviously, you
would call that something a little bit
better, but I actually want to, you
know, uh, add in my scores for those
online logs, right? Then you would, you
probably wouldn't do 100%, but we're
just going to do that for for this
instance. And now when I come back to uh
my application here, right? And maybe I
want to do uh just do a quick refresh.
So now when these logs uh happen within
the brain trust side, we're actually
going to run those scores against that
output. So we'll understand based on
what happened here, how did it score on
formatting, how did it score on
correctness. Um
and then this also uh can now layer into
so you can see here we have a 25% on the
accuracy on 100% on the uh the
completeness. So maybe we have a little
bit work to do. But now if I click into
this, this is where you can start to now
create different things within uh the
like the the view portion here to ensure
like so this is a filter. So maybe I
want to change this to anything that is
less than let's say 50%.
Now I can save this as a view and my
human reviewers are able to now come in
here, open up this view and look at for
look look at all of the logs where my uh
accuracy score is less than 50%. And now
we can again create that sort of uh
iterative feedback loop.
Any questions on this section?
Yeah, maybe a good segue to uh the the
human in the loop. Um this this becomes
really uh you almost you almost really
Oh, sorry. Um I had a question about
using brain trust and implementing it on
existing projects. Is it is it something
that's easy to do with like a um
something like Langmith? can just add
like a couple lines and it'll trace
everything for you. Is it the same in
brain trust? Is it or do you have to
refactor all your prompts to use like
the brain trust prompts?
It's it's essentially the same thing. So
like you have linksmith has code to wrap
an LLM client, right? Or it has uh
decorators to put on functions. It's the
exact same thing on the on the brain
trust side. Got it. Yeah. So then if you
do that, is it easy to then use um like
create data sets from those logs? Yeah,
absolutely. As long as you're uh the the
logs that you're producing map to the
structure of the data set that you've
created, then absolutely it becomes
really just you click that button. We're
going to add that span to the data set
and it becomes really easy to connect
those two things. Cool. Thanks. Yeah, of
course. Yeah, good question.
Um, okay. Yeah. So, let's talk maybe a
little bit really quickly about the the
question over here.
Is there a way to just override that
certain
sample set?
The way that you would go about that is
changing the span that is targeted. So
instead of it applying to the root span,
you would specify a span that only
happens if a certain criteria is met.
Right? So then it could be 100% or 50%
of just when that span appears.
Okay. So yeah, this is where uh we could
we could uh bring sort of like the human
in the loop uh type of workflow. This is
where we want to actually maybe bring in
subject matter experts and Carlos
mentioned like uh product managers
maybemes we also have doctors coming
into the platform and actually
evaluating some of this stuff right
these are the people that actually
understand whether or not that output
that's created by that large language
model is valid is good right and this is
a really powerful thing to have as part
of the process to to building really
powerful AI applications uh we can catch
hallucinations being able to establish
that solid foundation or that ground
truth is oftentimes um you know having
that human in the review in the loop
type of person becomes really uh
beneficial here.
Uh so why does this matter matter?
Excuse me. Uh it's it's really critical
for quality and reliability. Uh like we
were just talking about like with LLMs
and being able to trust whether or not
they can do the same thing over and over
again. It's non-deterministic. I
automations can miss that nuance, right?
We want to be able to sort of apply that
that human type of um review to the the
things that we're doing on the AI side
with LM LLM as a judge type scorer. Uh
we also want to um help you make sure
the final product meets the the actual
expectations of the user, right? So uh
the user is going to have a much better
understanding of how to or like what the
uh final output should be. So having
that person in the loop to look at those
outputs uh becomes really powerful to
ensuring that you build really uh really
strong genai applications.
Uh two types of human in the loop. Uh
there is the uh the human review. Uh so
this is where these these people are
actually going to go into the brain
trust platform and actually manually
label score and audit those interactions
that the uh that the user had with the
the AI application. And then there's
actual feedback from the user real time.
Uh so this is like you know a thumbs up
thumbs down button within the
application saying hey you did a really
good job you did a really bad job but
now we can you can sort of use these
together as well. I can now create a a
view within brain trust that filters
down to any of my user feedbacks of
zero. So thumbs down and I actually want
to review whether or not those things
are bad and if they are bad I can add
those to the data set again creating
that that sort of flywheel effect.
Um, just really quick here, if if you go
if you look at that application, you're
able to actually uh click one of these,
you know, thumbs up or thumbs down, uh,
create a comment. Really good. And then
this is now logged back to the Brain
Trust application.
So, if you look back at our logs,
I'll remove our filter. Uh, so we should
have a user feedback score now here of
100%. And then we should have a comment
over here as well. Really good. But then
again, these are the things that we can
now if I open this back up, I can create
a filter on my user feedback score. Uh
now I want to understand all of my uh my
logs where user feedback is one or zero
and then I can do something from there.
But this is this is done very easily via
the log feedback function within within
brain trust. You provide it sort of like
the the span that that was already
created within that log and then you
just you log you provide that user
feedback to it.
Um you you can also enter uh really
quickly here in the platform. You can
enter uh human review mode. So this is a
way in which um it's sort of hiding away
some of the the different uh you know
some fields that may not be really
relevant for those people that are
coming in and doing human review.
Oh, I haven't actually configured any
scores yet. So, you can actually see uh
you would come out here and you would
create different uh scores for that
human to go in and do that review.
Whether it's uh sort of like an
option-based uh free form input uh
slider, so is this, you know, maybe
thumbs up, thumbs down, sort of like yes
or no, or maybe you could do something a
little bit more verbose, um ABCD,
whatever it is. But this is where you
create these scores. Now, they exist as
part of those logs. those humans can go
in and now look at the input and the
output give their review of it again
adding to uh that that again like that
that flywheel effect that we need to
create. Yeah, I wanted to add there as
well. This is really helpful for evaling
your LM as a judge. Oftent times we see
customers use this process to provide
some ground truth for their data sets
and also for the LM as a judge. Right?
So you can imagine having a team ofmemes
come in, they review uh they do thumbs
up, thumbs down on maybe five different
uh criteria qualities that they're
measuring and then they provide that
data to uh a playground where the prompt
is the LLM as a judge and they go
through the playground and they test to
make sure that the LM is a judge prompt
matches what the humans thought. So just
something there to think about, but as
Doug is saying, it's a great feedback
loop. It's a great uh flywheel effect
that can be created when you add this
human to to verify and confirm.
Cool. That that is it for uh the the
workshop. We do have a few minutes left.
Could certainly answer a couple more
questions.
So for people who are successful with
this, how much time are they going
forward
before they get into like more live
testing and then how are they going
back? What's the kind of balance
offline versus online? Ev,
how much how much you have to do up
front to really get best results or you
really just put something down, figure
it out later,
get analysis,
right? Yeah. The question just to repeat
it is how much time do you have to
invest upfront to get value? Should you
keep going over over it to try to
optimize or better to just start quickly
with minimal scores, minimal data set
and then uh keep improving? And I would
say the latter, right? You don't want to
to be fixated on creating a golden data
set or 20 scores. Like if you have one
or two scores and you have 10 rows in a
data set, it's going to be tremendously
helpful. And then from there, it's all
about iteration. So just going back and
improving, adding some more rows, adding
another score, tweaking the scores, but
you really just want to get started
quickly.
Yeah. Um so um you've mentioned um some
elements uh of this u uh scoring. Uh
there's the the function that you want
to test that you have to define the the
test steps if you will. Um one of the
challenges that we are finding is our
actual application does change and uh it
could change bi-weekly, it could change
monthly.
Is there a way to look at um uh trying
to automate changing the actual function
that you now need to change to match the
way that your application logic has just
changed uh this week from two weeks ago
when you say oh go for it yeah I guess I
was just going to again clarify to to
make sure I understood so you're saying
that the scorer the the actual scoring
function is going to
uh stop being useful. It's going to
become obsolete. It's going to become
too old to actually gauge the quality.
Not just the scoring function but the
actual steps that you want to uh test.
So you know this week there might be
only two turns just giving a very simple
example and in two weeks in the next
spring there are now five turns in your
app because the logic has changed and
now you you have to update of course the
I think the function element there's
probably no way around it. I'm just
curious about uh whether uh you guys
have uh thoughts about how that could be
improved or or made easier. Well, I
think your your task all will will
always change. Right. Right. The thing
that we're trying to to build Yes.
That's where brain trust helps because
we're going to understand when we do go
make that change, we actually understand
whether or not that change improved our
application or regressed it. So like
we're not going to say stop making
changes to the underlying. Yes. No, I I
real I understand that. So it it is
inevitable that the the application is
going to be uh changing. Yeah. And
you're going to have to constantly
update the corres the the test at the
test step the function that you're
actually wanting to mimic in your test.
It's very similar to traditional
software testing. Yeah. You don't want
to write a test that lasts for a day or
you know a week right you want to think
of of robust uh tests that will live on
for months or years and will actually
measure the underlying quality of the
application that will be longived.
So the I think it's more of how do you
optimize the scores to measure qualities
that will still be around even if you
add some additional steps in the task.
Uh no, it's worse than that because
unless you have those additional steps
in your function, you're not mimicking
your your application's uh logic.
You're still using the logic from two,
you know, last sprint. So no matter how
good your scoring could be, it's not no
it's no longer reflecting what your
application is doing this week or this
sprint. I I think like regardless of
like how many steps you have like
there's still an input and there's
there's still an output that we want to
score against.
Correct. Yes. But um I think one of the
things you need to do is to first define
how you're going to arrive at the score.
the the input comes in and now maybe you
have three turns
and then because you're mimicking your
app and then you get your output from
these three turns
your app just got upgraded they're now
seven or five turns or whatever. Yeah.
So the when you're writing the evals you
can dynamically call the task. So even
as you're working on your application
and it's changing, you're still pointing
to the the changing app. So the idea is
that when you are wanting to merge into
main, you open a PR and then your evals
will run on those new changes. You don't
need to go in and update the eval.ts
files. they will now reference the
updated uh task application that you're
trying to understand the underlying
quality for if that makes sense. So I
think the the question again is are the
scores is the underlying logic something
that you can trust and that will live
on. Um, again, it's not easy and it's
something that is changing. Uh, but
that's that's what we're hearing from
customers is investing in that
brainsmemes.
What's the name of that role and how are
you managing that? Like I'm guessing to
some extent it was originally the team,
right? But that can't scale. So how are
you managing that?
I think it's like organization specific.
I don't know if there's a specific I
would say your organization using your
own tool. How are you managing yourself?
I don't think we're using anymemes at
the moment. We don't we're not a
healthcare company or a legal tech
company where we heavily rely on
specialized knowledge in that degree,
you know. Um you're not doing human
evals of your own product.
We just now started we just now branched
into having an AI component to our
application. Uh so we haven't needed to
to go there just yet. But we, you know,
we talk to a lot of customers that are
working in in those specific industries
with those use cases and they will
sometimes hire external uh services that
will do the the the annotations for them
or they'll bring them into Brain Trust
and you know they'll be using the
platform just to to review. So they have
a specific role within Brain Trust and
there's a specific view that they would
operate in that's just for annotation.
Yeah.
Great. Yeah, another question over here.
Uh I just I was just curious that
because we're using out of the box AI
models here and are not really fine
tuning the model as the application
progresses. Are we do we have a way to
like do some few short example prompting
from the data set and the eval scores
that we are already using. So is there
some feature like that where I can use
the data sets or the online logs that
are added to the data sets. If the eval
score is good, use it as an example for
future prompts to just make the prompt
better because the models are out of the
box.
Yeah. So question around fshot prompting
providing examples to the prompt of the
ideal response. That's something that
you can do today with in the data set in
the metadata column is where you can
provide the the few shot examples that
you want for each row and then when
you're running that eval or messing
around in the playground, it'll
reference the few shots in the metadata.
Got it. But what about like the online
testing stuff, right? Or the online
logs, whatever you call it. like when
users are actually using the application
and it's hitting the prompt there can
the prompt real time use those uh
examples from the data sets as well it
right now it's not it's not not
something that brain trust facilitates
within the SDK and building your own
logic like you could come up with a
workflow like this but natively in the
platform we're not facilitating like
live traffic into few shot examples got
it makes sense
Great. Well, thanks everyone. I know
we're over time. Really great to have
you all here for our first workshop of
the day. I hope you can walk away with
some ideas of how you can improve your
eval workflow. And you know, our team is
here. We have a booth uh just outside of
this. So, feel free to stop by. We can
answer more questions, have a
conversation. Yeah. Thanks everyone.
Thank you all.
[Music]