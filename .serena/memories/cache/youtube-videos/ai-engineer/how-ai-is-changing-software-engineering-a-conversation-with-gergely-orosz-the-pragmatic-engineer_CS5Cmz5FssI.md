How AI is changing Software Engineering: A Conversation with Gergely Orosz, The Pragmatic Engineer

Your game.
All right. I I going to assume most of
you Show of hands, who subscribes to
Pragmatic Engineer? Oh my god.
>> Wow. Uh he is
he needs no introduction then. Let's get
right into it. Um
What is token maxing and should everyone
here be doing it?
So I I heard about token maxing a week
ago or like week and a half ago first
and you know, some people have been
doing it for longer and I tweeted about
it I think 3 days ago saying, "Oh,
there's this token maxing." And again,
you you see it on social media and my
DMs were blowing up from from people at
large companies. I don't want to name
names, but like you know, Meta,
Microsoft.
Uh some some some other ones as well
like
the likes of IGN and and so so many more
and the story is a little bit different
every every company on why people are
doing it and whether they like it or
whether they think it's good, but
there's a few few common things. One is
token output at these larger companies
is measured in in some way. There's like
either a leaderboard or there's a way to
look up your your peers. Salesforce for
example, you can check the spend the the
money spent at every every person at the
company did. You can like search in a
tool that someone built and it shows how
many dollars they spent on on AI related
tokens.
And you know, first there's this number,
then there's this uncertainty on in the
tech industry, right? We're kind of
hearing layoffs like massive cuts at the
likes of Block and I mean, they're like
no matter how much tokens people spend,
they were let go independent of this,
but people start to think like, does is
it part of performance evaluations or
promotions or all that? And the answer
is,
kind of. So, inside of Meta, I talked
with managers, and in the performance
evaluation, they have this data point,
which is one of many data points, right?
The same way as as like diffs or impact
or or code reviews of how helpful this
person is. But, they do, just like with
any data point, they sometimes pull it
and use it. So, typically
just like any data point, it can be
weaponized. So, like a low performer
with low impact and a low token count,
clearly not even trying. So, and a high
performer with high impact and high
token count, clearly that's innovating
and this must be doing good. So, inside
of these companies, specifically I
talked with a lot of people at at at
Meta. And again, this is not
representative of 100% of Meta, but they
had this leaderboard where people showed
up and they have like massive amounts of
tokens. And a lot of engineers got just
scared, worried. So, they start to token
max to try to generate tokens. Stories
that I've heard first or second hand
from these people who who who told me
first hand, is for example, instead of
reading the documentation, I will ask
the agent to summarize it for me and ask
questions even though it doesn't do the
good job answering it, but my token
count goes up.
People just want to not be on the bottom
25% or bottom 50% for token count where
these things are measured. Inside of
Microsoft, again there's a leaderboard
and I'm talking with people, they're
like, it's ridiculous like how some
people are just running autonomous
agents to build junk, honestly, for the
sake of having that number go up. And
and sometimes it gets ridiculous cuz
like inside of Meta, they had this
leaderboard, they got rid of it after an
article came out and it looked them a
stupid, honestly. So, whoever built it
like just just like closed it down. But,
people are still token maxing, by the
way, because there's this this thinking
that it might have gone, but you know,
we're engineers and don't forget these
are high-paying jobs, right? Like, you
don't really want to lose a job over
something stupid as like you didn't have
high enough token count. And that's how
it feels. But, inside Salesforce,
there's a target of minimum spend per
month. Like I think it's like $175
between things. So like people are like
again, you kind of like you know,
beginning of the month like just token
max to get there. So it's it's it's
weird and it started as a joke earlier
like a few months ago token maxing was
really just people like going crazy and
enjoying this thing and building cool
stuff, but it's kind of turned into in a
lot of companies. I think it's just a
culturally weird thing. So it's a weird
time to be in because I remember lines
of code used to be when early developer
productivity tools came out like
velocity and Pluralsight flow. They kind
of measured lines of code and and number
of
QPRs and we know that was stupid and
people kind of optimize for that at
companies that did it, but it's it's
almost like now it's the top running
companies like meta, Microsoft who are
incentivizing people to just to do just
stupid
stuff, honestly.
Yeah, those are wild stories and one of
the things you're clapping for that.
That deserves another full conversation.
Uh one of the things I like about
talking with you and subscribing to your
newsletter is that you basically kind of
anonymize all these stories from from
real incidents and real examples. Um
why is it that uh
is is it still worth it, right? With all
the flaws,
uh you know, when you have Goodhart's
law like what what whatever gets
measured gets sort of abused. With all
the flaws, is it still worth it? You
know, is is AI basically still making us
faster overall? Like the cost of token
maxing is still with all these like
really ridiculous examples, is it still
net worth it?
Yeah, so don't forget like the reason
token maxing is probably a thing is like
let's just go back to 6 months ago where
I I I was at a
I was at a CTO like dinner conference,
whatever. Like a bunch of CTOs gather,
CTO level people. This this was in
Amsterdam and we had like like a bunch
of people and they were talking and and
one of the CTOs like the the the Amazon
of the Netherlands there's a e-commerce
company was saying like hey like
everyone like I have a problem like
engineers on my team are really
skeptical of AI and they're not really
using it the AI tools. Don't forget this
was before Opus 4.5 and those models
were were out there were not as as
productive. We had
we were already had a cursor and and the
like and they subscribe they're like it
there's not using it that much on
existing code bases, right? And and next
to them
uh
the head of the Dutch National Bank said
like oh we don't have that problem our
engineers are using it cuz our our
mission is to regulate this thing so we
need to understand it and they're kind
of motivated. And there was this time
where experienced engineers were kind of
holding up because if you had an
existing code base and use AI cursor
whatever on it it was mildly useful if
that even and these engineers were like
why should I use a tool if it doesn't
help me refactor it doesn't find the bug
it doesn't do what I need to do and
leadership saw they're not really using
it and they kept hearing you know the
likes of Anthropic for example was
already saying how they're writing a lot
of their code with with cloth code
and it just keeps increasing and
Anthropic's you know like revenue is
going up like this. So those leaders are
kind of
they might be confusing correlation and
and and you know like which one comes
first but they're like well we should be
using it more because probably good
things will happen and does bad things
will happen if we don't use it. So the
whole targeting and measuring things
that actually came from leadership
wanting we want our engineers to use
freaking AI I don't care what it is and
it was a bit of a push like we know this
is bad but it's it's better than not
using it. The best example is Coinbase
where
Brian Armstrong the CEO just like fired
an engineer or he sent an email saying
everyone like needs to get on board and
use AI tools and whoever doesn't use it
in a week I'll have a conversation with
them and then like a week later or
Saturday he fired an engineer and you
know, like this again high-paying job
like we're talking base salary like
3-400k thousand dollars per per year and
then both
equity and everything on top of it. Like
they got the message everyone just
started to just, you know, like use it.
And
you know, back to your question. So on
on one end there there's a push and look
I feel it's a little bit like this is
going to be controversial but have you
ever worry wondered why Big Tech love to
do lead code style interviews
algorithmically interviews which have
nothing to do with the job and and we
know it's the case.
And there's a lot of criticism for this
and they've been doing this since since
like 20 years. But here's the thing it
selects for a specific type of person.
It selects for the person who's smart
and willing to put up with absolute
to get the job.
And this person, you know, they will
study two months pre-AI, two months or
three months or of lead code which again
makes no sense on the job but you do it.
You get in there and this person will be
putting to put up with that
makes absolute no sense to keep the job.
So
token maxing happens at large companies
and people are putting up with this BS
and look a lot of them are smart and
they will make the most of it. Some of
them will build cool stuff.
Uh
it's it's the reality I think of Big
Tech. So we're in this weird place where
Big Tech is a bit weirder than startups
where you know, no one cares about token
maxing they care about like just
building stuff and you know, use
whatever makes sense. Don't people will
care about the cost. Yeah. But going
back to your question like like you
know, like is it is it making us
productive as as as a whole? Like
individually it's it certainly is and as
teams we're kind of like a bit question
mark cuz we should be moving faster and
there are a few companies that do.
Anthropic is a good example but a bunch
of companies are like not. It's it's
it's it seems it's hard to retrofit all
this AI into like the way we have been
working. Yeah.
One of my favorite studies from last
year was the meter study where they
did a blind test of people
and their expectations of productivity,
right? And basically the the end result
was they felt 20% more productive, but
their demonstrated results was actually
they were 20% less productive on
average. Yes, but that that study was
very interesting cuz they
>> It was very small sample size. It was 30
people and there was an outlier who
actually was way more productive.
>> we we interviewed him on the pod, yeah.
Yeah. Yeah, so he was the one productive
AI engineer.
And but anyway, so actually my theory is
that
something that I've seen on my team is
that we've I've been enabling coding
agents for the rest of my team who are
non-technical, right? And
you as the engineer may not be more much
that much more productive because and
you can be more productive if you attend
AIE, but
if you actually enable your non-coding
your non-coding collaborators to code,
actually they are more productive cuz
they don't have to wait for you.
Right? And and that's that unlock of
like oh, suddenly you have serverless
developers, basically. And I think I
think that's that organizational coding
thing is different than studying pull
request level productivity
for the individual developer.
>> Yeah, and and the thing that still I
still remember to this day I I talked
with Simon Willison, I think in 2024, so
2 years after ChatGPT came out and he
was Simon Willison top commenter on
Hacker News or he's he's he's actually
That's his That's not his title, man.
Top commenter on Hacker News. What the
No, he's Creator Django, top blogger,
yeah.
Prompting actions,
Yeah, he's actually not top commenter,
he's the most submitted blogger cuz he
blogs so much. Like like and he's
But he told me back then, he said like
this thing AI is is just so hard to to
get good at. He's like there's no manual
and he's like I've been doing it back
then for 2 years and I'm still I'm still
figuring out what works and what
doesn't. I keep changing my workflows.
And I think that's something that is a
bit hard for us two things about AI that
for any of us engineers are hard to
understand. One is it just takes a long
time to get good at it and you need to
keep doing it. And the second thing is
understanding the theory will not make
you better at using the tools, which is
an absolute mind honestly, because
we're so used to, you know, you
understand how the compiler works, how
assembly works. Okay, you will now be
more efficient if you want to write
low-level code because you know how it
works. But what with these things, I
mean, you you can of course it's helpful
to understand how
how the the architecture underlying
works, attention,
the the different the the different
probability sets, etc., etc., but it
will not help you get a sense for how
you can use it. And then once you figure
out how you can be more productive if
you're if you're inside of a team,
again, it kind of breaks and you have to
relearn again. But but the more effort
you put into it, it like it's clearer
that it's it's working, it's helpful.
And I think it it's the teams I'm seeing
getting more value out of it, low ego,
open to learning, open to leaving your
priors behind. The word priors I have
not used forever and I feel we're in the
stage where like just just leave your
priors behind, just have an open mind.
You don't leave your experience behind,
but, you know, be open to it. Yeah.
Zooming out a little bit, how is the
role of the software engineer changing?
I think it's always this was always
coming, but AI is just just speeding it
up. Uh
even before AI, a few
It's interesting I see like startups in
in many ways venture funded startups are
kind of front running what the industry
will be catching up cuz venture funded
startups are about fast growth, um
doing thing
mov- moving fast with smaller teams
because smaller teams mean mean smaller
companies even pre-AI. So, a lot of lot
of these venture funded startups started
to expect a lot wider range of roles
from engineers. For example, DevOps as a
whole
inside VC funded companies from the
mid-2010s, every engineer was kind of
like responsible for the code they
deployed, but like more traditional
companies they had more money, more
sorry, more less pressure, they kind of
dedicated DevOps teams and some of those
things. So, in in the industry like the
software engineer is now becoming like
the kind of the tester role has
collapsed into software engineer. We
most companies don't have dedicated
testers, very very few do. DevOps
collapsed into here.
And now we're starting to have the
product role also starting to come. So,
a lot of companies even like in 2022
before AI started to hire for product
engineers, that's happening faster.
And I think the the last push that AI is
doing is even for early career
engineers, there's a lot more seniority
expected or senior like things, planning
about things, knowing about the
business. So, I I I I I I I I I I I I I
I I I I I I I I I I I I I I I I I I I I
I I I I I I I I I I I I I I I I I I I I
I I I I I I I I I I I I I I I I I I I I
I I I I I I I I I I I I I I I I I I I I
I I I I I I I I I I I I I I I I I I I I
I I I I I I I I I I I I I I I I I I I I
I I I I I I I I I I I I I I I I I I I
talked with someone at John Deere,
200-person
200-year-old company, sorry.
You know, like they do tractors and and
all all all that stuff and
and inside of that company one of their
their VP of engineering was telling me
how they're actually seeing that their
two-pizza teams are now just one-pizza
teams inside of that company. It's the
reality partially because of these
tools. So,
>> My joke used to be I am a one-pizza team
because I eat a lot of pizza. But,
depends how much pizza you eat. Uh
there's So, I'm sorry to interrupt. I
don't know if I cut you off in some
critical point. There's a comment saying
I've heard it twice even among this
audience where a lot of people are
saying that oh, you're no longer
engineer, everyone's an engineering
manager now. And you've been an
engineering manager and I wonder if you
agree with that or if you have a
different take, you know, because
basically you're the the the common
analogy is that you're no longer a
software engineer, you're just managing
engineering agents, right?
Yeah. If you've been a manager before,
that is an absolute
So, so here here's the thing. The
like yes, you are a manager without all
the
things that no one wants to become a
manager for. The the When you become an
engineering manager, hands up if you are
or have been an engineering manager.
Right, hands-up if you actually if
you've not been and you want to be one.
>> 15%
>> All right, you you come and talk to me
afterwards.
I'll I'll I'll tell you there was a hand
up there. I'll talk you out of it. So,
So, what you think you become an
engineering manager to like help
people's career, maybe have higher
salary, higher impact, all you know,
there can be a lot of dynamics, but the
reality is is is you you become more
removed from the product and you have to
deal with people problems. And the thing
with with agents is you don't have to
deal with people drama, people problems,
conflict between your team. I mean,
unless the next generation of agents
start to fight with each other, I think
that'll be something. But, you actually
you you do have to orchestrate, but it's
more like a tech lead role or or
experienced engineer where where you're
like mentoring
mentoring engineers, but you don't have
the people management, you don't need to
worry about the personal problems. So,
it's actually a lot more kind of
empowering. And I was talking with the
podcast that was was just out yesterday
with with DHH, creator of Ruby on Rails,
who said, you know, people tell told him
like, "Okay, it's it's like managing
things." And he's not excited about
managing agents, but he feels it's more
like a mech suit where you have like you
can do seven things at once, you can do
it a lot faster, and you're in control.
And that's more what it feels like. So,
there's orchestration, yes, but it's
very different to management. And also
the the really really bad thing or
honestly shitty thing about management
if you if you make it into management,
which makes it hard, also rewarding
later when you you tell yourself at
least this thing,
is you start a project with all these
people under you, you know,
congratulations, you've got 10 people,
wonderful. And you start a project, and
in 6 months you will see some results of
the decision that you made. With agents,
it's just so much faster. So, the the
feedback loop is faster. So, I think
it's it's not much of it except for the
orchestration. And and and for that,
everyone's going to have their own
flavor. Some people will will have the
tendency to like run multiple agents,
and they're good at this or we're good
at it. Some people just do like two
agents. Michelle Hashimoto, interviewed
him, he has two agents. He always has
one agent running
No, he has one background agent that he
does That's it. He's like, "Two is
enough for me." Great. Yeah. Yeah. Uh
we're going to figure out the patterns.
Um
Uh I want to hit you on large tech
infra.
Uh this is something that I think both
of us are very excited by by
good infra, which is a very niche
interest. What are you seeing?
It's wild to see how much of the So, I
said that from externally, a lot of
companies, a lot of big tech companies,
especially the ones that are spending a
bunch on AI and have platforms and all
that, you're not seeing too much like
more come out. Like Uber is a good
example. I'm not seeing too many more
features come out of Uber or new
products launch. And they're like, "But
what's going on?" They are really
investing in AI. But when you look
inside, there's a whole lot of buzz.
They are rebuilding their complete
infra. You know, they're And I'm not
talking about they're buying cursor or
or cloth code or all that. They're doing
that as well, but they're completely
They're building their own custom
background coding agents that is
integrated into their mono repo. They
are are having
their own MCP gateway that is is now
integrated into service discovery. Their
on-call tooling is being retooled. Their
internal code review system is like like
categorizing based on risk. They are
like And Uber is one example, but
everyone else,
Airbnb, Intercom, Meta, Microsoft, even
mid-size companies are just building so
much internal infra. And I was asking to
myself like, "Why?"
It On one end, it feels like such a
waste. But when I worked at Uber for 4
years, I realized
they spent so much on on internal
platform, there's two reasons. One is
honestly, it's a it's a low-risk way to
get good with AI,
to be hands-on. And these companies want
to be hands-on, but maybe you shouldn't
start with shipping AI features no one
wants into your code base. Second of
all,
because these these companies have such
so much code that never fit in a context
window, by building custom solutions and
just basic basic dragons, that kind of
stuff, they will have better results
than off-the-shelf vendors. So, they
already have a win. And number three,
honestly, is anything that has AI in it
gets funded. So, there's this joke of if
you're in the developer platform team
and you're asking for more headcount,
like good luck with that. Oh, developer
platform? Oh, but say that you want to
get two extra headcount for agent
experience.
Done.
Uh so so there's that part as well. But
but all
>> Agent experience is just a CLI. Yeah.
Pretty much. But all this inside there's
so much buzz and so much work.
Everyone's building their own custom
systems. So, I'm kind of wondering how
long this will take, but I think for
next year, this is going to happen. So,
if you either have friends or if you're
work if you're working at a company,
you'll see. But talk with with friends
at other large companies and you will
probably see you are all building the
same thing. If you're at a large company
and you're not already building an MCP
gateway, what are you even doing?
Yeah. Um
actually, a lot of these topics are
exactly the things I curated for
tomorrow. Uh so, it's just a fantastic
to have you as the closing keynote for
today because uh it's it's like a
appetizer for tomorrow. We have talks
about MCP gateway and all these sort of
AI architecture and infra things. And I
do think like uh infra like
taking AI infra seriously as a company
is
uh very mis- not well not that well
understood. And right now, you just kind
of learn by example from people because
there's not really like a a textbook or
anything like about it. So, the way I
think about this because again, from
if you just kind of step out and we love
to criticize big tech of how they're
wasting money here and there. And by the
way, we love to criticize Google. And
I'm kind of thinking to myself like hang
on, what if Google actually executed
well?
Like do we want that? And you know, that
would kill all the startups. But but but
what they're doing makes makes sense.
And Shopify is an example where I'm
like, "Huh, I'm starting to get why it
makes sense to do all this stuff." So,
Shopify in 2021, they were the first
company to have access to uh GitHub
Copilot. What happened is the the head
of engineering, Farhan Thawar, heard
about GitHub Copilot being developed
internally inside of GitHub, and he
pinged Thomas Dohmke, the CEO of GitHub
at the time, and said, "Hey Thomas, I
heard you guys are doing Copilot." And
he's like, "Yeah, we are. It's
internal." He's like, "I I'd like to get
access to it." He's like, "Yeah, but
it's not for sale." I was like, "No, no,
no. You don't understand. I I didn't ask
if it's for sale. We would like to roll
out to all of Shopify, and in return, we
will give you feedback for 3,000 people
for, you know, as honest feedback all
the time." And so, they got it a year
before it was out anywhere. And they
incurred a lot of churn. It wasn't that
great initially. And and they went
through all of this stuff. And then,
Shopify was the first company to onboard
to like a bunch of other tools, and they
gave unlimited budget. And they're
spending so much time ironing out bugs.
But the reason they're doing it, this is
what like made me click, is they are
trading off churn and expense and
spending a lot more money to be at the
forefront of this. They are a few months
ahead, or six months ahead of their
competition, and for them, it's worth
it. It's not worth it for anyone else,
right? If you're if you're like a
company where your business is like
something something physical, and you
don't care, like, yeah, just just wait
out. It'll come. But for a lot of us in
the tech industry, this churn is worth
it. Plus, what Farhan told me is like
cuz he actually told me he's kind of
worried about the cost now. But he was
like, "Look, like it's still worth it
because if I it would look silly if I
said you cannot have these tools, how
would I hire the best?"
So, it's it's innovation, recruitment,
and it kind of makes sense when you
think about it. And the weird thing is
everyone's doing it at the same time.
So, it looks silly, but it's rational.
Uh my next podcast is with Mikael Paryk
in the CTO of Shopify. And uh the sheer
amount of machine learning that they do
and infra that they set up for their
customers makes me want to be a
customer. You know, that's that's that's
like the best uh endorsement I can give.
Um I'm going to get meta a little bit
and talk about Pragmatic Engineer. Uh
you and I kind of started ish in COVID.
Uh you just left Uber. Uh how has it
been growing? What What are the main
stats that you're proud of that you'd
like to share with the world?
Yeah, so I I started Pragmatic Engineer.
I I
joke that if it wasn't for COVID, I I
would probably never have started the
this thing because what happened with
COVID is Uber had layoffs and most of
the tech industry was doing great, but
Uber was not and my team
was hit by a layoff and then we we had
to disperse the remaining people at
other teams cuz our mission no longer
made sense. And it was just like a
the morale was low. My morale was low,
so I was like, "Let me take a break." I
wanted to write some books. Swyx was
writing his book, the the Coding Career.
Yeah, some of you have read it. I've met
some of you. Yeah, and and that's how we
met there. And then my plan was to write
a book and then start start up some
start up something something platform
engineer control C control V from what
Uber was doing inside and that's
actually almost all Uber
Uber startups. It's It's amazing.
Temporal is is is is from there.
Chronosphere If I By the way, if I did
not start AI Engineer, I would have
started Platform Engineer. That That
would have been the industry conference.
Yeah. Love it. And then I start I
started the Pragmatic Engineer
a year after I left Uber. It was just an
experiment.
I figured no one Substack was taking
off. No one was writing about software
engineering in depth and I just acted
all confident saying pretended that I I
knew what I was doing. The first article
was about Uber's platform and program
split that no one had wrote written
about publicly before and it's a it's a
free article. You can You can now check
it out.
And it was like when you feel product
market fit, that's what I felt almost
immediately. The first week before I
published anything, just a confident
Twitter post, I had 100 people pay up
front $100 for the whole year. So I was
like, "Whoa, I haven't published
anything." In 6 weeks, I was at 1,000
people paying for this thing that didn't
exist before and which was my old Uber
base salary back back in Amsterdam and
it just kept going up. So like I I
figured like when you find product
market fit, this is like outside of like
there's this rule like if you find
product market fit, just keep doing what
you're doing. So for me, I just kept
writing that one article. I got all
these interview requests,
collaborations, podcasts. I just said no
to all of them cuz I knew the most
important thing was to do what makes it
successful, which is that one article.
And later it turned into two articles.
And for 2 years this is all I did, just
two articles. And after 2 years I looked
up and I was like, "Huh, like this is
actually working. People like doing it,
I like doing it. There's a future in
that." And that's when I decided I
actually want to turn this into a
business that I don't burn out because
for 2 years every vacation I went to I
was working 50-60 hours.
I was always thinking, I was writing, I
I couldn't really let go. So I started
to grow the team a little bit.
I
hired the first second issue researcher,
Ellen. She's a ex ex She's here, right?
Ellen's not here.
Jessica is who who just joined us
later.
And then
so now it was two of us and I started a
podcast a year and a half ago because I
talked with so many people I figured it
was a bit of a shame
to not have it. So
the Pragmatic Engineer became the number
one paid technology newsletter about 4
months after starting. It stayed there
for 3 years. Now SemiAnalysis has Dylan
versus
you guys.
Yeah, no, congrats on your success. I
think you're also a leading tech voice
in Europe, which I think you're sort of
proudly sort of upholding that over
here, which I would really wanted to
feature. That's Thank you for your
support for AIE. And everyone thank you
to