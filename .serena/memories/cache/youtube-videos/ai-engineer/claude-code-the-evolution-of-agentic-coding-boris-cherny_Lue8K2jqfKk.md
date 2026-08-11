title: Claude Code & the evolution of agentic coding — Boris Cherny
url: https://www.youtube.com/watch?v=Lue8K2jqfKk
date: fetched 2026-08-07
channel: AI Engineer (@aiDotEngineer)
source: youtube-transcript get_transcript

[Music]
Hello.
This awesome. This is a big crowd. Who
here has used quad code before?
Jesus. Awesome. That's what I like to
see.
Cool. So, my name is Boris. I'm a member
of technical staff at Enthropic and
creator of Quad Code.
And um
I was struggling with what to talk about
for audience that already knows quad
code, already knows AI and all the
coding tools and agentic coding and
stuff like that. So, I'm going to zoom
out a little bit and then we'll zoom
back in.
So here's my TLDDR. The model is moving
really fast. It's on exponential. It's
getting better at coding very, very
quickly, as everyone that uses the model
knows. And the product is kind of
struggling to keep up. We're trying to
figure out what product to build that's
good enough for a model like this. And
we feel like there's so many more
products that could be built for models
that are this good at coding. And we're
kind of building the bare minimum. And
I'll kind of talk about why.
And with quad code, we're trying to stay
unopinionated about what the product
should look like because we don't know.
So for everyone that didn't raise your
hand, I think that's like 10 of you. Uh
this is how you get quad code. Um you
can head to quadi/code to install it. Uh
you can run this incantation to install
from npm. Um as of yesterday, we support
quad pro plan. So you can try it on
that. Uh we support cloud max. So yeah,
just try it out. Tell us what you think.
So programming is changing and it's
changing faster and faster. And if you
look at where programming started back
in, you know, the 1930s4s, there were
there was like switchboards and it was
this physical thing. There was no such
thing as software. And then sometime in
the 1950s, punch cards became a thing.
And my uh my my grandpa actually in the
Soviet Union, he was one of the first
programmers in the in the Soviet Union.
And my mom would tell me stories about
like, you know, when she grew up in the
1970s or whatever, he would bring these
big stacks of punch cards home. And she
would like from work and and she would
like draw over them with crayons.
And that was growing out for her. And
that that's what programming was back
back in the 1950s, 60s, 70s even. But
sometime in the late 50s, we started to
see these higher level languages emerge.
So first there was assembly. So
programming moves from hardware to punch
cards which is still physical to to
software. And then the level of
abstraction just went up. So we got to
cobalt. Then we got to typed languages.
We got to C++. In the early 90s there
was this explosion of these new language
families. There was you know the Haskell
family and um you know JavaScript and
Java, the evolution of the C family and
then Python. And I think nowadays if you
kind of squint all the languages sort of
look the same. Like when I write
TypeScript, it kind of feels like
writing Rust and that kind of feels like
writing Swift and that kind of feels
like writing Go. The abstractions have
started to converge a bit.
If we think about the UX of programming
languages, this has also evolved.
Back in the 1950s, you use something
like a typewriter to punch holes in
punch cards, and that was programming
back in the day. And at some point, text
editors appeared. Um and then uh Pascal
and all these different ids uh appeared
that let you interact with your programs
and your software in new ways and each
one kind of brought something and I I
feel like programming languages have
sort of leveled out but the model is on
an exponential and the UX of programming
is also on an exponential and I'll talk
a little bit more about that.
Does anyone know what was the first text
editor?
Okay, I heard I heard Ed from someone. I
think you read the screen
before. Well, before text editors, this
is what programming looked like. So,
this was the IPMO29. This was kind of a
top-of-the-line. This was like the
MacBook of the time for programming
punch cards. Everyone had this.
You can still find it in museums
somewhere.
And yeah, this is Ed. This is the the
first text editor. This was uh Chem
Thompson at at the labs invented this.
And you know, it kind of looks familiar.
If you open your MacBook, you can
actually still type Ed. This is still is
still distributed on Unix uh as as part
of Unix systems. And this is crazy
because this thing was invented like 50
years ago. And this is nuts. Like there
there's no cursor, there's no scroll
back, uh there's no fancy commands,
there's no type ahead. There's pretty
much nothing. This is the simple text
editor of the time. And it was built for
teletype machines which were literally
physical machines that printed paper on
paper. That's how your program was
printed. And this is the first software
manifestation of a UX for programming
software. So, it was really built for
these machines that didn't support
scrollback and cursors or anything like
that.
Um, for all the Vim fans, I'm going to
jump at jump ahead of Vim. Vim was a big
innovation. Emacs was a big innovation
around the same time. I think in 1980,
Small Talk 80 was a big uh it was a big
jump forward. This is one of the first I
think the first graphical interface for
programming software. And um for anyone
that's tried to set up like live reload
with React or Redux or any of this
stuff, this thing had live reload in
1980 and it worked and we're still kind
of struggling to get that to work with
like ReactJS nowadays.
So this this was a big jump forward and
obviously like the language it had
object-oriented programming and a bunch
of new concepts but on the UI side
there's a lot of new things too.
In '91, I think Visual Basic was the
first code editor that introduced a
graphical paradigm to the mainstream. So
before people were using textbased
editors, Vim and things like that were
still very popular despite things like
small talk. Um, but this kind of brought
it mainstream. This is what I grew up
with.
Eclipse brought type ahead to the
mainstream. This isn't using AI type
ahead. This is not cursor when surf.
This is just using static analysis. So
it's indexing your symbols and then it
can rank the symbols and rerank them and
it knows what symbols to show. I think
this was also the first big third party
ecosystem for ids.
Copilot was a big jump forward with
single line type ahead and then
multi-line type ahead.
And I think Devon was probably the first
IDE that introduced this next concept
and this next abstraction to the world
which is to program you don't have to
write code you can write natural
language and that becomes code. And this
is something people have been trying to
figure out for decades. I think Devon is
the first product that broke through and
and took this mainstream
and the UX has evolved quickly but I
think it's about to get even faster.
We talked about uh UX and we talked
about programming languages and
verification is a part of this too. Um
so verification has started with manual
debugging and like physically inspecting
outputs. Um, and now there's a lot of
probabilistic verification, uh, like
fuzzing and vulnerability testing and,
uh, like Netflix's chaos, uh, testing
and things like that.
And so with all this in mind, cloud
code's approach is a little different.
It's to start with a terminal and to
give you as lowle access to the model as
possible in a way that you can still be
productive. So we want the model to be
useful for you. We also want to get we
want to be unopinionated and we want to
get out of the way. So we don't give you
a bunch of flashy UI. We don't try to
put a bunch of scaffolding in the way.
Some of this is we're a model company at
Enthropic and you know we make models
and we want people to experience those
models. But I think another part is we
actually just don't know like we don't
know what the right UX is. So we're
starting simple.
And so cloud code it's intentionally
simple. It's intentionally general. Um,
it shows off the model in the ways that
matter to us, which is they can use all
your tools and they can fit into all
your workloads. So you can figure out
how to use the model in this world where
the UX of using code and using models is
changing so fast.
And so this is my second point. The
model just keeps getting better. And
this is the better lesson. I have it uh
I have I have this like framed and taped
to the side of my wall
because the more general model always
wins and the model increases in
capability exponentially and there are
many coral areas to this. Everything
around the model is also increasing
exponentially and the more general thing
even around the model usually wins.
So with quad code there's one product
and there's a lot of ways to use it. Um,
so there's a terminal product and you
know this is the thing everyone knows.
So you can install quad code and then
you just run claude in any terminal.
We're unopinionated. So it works in
iTerm 2. It works in WSL. Um, it works
over SSH and T-mok sessions. Uh, it
works in your VS Code terminal in your
cursor terminal. This works anywhere in
any terminal.
When you run when you run quad code in
the IDE, we do a little bit more. So we
kind of take over the ID a little bit
and you know diffs instead of being
inline in the terminal they're going to
be big and beautiful and show up in the
ID itself. Um and we also ingest
diagnostics. Um so we kind of try to
take advantage of that. And you'll
notice this isn't as polished as
something like uh again like cursor
windsurf. These are awesome products and
I use these every day. Um, this is to
let you experience the model in a
low-level raw way. And this is sort of
the minimal that we had to do to let you
experience that.
We announced a couple weeks ago that you
can now use Claude on GitHub.
Can I get a show of hands who's who's
tried this already?
So for everyone that hasn't tried this,
all you have to do is you open up
Claude, you run this one slashcomand
install GitHub app, you pick the repo,
and then you can run Claude in any repo.
Um, this is running on your compute. Um,
your data stays on your compute. It does
not go to us. Um, so it's it's kind of a
nice experience and it lets you use your
existing stack. You don't have to change
stuff around. Takes a few minutes to set
up. And again, here we intentionally
built something really simple because we
don't know what the UX is yet. And this
is the minimal possible thing that helps
us learn but also is useful for
engineers to do day-to-day work like I
use this every day.
The extreme version of this is our SDK
and this is something that you can use
to build on cloud code uh without um if
you don't want to use like you know the
terminal app or the ID integration or
GitHub you can just roll your own
integration. You can build it however
you want. People have built all sorts of
UIs, all sorts of awesome integrations.
And all this is is you run claw-p,
uh, you can use it programmatically.
And so like something I use it for, for
example, is for incident triage. I'll
take my GitHub logs uh or my sorry my
GCP logs. I'll pipe it into cloudp
because it's like it's a Unix utility.
So you can pipe in, you can pipe out.
Um, and then I'll like jq the result. So
it's kind of cool like this is a new way
to use models. This is maybe 10%
exported. No one has really figured out
how to use models as a Unix utility.
This is another aspect of code as UX
that we just don't know yet. And so
again, we just built the simplest
possible thing so we can learn and so
people can try it out and see what works
for you.
Okay, I wanted to give a few tips for
how to use quad code. This is a talk
about quad code. So this is kind of
zooming back in. Um and uh this is
actually true for I think a lot of
coding agents, but this is kind of
accustomed to the way that I personally
use quad code. So the simplest way to
use this um it seems like most of this
room is very familiar with cloud code
and similar coding agents. Um but the
simplest way to introduce new people
that have not used this kind of tool
before is do codebased Q&A. And so at
Enthropic we teach cloud code to every
engineer on day one and it's shortened
onboarding times from like two or three
weeks to like two days maybe. And also,
I don't get bugged about questions
anymore.
People can just ask Quad. And honestly,
like I'll just ask Quad, too.
And then this is something that I do uh
pretty much every day on Monday. We have
a stand up every week. I'll just ask
Quad, what did I ship that week? It'll
look through my git commits and it'll
it'll tell me so I don't have to keep
track.
The second thing is teach Quad how to
use your tools. And this is something
that has not really existed before when
you think about the UX of programming.
Um, with every IDE, there's sort of like
a plug-in ecosystem. You know, for
Emacs, there's this kind of lispy
dialect that you use to make plugins. If
you use Eclipse or VS Code, you have to
make plugins. For this new kind of
coding tool, it can just use all your
tools. So, you give it bash tools, you
give it MCP tools. Something I'll often
say is here's the CLI tool cla run-help.
Take what you learn and then put it in
the cloud MD. And now Cloud knows how to
use the tool. That's all it takes.
You don't have to build a bridge. You
don't have to build an extension.
There's nothing fancy like that. Um, of
course, if you have like groups of tools
or if you have fancier functionality
like streaming and things like this, you
can just use MCP as well.
Traditional coding tools focused a lot
on actually writing the code. And I
think the new kinds of coding tools,
they do a lot more than that. And I
think this is a lot of where people that
are new to these tools struggle to
figure out how to use them. So there's a
few workflows that I've discovered for
using quad code most effectively for
myself. The first one is have quad code
explore and make a plan and run it by me
before it writes code. Um you can also
ask it to use thinking. So typically we
see extended thinking work really well
if cla already has something in context.
So have it use tools, have it pull
things into context and then think. If
it's thinking up front, you're probably
just kind of wasting tokens and it's not
going to be that useful. But if there's
a lot of context, it does help a bunch.
The second one is TDD. Um, I know I try
to use TDD. It's like it's pretty hard
to use in practice, but I think now with
coding tools, it actually works really
well. Um, and maybe the reason is it's
not me doing it, it's the model doing
it.
And so the workflow here is tell Claude
to write some tests and kind of describe
it and just make it really clear like
the tests aren't going to pass yet.
Don't try to run the test because it's
going to try to run the test. Tell it
like, you know, it's not going to pass.
write the test first, commit, and then
write the code and then commit.
And this kind of a general case of if
cla has a target to iterate against, it
can do much better. So if there's some
way to verify the output, like a unit
test, integration test, uh a way to
screenshot in your iOS simulator, uh a
way to screenshot in puppeteer, just
some way to see its output. Um we
actually did this for robots, like we
taught FOD how to use a 3D printer and
then it has a little camera to see the
output. If it can see the output and you
let it iterate, the result will be much
better than if it couldn't iterate. The
first shot will be all right, but the
second or third shot will be pretty
good. So, give it some kind of target to
iterate against.
Today, we launched plan mode in quad
code
and this is a way to do the first kind
of workflow more easily. So, anytime hit
shift tab
and cloud will switch to plan mode. So
you can ask it to do something, but it
won't actually do that yet. It'll just
make a plan and it'll wait for approval.
So restart quad to get the update. Run
shift tab.
Okay. And then the final tip is uh give
quad more context. There's a bunch of
ways to do this. Quadm is the easiest
way. So take a this file called quadd,
put it in the root of your repo. You can
also put in subfolders. Those will get
pulled in on demand. You can put in your
home folder. This will get pulled in as
well. Um and then you can also use flash
commands. Um, so if you put files like
just regular markdown files in these
special folders
commands,
it'll be available under the slash menu.
So pretty cool. This is useful for res
uh reusable workflows.
And then to add stuff to quadm um you
can always type the pound sign to ask
quad to memorize something and it'll
prompt you which memory they should be
added to. And you can see this is us
trying to figure out how to use memory,
how to use this new concept that is new
to coding models, did not exist in
previous IDEs, how to make the UX of
this work. And you can tell this is
still pretty rough. This is our first
version, but it's the first version that
works. And so we're going to be
iterating on this. And we really want to
hear feedback about what works about
this UX and what doesn't.
Thanks,
[Applause]
Fortunately, we only have one minute
left. So, someone sent a question on
Slack. The question is, as I delegate
more and more to cloud code, as it runs
for 10 minutes and I have 10 of these
active, how do I use the tool? You got
50 seconds.
[Laughter]
Yeah, this is it's pretty cool. I think
this is something that we actually see
in a lot of our power users that they
tend to like multi-cloud. you don't just
have a single quad open, but you have a
couple terminal tabs either with a few
checkouts of cloud or uh or of your
codebase or it's the same codebase but
with different work trees and you have
quad doing stuff in parallel. This is
also a lot easier with GitHub actions
because you can just spawn a bunch of
actions and get quad to do a bunch of
stuff. Typically, we don't like need to
coordinate between these quads I think
for most use cases. If you don't want to
coordinate, the best way is just ask
them to write to a markdown file. Um,
and that's it. Awesome. Yeah. Well, both
thing works. Thank you so much. And once
again, give it up for Boris from
Enthropic.
[Music]