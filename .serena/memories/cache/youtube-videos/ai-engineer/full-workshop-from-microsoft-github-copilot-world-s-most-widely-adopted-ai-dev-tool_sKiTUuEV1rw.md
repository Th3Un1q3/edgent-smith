[Music]
well I hope that everybody um has had a
great first half of your day uh so far
and had a good lunch thank you all for
being here um this is a talk this is
going to be a workshop uh about uh the
world's most widely adopted de AI
developer tool and that of course is
GitHub co-pilot I'm Christina Warren I'm
a senior developer Advocate at GitHub
and I'm going to be assisted today in
this Workshop by my colleagues Dave Alex
and Harold who are all here in the front
uh and and well um um Alex is in the
back so we've got people um sorted
around um we did a version of this
Workshop earlier um this morning uh this
is going to be our second uh uh try out
it we learned some things so we'll see
how things go um and then as we go along
if you have any questions or if you need
help um I will have some resources where
you can um get help um online and GitHub
but also feel free to raise your hand
and we will do what we can to help you
out and uh this is just kind of going to
be a little bit of an overview of how
we're going to be doing this today so
we're going to start off with an
overview of GitHub co-pilot and then
we're going to talk about uh getting set
up and access um for the the repository
that we'll be working out of and um
getting access to GitHub co-pilot if you
don't already have access um I would
love just out of curiosity uh for the
people in the room how many of you have
used GitHub copilot
before okay awesome awesome um that's
great to see um we also will have um
some resource links um then we're going
to get into the labs and then of course
we will be doing some
feedback this right here this QR code
and I'm sorry that I was not able to
make the URL larger but this is um going
to be kind of Ground Zero for this
Workshop this repository so um if if you
want to follow along with us going to
this uh URL
G.I aif far- Workshop is going to take
you to a repository which will show you
everything that you need um to get U is
in this repository this slide deck is
also in that repository so if there's
anything you want from that um that that
has been um added to that as well but
this is going to be our Central resource
and where we're going to be working um I
will have this up again in um a little
bit uh later but if you want to go ahead
and um either either go to this URL now
or use the QR code that would be
great all right so let's just do a
little bit of an overview about GitHub
co-pilot which is your AI pair
programmer okay so getup copilot is um
an extension I mean we it works in
multiple places actually uh we're not
going to talk too much about the
integration for um GitHub um interprise
PR and and some of the things we're
doing on github.com we're going to
primarily be focused on the The
Experience inside your IDE um but uh
this is you know one of the very first
uh coding assistants uh it was
introduced in uh private preview in 2021
formerly released in 2022 so we've been
at this a while now and basically it's
going to be using the context that you
provided and then it's going to
synthesize code to match that context
and so using files that you have open
tabs you have open in your editor as
well as comments that that you're
writing or you can query directly with
GitHub co-pilot chat in in a chat
interface to get coding suggestions um
to you know convert comments into codes
so I can make a comment say you know
write write a function um to parse the
URL um or to autofill for repetitive
code if I'm using the same code block
over and over again in the same pattern
over and over again uh co-pilot is going
to know how to do that it can also help
streamline creating tests and show you
know alternative ways of of achieving U
the same task and as I said you know
this is your co-pilot for an AI powered
software development life cycle like
we're we're taking place in the IDE and
the terminal uh we have support for
visual studio code which is what we're
going to be showing off um visual studio
also has support for for uh GitHub
co-pilot as well as a number of the jet
brains idees and there's also a neovim
um extension which uh I learned last uh
session actually does have some GitHub
co-pilot chat support which is cool um
and um co-pilot beyond that also can
work on github.com and so if you have an
Enterprise account and have GitHub
co-pilot for Enterprise there are
different things you can do on
github.com to also integrate uh W with
co-pilot to Aid in in the creation of of
pull requests and in um fixing um
potentially insecure code and uh you
know
even we're going to have a session
tomorrow with one of our colleagues kind
of going from ideation of kind of an
idea of of how you want to plan
something out to actually implementing
that whole plan
um and so one of the questions that we
get a lot
is is co-pilot
training uh you know the the model on my
um data and and the answer to that it's
my coding data and the answer to that is
no there is option if you want to
contribute your um uh code completion
stuff into the larger model but that can
be turned off and and by default that is
off for business and Enterprise accounts
and so how this is working is we are
actually just taking the context from
the editor and and uh my colleague Carol
can talk a little bit more about how
that's working and and kind of getting
an idea of what I'm doing that's going
to be sending it to open ai's uh gbt
model and then sending suggestions back
now that model itself has been trained
on public Source c um source code and
and that's how that's gotten better but
your code itself is is not feeding
feeding our model um there's an option
as I said if you wanted to do that but
that that is not how it works um by
Design um so some of the again some of
the answers to the common questions you
know does it it train on my code no when
you're using it for for business or for
Enterprise none of your code is stored
by GitHub and even on the individual
plans there's an option to be able to to
turn that feature off um what is
included in the context so this is going
to be the files that you're working on
and so that could be you know uh tabs
that are open in your IDE starting from
the current file um and you know another
question we often get is you know can't
I just you know write the code on my own
well yeah but how often have you ever
been in a situation where you have to
write the same piece of boilerplate code
over and over and over again and often
times doing the same thing with minor
changes uh we love to automate ourselves
out of jobs make things easier on us so
we can focus on things that we actually
enjoy doing more and this is one of the
great things about I think Ai and about
um coding assistance like co-pilot in
general so one of the features that we
introduced gosh I guess it
was a year and a half ago now is getup
co-pilot chat which basically brings
kind of a chat gbt like experience into
your editor so you can actually chat
directly inside your editor with
co-pilot um and and you can ask
questions you can also ask for specific
queries about the code that is in your
editor itself so you can say you can
select some code and say hey how can I
optimize this how can I make this better
or write me a a unit test for this code
and it can do that you can also ask more
General queries it's also great for
being able to translate you know code
from one language to another um
sometimes that actually works really
well um you'd be surprised and um you
can also you know ask to propose fixes
for bugs and know help make code more
secure and this support for co-pilot
chat is in vs code Visual Studio jet
brains and as we learned recently yes um
a neovim um how well it works in newm I
I don't think all the the features are
quite there but it is there and one of
the things when we talk about and we're
going to be getting into some Demos in
just a second uh but one of the things
that we talk a lot about when we talk
about you know uh coding assistants are
are prompt crafting because a lot about
how well these things Works depends on
what prompts you're writing and and what
um information you're giving um co-pilot
because again it is a co-pilot it is not
doing it for you and so writing good
prompts can help get better results and
so some of the the ways that we've seen
that really improve um is by making sure
that you have the right amount of
context this can be really useful again
like I said having what what tabs you
have open starting with like the the um
most recent file um or the C Central
most file rather um and and what other
files are open that can provide co-pilot
with context about what you're doing
also if you put things in a comment um
about what you're trying to do or even
in some cases giving it you know an
example of code that you want it to
replicate or or that that represents
what you're trying to achieve that can
go a long way with helping co-pilot
understand what you're trying to achieve
um also being very clear about what your
intent is and and making that clear in
your prompt you know I I want to create
a function to parse a URL this is
actually going to be one of the examples
in the labs being very specific about
what purpose you have in mind in that
prompt being vague can work okay um but
the more specific you can be the better
results you're going to get um also
Focus on Clarity being easy to
understand that's going to also help the
the AI uh give better results and being
specific and and and that means you know
saying okay I I I don't want it to look
like this I want it to look like this so
being uh detailed and precise will also
go a long way um and getting the most
out of co-pilot and the workshop that we
have will go through all these different
steps
yes sure
yeah can we get the second mic
on sorry about
okay there we go yay so the question was
about the the context that we provide to
to copilot is there any way to have more
control over it so I assume that given
the context length the GitHub does some
smart things underneath to to kind of
uh um make it smaller so obviously it
won't load all of the 10 full pages of
2,000 lines of codes um and sometimes it
will give you sub power results because
of that because obviously it doesn't
know the exact method that I have in
mind right now um so yeah how about that
actually I'm gonna let my colleague
Harold answer that question because he
got has way more insight into this than
I do second uh there's also a talk
tomorrow I think at the booth theater
we're going to more into context as well
so there's an attached button once you
open chat you will see you can actually
reference file specifically uh so that's
one way um otherwise the the best short
way if you have code selected that you
want to talk about Copa will include
that as long as it fits into the context
window and that's that's kind of the the
best trick to keep in mind just having
code select the same for inline chat as
well if you try that out
um no no has been it just came in the
last release so uh so it's a sneak
preview to tomorrow's show um but
otherwise the at workspace if you try
that out that's in the in the plan as
well that will give you a more General
overview uh of your project uh using
kind of rack techniques and and giving
context uh related to the question so
the better you ask a question to code
patterns that are actually in your code
base the more people'll find I will show
you always check the references uh that
are that you in chat to see what context
is being used so that's kind of the main
main tips there yeah and there's a
question in the
back so to follow on the question that
was just asked one of the things that
I've dealt with is
same where it seems I don't have loaded
when I ask questions question terms of
best practice reference
EXs I ask
question you can use the attach button
there as well and we're working on that
you can also attach symbols from your
code base so that would be also possible
so as a best practice I always toing
add not not yet working on that as well
so that's there's definitely more in
inference coming but as that can easily
go go wrong ASE given the broad slot of
questions people can ask so the more
explicit if you know what you're talking
about just show it to co-pilot just like
you would do with anybody
else that's at workspace yeah so at at
workspace is a is a rack pattern where
we look at the whole code
base
yeah yeah not not the whole thing yeah
awesome awesome yeah and if if you
continue to have more questions yeah
please just raise your hands um because
this is great and um we have really good
people here to answer those questions um
again some additional like good best
practices using good names are
going we'll refer in a little bit to
we've set up discussions get up good
discussions and similar question came up
this morning so we already have a set of
links out there to dive into different
resources to learn about exactly
everything that co-pilot pulls in for
context you know so from that you can
you've got some documentation and
references to dig into uh to to figure
out in your situation your situation
what's going to work best yeah and and
also attend Harold's talk tomorrow too
um because uh that that that that is a
plug for you you Harold thank you very
much um but yeah um um just just quickly
going ahead um this uh this is linked in
the main repo that I that I linked to
before this is the discussions tab but
this also goes directly there so if you
want to um if you have any questions
during the workshop or if you want to
see some of the previous uh questions
that were asked before we've got that
stuff there as well um so um again just
real quickly some best practices in
addition to offering context because
that is an important thing using good
names because co-pilot is designed to
understand natural language so not being
you know uh using overly genericized
things actually giving things names the
way you would actually name a a function
or class is useful spelling out variable
names you know single letter variables
and abbreviations can be ambiguous so if
you can spell those out and be specific
with them you can get better results um
keeping functions functional um is is is
a good thing too and and then the
biggest thing honestly is being
consistent so you know the generated
code is going to follow contextual
patterns and so again to what Harold was
mentioning before if you select some
code and you can offer that as context
specifically in addition to attaching
code um that that new uh feature that uh
just recently shipped um that will help
um get better code too but but yeah I
mean good code does get better code and
so one of I think the misnomers um about
a lot of the coding assistance is that
it's really primarily aimed at people
who aren't um skilled Developers ERS and
and that's true that it can help people
who don't have um a strong development
background but I think what we found in
the last three years is that the people
who really get the most out of this are
people who are developers day in and day
out and who do work a lot with it
because they are are getting the most um
uh use cases uh because they can be the
most consistent and um are already you
know um committing no pun intended you
know many of the best
practices okay um one of the other
things too we're going to go through
this because this is actually one of the
fun parts of the workshop is that you
know if at first you don't succeed you
know iterate try and try again that can
be frustrating sometimes certainly um
we've all been there where you know you
you get so close to getting something
that you want and it's not quite there
but at the same time this can be a
really great way of learning what sorts
of prompts work well and what sort of
prompts don't work as well um and so um
for instance in this image I'll just
describe this um you know the initial
comment said you know write a JavaScript
function that finds the maximum value in
an array and that's pretty Broad and so
what the result is is also fairly Broad
and and generic and and might not work
for what you're wanting to do but the
second prompt by being more specific by
being more um intentional create a
JavaScript function find Max that takes
an array and Returns the string with the
maximum length ensure the function works
correctly for arrays um as as um that
are embedded as well as arrays that
contain both strings and numbers that's
going to give us a much better results
so these are these are things that again
being more specific with your your
comments um either in your code or with
your queries to the chat agent um Can
can work really well and as you find
things that work you know playing around
with things and iterating is is the best
way of doing
that um another another uh best practice
is providing examples in your prompt to
clarify what you want co-pilot to do and
what you want it to take into
consideration so you can inside that
that
prompt you can you can put some some
sample code and and say hey consider
this this example data I want it to work
correctly for things like this that's
something that that the um AI can
understand very very
well uh and and then again keeping files
open that are relevant to the
requirements of your current file this
is great if you want to call in other
things from your broader code base you
can use the at workpace agent uh but but
keeping those relevant files open that's
going to help um as well um and um again
like there are still going to be
limitations by how much context
everything can take in but this is this
is getting better all the
time um and then you know above all else
you know just go with the flow uh be
open to things sometimes working
sometimes things not working and and
experimenting okay all this is great
we've got a you know quick kind of
overview when can I write code well we
can we can start to do that right now
but the first thing we want to kind of
talk through is is getting set up and so
again this is our going to be our main
um Ground Zero repo so this is
G.I aif far- Workshop so if you want to
go to that repository now that would be
great now if you already have GitHub
co-pilots um if you already have access
either on your personal account or
through your company that's all you're
going to need to do but if you don't
have GitHub co-pilot uh we do have a
coupon code that will give you access
and that is um going to be at this URL
that is actually linked on the repo it's
one of the very first things Linked In
the repo both as a a physical link as
well as a QR code but if you want to go
ahead and and scan this QR code you can
activate a coupon this will give you a
7-Day free trial of GitHub co-pilot if
you run any problems getting this
activated what we did find last time
there are a couple of steps um after you
enter in your information um where you
will want to go ahead and um make sure
you click apply I think like like two or
three times um this is what what that it
looks like basically you're going to
click on apply coupon and then there's
going to be another prompt to basically
say activate GitHub
co-pilot
so we just give people some time here
and if you need to see one of the other
screens um let me know about
that and if anybody has any problems
getting their coupons redeemed please uh
feel free to raise your hands and we
will send people out to do
that this is that main repo by the
way and you just click on this link
which is in the repo this should take
you directly to
the page I already have co-pilot so I
don't need to do this but um where you
just need to fill out your information
and then you can go from
there e
some time for that now the next thing
you're going to want to do um um after
you've redeemed your coupon and again we
we'll we'll we'll uh make sure that we
take time for for um if anybody has any
issues to get that set up is in again
this this co-pilot Hands-On repo you're
going to want to go ahead and en Fork
this repo and make your own copy so that
if you need to make any changes yourself
you can but the more important aspect
here is that to run this this Workshop
we are going to use a feature called the
GitHub code spaces now I am curious how
many people in the audience are familiar
with GitHub code
spaces way less um Okay cool so GitHub
code spaces are actually pretty awesome
um this is a think about of as a virtual
Cloud environment so basically it is a
preconfigured um VM in the cloud that is
set up specifically to have um certain
features um that you've defined in in
your repository so there is a Dev
container. Json file which is basically
kind of like a fancy Docker file which
will outly these are going to be the uh
various dependencies and versions of
different things that we have installed
specific to this repository um you can
also designate what extensions in Visual
Studio code you want to have installed
because we're going to be running that
either in a in a web browser instance or
you can open it up in the the VSS code
client as well uh it also works with uh
with with jet brains doesn't it um I
believe yeah um but we're going to be
using VSS code today and um this is just
a really great way of um not having to
bother with the process of setting up
your environment um it instead can be
configured exactly as as it is in the
repo rules so in this case um I've
already forked my repo so to get started
if you want to just Fork your own copy
of the
repository I've already done this so I'm
not going to do this a second time but
um I but but but I could and um just go
ahead and create fork and once you've
done
that what we're going to do
is click on this code button here and
there's a drop- down menu and you have
you'll you'll probably by default see
local options we're not going to do that
if you wanted to do this locally you
could but it's actually going to be
faster and um um a little bit easier
with code spaces
um go ahead and and click on create
codes space on Main and what this is
going to do this is going to take a few
minutes this is going to create a my
case it's wanting to open it in Visual
Studio code um I will
actually fake that um because it's my
editor preferences usually um what it's
going to do is it's going to spin up a
VM you could in in another instance Dave
was talking about this before and and we
could do a longer and different talk
about how you could configure your code
space to uh have more cores and and and
more RAM and be faster but for the
purpose of this demo just the default is
just fine also with every GitHub account
you get a certain amount of a free codes
space minutes so that works great for us
in these purposes too and what this is
doing right now is this is basically
Visual Studio code but in the browser
and so this is now spun up um a a
browser inance of vs code um and it is
setting up a remote um a connection and
it is now building out this code space
so it is installing all the various
dependencies um as as defined in this
Dev container file and um it is getting
them ready um to to run so just for
anybody who might be curious um because
we will actually look at this a little
bit later but this is what that Dev
container file looks like and this is
just a a Json file and you can see
basically that it is um installing uh
has certain settings set up for vs code
including extensions for um you know a
code spelled Checker um a the GitHub
style markdown preview GitHub co-pilot
chat and GitHub co-pilot
um as as well as uh using an image um
from a Docker image that that had uh
that's configured for for for python um
3.11
so this is now what the code space looks
like and so this is going to show how
these things work and what's interesting
is it's going ahead and it's installing
these extensions and if I click on these
extensions you can see that right
now nothing is installed but in a couple
of minutes uh or hopefully moments we
will start to
see our co-pilot stuff come in as well
as our files yeah here we go so now now
it's it's going ahead it's it's
installing all these extensions that
we've access to if you wanted to open
this up in a local instance of VSS code
you could do that you would need to go
ahead and manually install some of those
extensions that that's the nice thing
about doing it um in the in the browser
and these are all the files that are
from our repository so this is basically
identical to what we were looking at
before um and
actually one thing you might want to
do
is in that main repository that we that
we've been uh kind of focused on at the
very bottom there is a Labs document
that says a co-pilot Hands-On lab uh
this is a great tip uh that that U Dave
had and and it's um it's in the
documentation but I'm going to go ahead
and do this here too if you want to open
that up in its own tab in your browser
um and then maybe put it in its own
window like like
so using you know whatever Window
Manager you use um I'm on a Mac so
window management sucks um if you want
to tile it off to the left hand side of
your
screen um and you can make that bigger
or smaller having this visible
throughout the entire lab will be really
really good so that that's that's that's
one pro tip here um
did I
lose
okay again I'm on a Mac so Windows man
window management sucks
um I know right I know we're finally
going to get some some tiling management
hopefully it's it's uh it's ridiculous
okay and then what this here we go great
okay so I've now got these things
configured that I have this is my um uh
code space and then this is my my
Hands-On lab um and at this
point um on the bottom lower corner of
your Cod space is this uh co-pilot um uh
uh icon and you can see that the status
is ready and the co-pilot chat has been
um enabled now um the chat window window
is here this is the the chat window and
in this way I can either talk directly
to the codebase I can also use there's a
an agents feature where I can talk
directly to for instance I can um if I
have a GI up Enterprise account I can
use at GitHub and I can ask questions
about my my GitHub account these are
primarily Enterprise related features at
terminal is great this will show you how
to do things in your terminal it's
really really good for FF imp Peg
commands and other things that you don't
want to memorize um and at vs code
will'll ask you questions in general
about VSS code it's also a really good
way of kind of managing settings and
then at workspace this is going to be
asking questions in general about the
workspace that we have open so if you
wanted to ask a more general question or
or to continue to add context from what
you're working on that's an agent that
you can use using the chat
extension
so me back here for a second
I'm just going to put this back on
screen for a
minute these are the the main links and
resources so first thing is the co-pilot
coupon then we have the the main repo
where everything is taken place and then
we have the labs uh read me so these
These are kind of the the main three
things that we working on and if anybody
has any um problems getting access to
anything again please raise your hand
and we will do our best to assist you
for
oh
yes sure
um uh what what do do you know Harold
what what what's the shortcut um on on
Mac OS to see the the multiple uh the
various code
suggestions yeah I think it's just
that's not working for you
this
all right I lost connection to my code
space because the demo gods are with me
today so this is reloading things that's
okay that's the that's the one pratfall
of using the the cloud code environments
is that sometimes they can uh run a foul
but in general they work pretty well so
again um I've got my my labs uh Hands-On
stuff here and we can just once you've
got this set up we can go through the
first lab um and this is a fairly uh
basic one so if this is something that
you um are still setting up don't don't
worry about that so the first thing that
we're going to be
doing is creating a new file in this
case an
index.js file so yes we are using
JavaScript in this example Don't Be
Afraid all right now you will notice
that it says like can
press uh in in my case command I and I I
think that it's control I on Windows
where I can ask um a co-pilot for
something or I can type a slash command
now these slash commands are um ways
that you can uh basically um I guess
simplify um certain operations with
co-pilot so for instance doing slash do
will add a documentation comment around
a symbol so that you can have a you know
notice to go go back and document your
code more um SL explain is actually
really great this is going to explain
how your code um in the active editor
Works um and it's pretty good there are
some hallucinations as there are with
all llms but it's it's um pretty good
and it's it's improved quite a lot even
in just the last few months um that's
one thing that I didn't mention earlier
um we are updating our our co-pilot
model fairly frequently and and we're
you know rebasing on uh you know U the
various versions of of uh gbt that that
come out from open AI all the time but
we are also then fine-tuning on top of
that and so the co-pilot that if you
first tried GI up co-pilot a year ago
you're going to get a different
experience now not just from the tooling
perspective but but also in terms of the
results because the models are getting
better all the time and and and we're
actively committed to uh improving those
models all the time um slash fix will
help you propose a fix um if there's a
problem in your code um fix test failure
will propose a fix for a failing test
because writing tests is one of the best
things of using a coding assistant and
then again slash test will help you
generate unit tests for your selected
code block
so those are those options right there
all right I've created this index.js
file that I've got
open
now I just need to add a comment in my
code and if I can spell correctly with
one hand um and and if I can spell
function correctly that would be even
better although you will notice that
like it actually it picks up on typos
fairly well okay
so have this if I hitting
enter the first thing that it's giving
me is
something something pretty minor um and
and it is very similar to what what what
our example says now I can hit Tab and I
can accept this um and and this by the
way this this text right here um see if
I can zoom in on this
more no it is not letting me zoom while
I'm in full screen great love you um
Apple okay um
when you see this gray text here this is
what's known as ghost text and um this
is something that that that Harold can
actually talk more about if you want to
maybe explain the different types of of
text and and what other people see when
they're using
co-pilot yeah um so I think yeah we we
start with completions and that's the in
the flow you don't even think about it
mode of co-pilot it always works and
when you get really used to it you kind
of ignore it when you're in the flow
when you're coding when you know what
you want and then once you want cobat to
kick in you just wait a bit it kicks in
you might even try different suggestions
you kind of flip through maybe you
accept it word by word and let's see
what how else it continues but it's
really you don't even think about it and
you notice that when you sit in the
airplane and you stare at your screen
for a minute that you're in airplane
mode and co-pilot doesn't give you
anything so that's when you know you
build a habit then the other one is uh
further next is inline chat and that's
where you you can open up a little
natural language input over your code
and that's where you can apply AI
directly to your code and that's in chat
with you keep kind of having long winded
conversations about code and that's
where inline chat is much more powerful
in giving you way quickly iterate on
code to generate and edit both code and
then lastly chat panel is kind of the OG
idea of chat gbt in your vs code an
editor chatting with context being more
in the ex exploration mode where you
want to have conversations where you
want to treat it like an a like an
actual AI pair programmer which can
challenge you which can critique your
code where you can go a little bit more
back and forth and explore a solution so
these kind of the three modes and when
you want to use
them thank you Harold you're the best
yeah yeah
sure thank
you I was just curious to know if there
is a difference um you know between the
ghost text it's generated here um so
just doing it you know in line in the
editor versus if I was to have that
function and then use the control I to
say write me the rest of this function
like is there a difference in how the
context being provided to the underlying
model is there any like reason we should
use comments get it to generate versus
uh control I or chat in terms of cont my
personal take is you will see when code
was generated with co-pilot ghost text
because it has all these not very
purposeful comments written in that very
much describe to code below which are
not typical code comments you want to
describe like your reasoning and your
thinking behind it but that that's not
how you prom craft with get up co-pilot
so inline chat allows you to pull that
prom crafting into the inline chat and
just get the code out and be more
specific and elaborate and how you can
describe it in that inline chat prompt
so you're less iterating on the comment
but you inate in a natural language
input which is sometimes more intuitive
so you will find if you if you like
writing long winded comments and tweak
on the comments and then hit enter again
and see what coper writes that's
basically a much faster more direct flow
within L ched yeah that makes a he of
sense from a user um experience
perspective just also Keen to understand
is there a difference in terms of how
that is been provided to the model
between the two different ways of doing
it yeah definitely uh the the chat the
ghost text is more grounded in the
neighboring tabs has a much smaller
context window because it needs to
provid it much quicker and then inline
chat has way more freedom to include
other context dependency documentation
so depending on which commands you're
executing it will do more work up front
to get context and more context awesome
thank you yeah and there's a question
the
back okay
fantastic awesome okay and actually just
to to show you here there are these
Sparkles that come up um
where you will see certain things and
you can actually choose options to like
fix using co-pilot or explain using
co-pilot in this place I'm just going to
show explaining and this is just going
to say okay this is the reference it's
using and this is just
um giving me uh an explanation of the
non-existent code that we basically have
already kind of created at this point
so going further through through the the
the lab um this is what it's going to
generate now now when you do create uh
when you do get your code
suggestion if you are not happy with
with what you're getting there
is you will sometimes be able to to um
uh get other options um for for other
code suggestions
um but but just kind of going through
this um this this
uh go
on okay so when I when I press control
ENT and it is control on both Mac and
windows this is going to give me a list
of suggestions here and so I have seven
I have Wow have eight different
suggestions that all could be very very
different because again I gave it a
really really generic prompt which goes
to one of our first lessons we were kind
of talking about be specific be specific
with what what you want to achieve
because I have eight different
suggestions that all all vary in what
they're wanting to do but this is one
way that you can actually choose
different suggestions so in this case if
I wanted to accept one of these
suggestions I could do that and it's
going to put those lines in place now we
are going to go ahead and um
not accept any of
these instead what I'm going to do is
I'm going
to sorry typing with one hand is
difficult
and you can see the ghost text coming up
as I'm typing things out so it's
actually going ahead and putting further
things here I don't actually want all of
this but I can just have this aspect
here and this is going to go ahead and
potentially complete this this code for
me and if I wanted to select that I just
press the the Tab Key and that's where
this will come and so basically that's
this is just our our first lab this is
just going through through how this
works
um Harold if you wanted to come up again
and just you go go through lab two which
we I I think I already showed off the
bulk of it but this might be might be
useful folks
okay okay
good two so um I think I showed it
before so once you're in G text mode one
good way I just showed over here is to
hover the ghost text everybody make some
ghost text and hover
it that that little widget gives you the
right keyboard
shortcuts and a little three dot menu on
the
end I'm going to demo it
here this is why
you your
time I wish I had larger hands
okay so the classic is uh single line
completions and this this uh especially
in function bodies copil it will go into
multiline which are easier to hover
to in the top right you now see the the
little widget which has one slash3 and
an accept an accept word so remember the
accept word shortcut that's a good
keyboard shortcut to impress into your
brain because that lets you this lets
you get out of this mode where you have
to accept the whole function body that
copal hallucinated for you but start
with the initial one that has the
highest confidence like yeah that's the
part I want and then the rest I can work
out with co-pilot and fill in the rest
as I figure out what I actually
want but that's that's one way so
hitting the command next command right
uh that's one way if you want to do the
full line there's also come on
do what is this why is this so far away
okay so except line is also here uh if
you want to apply a shortcut to that
it's VI code so go go go ahead and then
but the other one is the open
completions panel which gives you this
this idea of more suggestions um
especially in
multi-line there's a lot more freedom
for the AI to explore how it could solve
this problem that it thinks you're
having so these are usually a good way
to understand your
options and anything else
missing then we have Inland
chat so the other way you can now solve
this I can just take this out
so let's do
a just delete this and then
write that's where I mentioned in um the
panel inline chat versus panel chat
right uh
URL parer function and that's theote
where inline chat is used to generate
code now you're don't start with a
function body you just give it an idea
of what you want to get out of it and
you just get a function that will pars
the thing and actually if I I did this
before with copil completions and it got
to the same conclusion so you see how
you can get to the same end result with
different
paths I could also give feedback now
maybe this way oh it generated an a
element maybe I want to use a library
for that so make sure you use that
follow-up field to tweak it don't just
accept the first suggestion as with all
AIS they can get things wrong so make
make sure you keep
iterating then function wise um now when
I accept this maybe I make a
mistake
um classic mistake just typing bar
this one so you can go every time if you
have a linting error and those can come
from extensions those are not just built
in vs code things if you have X for
example you also can get accessibility
squiggles you can go into Quick Fix and
now you can see actually for this one
not because it's a it's
a uh Cod spell
one I think there's not too much linting
setup in this project I only get code
spell
errors okay let's show it you other way
if you have code you want to fix you can
do the thing I just showed you in the
hover or you can just do right
click how do you right click
here let's go okay you can go into here
and then modify using copilot and that's
where you also open inline chat and just
H hit
fix and if I I actually do insert the
mistake which I think I have with parses
it will find it fix will automatically
look at error messages it will look at
potential issues with the code and it's
generally prompted to fix any other
issues it finds so in this case even
though it wasn't a general actual issue
it found that parses is misspelled and
it gives me the change if you want to
see a better View and inline chat to see
the change you can also toggle changes
down here and see the actual line versus
line
comparison this is just optimized right
now for space that's what makes inline
chat very uh Compact and easy to use in
in all kind of window setups so accept
this and that's the quickest way to get
rid of squiggle lines with
AI I think this concludes lab
two should I just move on
okay go on with LA
three is explain again same same thing
just open inline
chat and do slash explain so it's one of
the many commands we provide often times
with AI you end up in a very prompt
heavy flow we keep describing the same
thing please explain this code to me or
please explain what this code does so
these shortcuts allow you to not be
overly prescriptive for very common
tasks like fixing books and explaining
code so SL explain in this case we'll
not just look at the current code but
we'll also look at the dependencies
you're using the symbol definitions the
type definitions the documentation and
all hand is all over tovs code and copal
chat to make the best sense of it
in this case now we're using this tiny
view to just give you an overview of the
code and how it works like how do I get
a URL out of a link element in this case
but you can also now open this up in the
chat panel on the left to give it some
more breathing room and make it easier
to
read what's important all these answers
are also linked nicely so we do a lot of
effort in making these this code in any
explanations really shy and easy to
interact with
so you can easily navigate and click
around in these answers as well that's a
recent Improvement that landed if if you
actually generate code in the side panel
it will also have linked elements and
have intelligence and you get all the
benefits of getting really really
readable
code there
explanations if you want to have a
custom explanation though you can still
do that so if you want to have a command
I
slash
explain classic prompting like I am
five it's not really doing the five
thing I'm a very smart five-year-old
so you can ask them like yes uh if you
want to yes I
agreed if you want to actually switch
that if you look for co-pilot settings
uh switch it to different
languages you can actually switch the
language of co-pilot so the local if you
go into your settings in vs code there's
a local override local and you can
switch it to different local so by
default copile will be using a language
that you pick it in you can mix up
languages I my original language is
German also speak Spanish and French so
when I don't know a word with when I
speak to my wife we just switch
languages copal will be as well
understanding you if you just high level
describe it so in some cases it's good
like um later on we show you at
workspace it's good to be hitting the
right words of Concepts that you expect
in your code base so if you know the
word make sure if you know reference be
be specific but otherwise it's
interesting also to be vague and add
some ambiguity to let co-pilot figure
out and give you some ideas on how you
can solve a
problem okay so this should get you
through the inline chat
parts
and into the chat
panel which we already went
to okay chat panel trick number one
remember this button up here to open a
new
chat um same shortcut is for clearing a
terminal it's control L very important
uh very fun quick way to start a new
conversation
yeah because copile will look at your
history every time you answer just like
in chbt or in beginnings of Bing search
AI where it fell in love with reporters
after 50 back and forth conversation was
stuck in a very romantic mode co-pilot
can also get stuck can get stuck on
Concepts and anything you talk discussed
before so if you start a new
conversation reflect that uh by actually
opening a new chat you can still switch
back and forth in the history but make
sure you begin new conversations
actually in a new
conversation inline chat does not have
history right now it it has if remember
that you can um just close
this you can go up and down to come to
get to Old history items so use
that but I thought we we do store these
in history now so I have to I have to
get back to you on that I I know they
end up somewhere but it's all locally C
so none of these things are synchronized
to GitHub it's all just kept in a place
where vs code keeps its data it's in
your local profile file uh not anywhere
online so uh Quick Trick here if you
want to see everything that that copilot
can do it's slel and that's providing
you anytime you forget which commands
and what they do and why there's so many
um that that's the best way so that's
that's giving you all like learning
commands to for common things like SL
fix SL exlain play around with the more
edky ones like SL new which allows you
to bootst strip a whole project uh but
it's also the context variables uh but
all of these are AO also autocom
completed if you as soon as you hit
slash or hash you will see those as well
as you play
around
okay yeah we had oh he stepped out there
was a question about how to use the new
notebook command there and so in the
discussions on the devops 30 version of
the repo I added a little discussion
that says how do you use that command
and it points to you have to feed it
some more context I'm not a juper
notebooks guy but it's it's like you
know using this data set I want to
generate this kind of a thing or
whatever so yeah some of those commands
you'll have to get a little bit familiar
with exactly how to follow up that
command what do you need to feed it and
things like that so they can be very
powerful once you know how to use them
yeah who's who's using notebooks in vs
code
awesome yeah it's definitely if you do
data science not using notebooks like
it's a great place to move from data
analysis to actually writing code and
shipping shipping
it so and I use it tomorrow in My Demo
as
well
unintended product basement here okay uh
generate test I think nothing more to
add here just play round of it it's a
great way again it shows off ghost Texs
and SL tests if you use inline chat for
example another case where inline ched
does a bit more work it actually tries
to detect which testing framework you're
using which folder they should go in um
but it also if you use ghost text and
you have the file open implementation
that you're trying to test and you just
start writing test it also gives you
this magical experience of just
understanding implementation and writing
tests for it so depending on which flow
you like most um those are interesting
places to explore it so heck away and
ask question H the button no I just
gonna say this point uh you just kind of
go through the labs and and play around
and if you if you have any questions
raise your hand also use the discussions
me go back to that slide um thank you so
much Harold
um go back to the slide where uh all the
links are um we'll be happy to help you
out please continue working on your Labs
if you want to do that but um I just
wanted to throw this out there if
anybody has any kind of General co-pilot
questions uh you want to ask us
especially Harold frankly because he's
he actually works on on uh the the vs C
team and works on a lot of the stuff um
this is a great opportunity so if
anybody has any questions um out there
we'd love
to see if we can answer them
so so the question was what what model
are we using yes it's my favorite
question I just closed the issue on gbd4
turbo um it's no Public Announcement but
I closed the issue on tp4 tobo it's
rolled out so you can ask actually in
the chat panel you can ask it which
model's using and if you're on a latest
version if not I'll find you um it will
say gp4 Turbo because I prompted it
so see if you tell gbd4 turbo it's using
for Turbo if you tell it Ed gb5 it will
also tell you that's using gp5 so but
it's actually so we rolled out uh four
O's and and it works as
well um inline shed is still 3.5 because
four is too slow so
far so so that so that's interesting
maybe talk more about that so yes so
four uh even though even turbo even
though you just closed the issue on
turbo four is still too slow for inline
chat yeah we we're so we're constantly
running this multimodel flow um
especially because we we want to always
balance the the performance developer
experience where can stay in the flow
and that's why for completions we're
using 3.5 very SM very small context
window to say under these 250
milliseconds
instant ghost text popping up for most
users so on average and then for inline
shed
3.5 uh when we ran experiments when we
ran uh offline eals and the whole
systems we have in place to constantly
assess new models we actually noticed
that there's only a slight lift in
quality and only in some languages for
inline ched going to pd4 but then when
we ran an experiment a lot of people
churned out because the time to First
token is still a lot slower so we're
always taking this approach of balancing
this performance and quality aspect and
what what provides the best experience
in in the right job so that's why yeah
so every panel Channel panel chat
question you ask right now gets did get
gbd4 now gets gb2 turbo and inline chat
just for that performance aspect still
uses
3.5 very cool all right now now when is
a gbt 40 coming it's
coming I had to
ask follow the issue I'll close it
with um with all of the work that's
being done by Microsoft with and many
others besides with small models like 53
Etc are you looking at testing those and
implementing them yes we're testing
those yeah interesting uh there's
actually if you look at the 53 cookbook
on GitHub there's a chat extension
sample 4vs code to use 53
locally in chat awesome out of Interest
are you able to what sorts of things you
look at when you test new models within
the GitHub co-pilot product like what
metrics you might look at the the the
behind the curtain so we have so most of
our offline Evils are code based so if
you think slash fix uh Slash docks and
we have a smaller test set that runs
generally on each change code change
where we test specific patterns if they
improve or uh regress and that's mostly
based on issues we've seen in the past
like oh it didn't get uh this pattern
right or it didn't look at specific
files so we're trying to just assess the
general competence and what we expected
and then there's larger offline evils
where we run it on across different
repos and try to understand how how well
these SL fix and SL dos work so these
are not public benchmarks but they're
trying to assess basically it against
open source code that we can get to run
on GitHub so if you have a rebound
GitHub make sure it run the test runs
yeah so yeah that's basic gives the
Baseline they they never pass 100%
there's always like we're trying to get
the pass rate up but it's typical
offline evil of we're trying to get
better over time and interestingly a lot
of the big model updates they don't
necessarily 10x those metrics there
there's always some languages get better
some languages get worse so it's it's
really and they always require prompt
changes so don't don't run after the
latest model just because somebody told
you so they always the Nuance of
actually optimizing for the models and
then testing out each model
separately I didn't cat didn't quite
catch that did you mean that we can test
a f model locally did I understood that
right uh check search GitHub for the F3
cookbook and there's an example there
too yeah okay thank you so for
background uh vs code has an has
extension apis many many thereof so all
the cool extensions you're running are
inv vs code are using these extension
apis to provide the functionality we
have extension apis for co-pilot chat
you can actually add your own
participant and you can actually provide
your own models in the chat as well so
these these are two uh extensions
there's also blog post um that just came
out yesterday uh I think that were that
that you can check out on the vs code
block that talks more about extensions
so if you want to play around a lot of
PE companies do this internally for
their own developers just bring in their
own developer experience and knowledge
into co-pilot chat and some custom flows
and other companies like stripe and
postgress and other projects are
bringing these chat participants by
extensions into co-pilot chat for some
custom workflows for all the developers
that they're
serving but that kind of allows you to
plug into the existing I don't know
experience
is it possible or will it be possible to
replace the connection to whatever GPT
model would be used at the time to be
able to use the copilot at the companies
which currently do not allow it uh
because that would mean sharing your
code as you go with an external provider
currently not so that's that's not a not
a yeah replacement of the underlying
model but but the 53 cookbook shows you
how to do it in a more sandboxed way to
to replace parts of I understand but is
there any chance that it's coming
anytime in the future something like
that it's on a list of things we're
looking into yeah so we're we're we're
looking at models all right thank
you
questions right then uh so the next one
is is there any intended use difference
between the con control I inline mode
and the sorry the command I and command
shift I
modes between inline shed
and standard
Comm right and then we also have sh oh
quick chat yes yeah uh if you haven't
tried it yet control a quick chat that's
the idea is so we're exploring different
just form factors for chat and that's
more of a quick question overlay so
that's kind of the idea you don't want
to go into panel chat especially on a
small viewport so it's mostly
a preference the history conversation
then yeah right yeah and does it also
have a new chat then you would just
close it you would just yeah oh right so
it holds the conversation as long as it
have and control L works works works as
well you can just empty it perfect yeah
uh and let me let me let me just uh uh
ask that question so everybody can hear
um the the question was basically um is
there a way to take advantage of uh I
guess like local documentation um and
and agents that might take might exist
in in a code base that might be more
updated than um what the what the model
itself is is that getting
close Li for right for libraries so it's
not not locally but for other libraries
but for things that that just the model
hasn't been updated for because things
are changing all the time yeah so cop
Enterprise has knowledge bases um I
think there's some links in the training
in the end to cobal for Enterprise and
some of that documentation so knowledge
bases allow you to import a repository
with markdown as as a grounding and then
reference that in your question
especially on github.com but also in the
at GitHub agent envious code and we try
to make that more accessible and
naturally to to code but that's one way
um that you could bring in external
documentation just have it have it
indexed have it referenced then you
curate it in these knowledge bases as
something you can reference like using
our LM stack and then you you reference
the combination of different projects
that you're depending on and you can
update them as you as needed uh there's
more work there think to bring knowledge
basis to more usable and easier to
update flow so that's something we're
also looking
at agent yeah
so the question is do you I guess two
questions so one is is there some
knowledge retrieval we can do with these
chat
participants uh chat participants can
provide context variables so if there is
specific context that those participants
want provide like their API
documentation or more Dynamic things
like which actual databases are used in
your in your product and what is their
schema they can be exposed as context
variable so you can combine them with
context and we actually yeah we're just
looking into more automatic inference
how to get this context in so you don't
have to
know yeah they basically saying if you
asked a question and and copilot didn't
know it but it was about something that
you had an extension installed with or
an agent installed with it could
automatically then send that to to to
the agent yeah that's that's actually on
the exploration for within the next
months so we're looking because we we
see when people discover extensions it's
like oh this is amazing I want to use
this every day and then they keep
forgetting about it or they they never
discovered it up front so that's a big
problem we saw in our user testing so
the automatic inference a big part of
just co-pilot being aware of what you
have installed uh what you're working on
and then calling the extensions as
needed so that's
coming thank you so much Harold for this
impromptu Q&A that I just like threw at
you at the last minute we really
appreciate that no no no no no no no you
were fantastic I just this was idea that
the Dave and I had we were like while we
have you know M
produ uh Harold mentioned the blog post
from Visual Studio that I didn't even
realize was out yesterday
so on the main repo link there's a
GitHub co-pilot resources. MD file and I
already had a reference to the co-pilot
extensions blog post that came out in
conjunction with Microsoft build so in
that section I said and see also this
Visual Studio code so we're you know
we're being as dynamic as we can here um
there you go yeah so that blog post is
now you don't have to remember this URL
just the the repo your or the devops
resources or sorry the devops version of
the GitHub co-pilot uh
lab the check out the resources file
there also check out the discussions I
wasn't able to find what Harold was
referring to with the cookbook 5.3 or
whatever but we can throw
oh awesome awesome so yeah when you go
to those discussions you know we we have
those links and and things there we'll
leave I'll keep an eye on those uh
discussions for a few days so if
something else comes up feel free to uh
throw a question or a comment out there
and since we are we got about a little
over 20 minutes left here I will put in
a plug too there's a couple of survey
questions there please let us know what
you thought about this lab please let us
know what you thought about GitHub
co-pilot in general and you know add
comments on either one of those if you
uh would like
to anybody else have any other questions
or anything
is GitHub copilot workspace going to
replace copilot chat
[Music]
or does it have any other purose
um yeah I
think from my perspective yeah I'll let
Herold talk about it but I think there's
you know a purpose for co-pilot
workspace and a purpose for co-pilot
chat and and everything I'll let Harold
address
it so who has seen co-pilot
workspace okay let me describe you in
Brick great stroke so copad workspace is
a standalone experience where you can
start from a
repository or a PR or other places
there's great demos great videos out
there there's an early adopter audience
already playing around and getting
really excited about these flows but you
since start with a task it breaks it
down into a plan and it allows you to
make cross repo uh cross file edits and
Implement features fix bugs that are
more complicated but it's a it's a great
ENT flow that keeps the developer in
control at every step and allows you to
give feedback and correct the plan and
correct the plan
items and stay in the loop as as the AI
proposes
changes the outcome is that you end up
with a diff and the diff can even run
the actions in the repository you have a
terminal where you can run through your
build stab and have other ways so
there's a lot of a lot of pieces build
in that suddenly look like an editor so
my my hopes this is eventually something
that if you ask a more complicated
question in chat it will just use a
workspace like flow to apply these edits
but there's also other Explorations that
we're applying how it can look like in
PR reviews what's the best workspace
flow for the many things developers hit
in a day today how can AI help with
reviewing a PR so all of these things
are where a more specialized AI breaks
down a task into multiple steps and
keeping you in the loop and in control
so I don't think it's a replacement it's
a it's a necessary flow it's something
you can already do and get up cop Chad
just start with asking it about a plan
and then work with co-pilot through a
plan so with proper prom crafting you
can get pretty close to that
experience and stay in control I think
that's that's the main one there
yeah make sure everybody can hear all
right perfect I'll hello super thanks
all right so the question was um copil
Enterprise has a couple of really cool
features such as PR summaries or
knowledge bases I'm Kean to understand
in terms of those features living in vs
or like in the code editor so so like
yeah I'm doing APR I'd like to
immediately summarize what the pr is
about is there some sort of outlook on
what that's going to look like so you
there is a way um it's it's a different
experience but there is a way to
summarize uh PRS in vs code right now so
there is a way to do that that that is
separate from the the the GitHub
Enterprise feature but this is actually
I think and and you could talk more
about this this is something we're we're
trying to kind of balance the two
experiences between you know how things
work you know kind of on github.com and
then the way that people are using their
editor um if you want to say more about
that process some some hot takes now um
so I think in the beginning you saw
definitely more copil experience
sprouting up under the like copil x
moment that happened at universe so just
people trying out like what what does AI
mean in developer flow so PR uh
descriptions went out there and then
this new tier uh SK for for copy for
Enterprise so I think a lot of is like
what is a value ad that we can bring to
Enterprises that work for if you have a
th000 repos and need to manage 2,000
developers what are the different use
cases that are not as simplistic um of
like a typical day in a developer
working on a project so there there's a
lot of that thinking right now happening
like how do we best separate those I
think a lot of times we we are focusing
on bringing everything that's happening
on gi.com making sure it can shift left
uh into the developer experience in your
editor as well so uh as you can see we
already have like in C vs code you
already get the little mag magical AI
buttons that can write you a commit
message that can write you a simple PR
description but if you look at PR
descriptions on GitHub they go to way
more lengths looking at more files so as
you go into see those features just
become more powerful and more grounded
and more suited to the the the needs of
Enterprise so I think that's that's the
best way to think about those um and yes
there some features that are in locked
in C right now because they're still
there need more Enterprise feedback and
they need to scale to Enterprise needs
um but otherwise yeah there's definitely
shift shift left of these features
happening so they become available in
the editor as we figure out how to best
provide them in the editor but no so if
you haven't tried it out in the
codespace you see the pr extension is
automatically installed in the codespace
so you can manage your issues your PRS
if you can create PRS so that's also
what what you can do in code spaces
thank you
[Music]