[music]
>> Hello everyone. Welcome to this session
about your finance agent's bottleneck is
you.
So, sorry for the rude title.
I don't mean to call
the audience here the bottlenecks, but
I'm here to talk about the harnesses
that you guys are developing and using
these internal harnesses to build your
production agents.
So, my name is Siddhant Imani
and I'm a data scientist at Auditoria AI
and we build production agents for
finance.
So, if you're a CFO in the audience, I
would love to speak to you after the
session.
This talk is in between the harness
engineering track and AI for finance.
So, this talk is mostly about
identifying the bottlenecks within your
developer
and if you're a developer yourself, how
do you be 10x productive with
the agent harnesses that you're using.
So, all of us have seen, you know,
beautiful demos in this AI engineer's
world fair.
But, once these demos are promoted to
pilots and you start onboarding new
customers,
the agent has
never seen these future data.
So,
all of us know production bugs are very
high
and production guards built by the hour.
So, that's a hard fact.
And writing code is very easy. So,
shipping beautiful demos and showing it
to a lot of people is very easy right
nowadays.
So, what is the problem?
And why do these demos fail in
production?
Is it the model? Do you need a better
model? Fable 5, perhaps?
Or do you need faster GPUs?
Or
do you need a better framework? Maybe.
Or your RALF loops are not working
properly.
So, what is the answer?
If you wait 3 and 1/2 months, we are
awarded with a new model in the market.
So, we can easily swap models.
If you wait perhaps 1 year, we have new
chips. We have faster GPUs.
And
again, writing code is easy. So, we have
new from frameworks every day.
So, you can swap your framework every
now and then.
So, how do we
in real time fix these production bugs?
The answer is your dev loop velocity.
The model capability increases very
exponentially.
And the developers have to spend a lot
of time
every day to automate your developer
loop.
So,
I'm talking about four primitives here.
All of you need to think about loops.
And at the end of the session, I hope
you can 10x your production code.
So, first we have sub agents. Nowadays,
whatever harness you're using, you can
spawn new sub agents. You can have a You
can have an army of them.
And get work trees are your best friend.
So, think of work trees as isolated
folders.
And inside these folders, the agent
writes whatever code it's generating.
So, you want these work trees to be in
parallel.
So, the sub agents are doing independent
tasks and are not
fighting over the same thing.
Second, we have skills. These are your
organization secret recipes.
So, make sure you have a lot of skills
because
these skills, once you start
say giving it to your agents, the agents
will always make sure to use the correct
and proper workflows to solve whatever
production bug you're facing.
And of course, all of us have seen a lot
of MCP tools being shipped into the
market right now.
Everybody says we can, yeah, the agent
can connect to whatever MCP tool and
whatever third-party server there is.
And your client data can live in any
system you want.
And at the end of the day, if you have a
lot of sub-agents, you have a lot of
work to orchestrate. So,
minimal UX is the key here.
Let's look at the sub-agents. With you
as the orchestrator,
you can have, let's say, with 48 GB of
RAM on your MacBook, you can have 50
active work trees. That is 50 active
sub-agents working independently on
different tasks.
So, where do these tasks come from?
So, let's say the production software
you're going to ship has a lot of bugs
that your QA is reporting.
So, all the Jira tickets can be thought
of in a separate different work tree.
So, different work trees are handled by
a separate agent, and these agents can
spawn multiple sub-agents to solve that
particular task.
You don't want to queue up your tasks
because the agent is will do that a lot
better than you.
Let's look at, you know, um, an example
harness.
What if
the QA reports a lot of bug tickets, and
somehow magically there is an agent
which parses the requirements, does a
root cause analysis,
pulls all the traces, pulls all the
logs,
puts all this in a separate work tree,
does the TDD,
does the, implements the fix.
Because it's in your local system, you
have to do test scripts, local
end-to-end testing.
You create a PR. You submit the PR to
your team for review.
And after review, you merge it into your
master branch, let's say.
After merging it, obviously, you have to
build a Docker image,
deploy it into your development
environment, test it,
again ship build an image to your stage
environment, test it, deploy it to
stage.
And then you go back to the QA saying,
"Here you go. You can test it now."
So, I would like to ask a question in
the audience,
um
at what points do you think the human
contact is required in this, um steps 1
to 9?
So, I would say the human is only
required at steps 1 and 9 because the
in-between steps, the agent can do a lot
better work.
There needs to be a human to see what
work the agent is doing. And then needs
to be a human at the end to validate
after the work is being shipped to
stage.
And obviously, we need minimal UX
because humans love minimal UX. So, in
the image, if um you can if you squint
your eyes and see, the image shows um
the production agent software that
you're building,
the project dashboards which shows all
your Kubernetes services, pods,
examples,
all the logs, system logs, all your Jira
tickets,
all your GitHub PRs,
and maybe a cloud code session at the
bottom.
So, this is basically a macOS widget,
and you don't need to open multiple
windows to do all of this work.
A developer does like variety of things
in their software development life
cycle.
So, you can use just this one widget to
do a lot of things.
So, you can see from the graph also, the
number of neck rotations to ship one
change like reduces a lot drastically.
And I imagine all of you have like two
to three monitors on your table and you
just keep rotating your neck
orchestrating these agents.
So, Auditoria works in finance. So,
there's a lot of regulation and policies
happening in finance right now.
So, what does it look like for
orchestrating a team of sub agents in
the finance sector?
If we take AI out of the picture,
usually what happens is you have a human
auditor which reviews the code
and you have a controller which signs
off under your socks compliance.
And
reviewing agent to agent,
it it doesn't
Where do you keep the accountability? If
something goes wrong in production, you
can't say Cloud is doing this. Something
is wrong.
So,
but let's say you have all these sub
agents and you're using this harnesses
to fix bugs in real time.
What is the bottleneck?
It becomes a human attention because you
yourself have to orchestrate all these
different tasks.
And moving fast and breaking things in
sector in the finance sector is a lot
different.
So, let's look at part two, which is
removing yourself from the loop.
Till now I've been saying a human is
required to see what the agent is doing
and at the end also to validate what the
agent has done.
But with the self-improvement of the
agent and model capabilities these days,
we get
Fable 5 and Mythos 5 and
GPT 5.6 also.
So, what does it look like when you have
this recursive self-improvement in your
internal developer developer harnesses?
So,
all your production failures become
input.
So, let's say you automate keep
automating these cell developer
harnesses every day and you ask the
agent to upgrade itself essentially.
So, you do a task. You let the loop run.
Let's say one or two days. You solve
five to six bug tickets. And you just
tell the agent to analyze all the
bottlenecks in this process.
Make a list of them. And somehow slowly
keep removing these bottlenecks every
day.
At the end of one month, let's say, you
have a really nice self-automated loop
where you just type in one sentence and
just say fix this bug for me.
And the agent goes off, connects to all
your database systems, fetches all the
logs, traces, tickets, and ships it and
migrates it migrates it to the Jira to
QA pipeline.
And you can just book a vacation maybe
or work from home.
And what does it look like internally
and
what happens when you stare less and
ship more?
Nowadays, how many of you know you can
give goals to your agents? You can just
set a goal and forget about it.
Anybody?
Nice.
Um so, what if you combine goals and
loops? You can just set a goal saying
there is some data discrepancy in this
report. And in the production bug like
the source data is not matching with
what the agent has generated.
So, you can just set a goal to fix this,
look into this, set a loop.
You can even close like close your
laptop because you can do it from your
phone nowadays.
And
if you look at the last but one point,
which is dreaming,
um let's say a lot of are using your
production software and they are
doing the same type of patterns and
they're facing the same type of
problems.
So, you let the agent dream like humans
dream in the background so that it
collects all the sessions that your
customers are using
and compacts it
into a set of data points which your
system can use and basically [snorts]
upgrade yourself.
So, with a combination of all these
features, basically you can essentially
remove yourself out of the loop.
But,
as I said before, the developers do a
lot of variety things in their software
development life cycle and sitting
behind a desk from 9:00 to 5:00 and just
writing code is not
valid anymore.
So, just an overview of what I've
covered till now in the session.
You can have a team of sub agents
working in parallel work trees.
You can have skills, your organizational
secret recipes, your customers recipes.
You can give all of these to an agent.
Your agent can connect to whatever
third-party server there is. It can be a
logging system, it can be an
authentication gateway.
And you just compress all of this into
one pane of glass because minimal UX is
the key.
And you can set goals and loops for
autonomy. If you think
this particular work can be done by the
agent a lot better,
you can just ship it to the agent.
Always have the human as a verifier, but
not the throughput ceiling because human
attention is very limited.
So, thank you for your time and
thank you for your Thank you for
I hope you um learned something from the
session. Thank you.
>> [applause]
[music]
>> Hey.