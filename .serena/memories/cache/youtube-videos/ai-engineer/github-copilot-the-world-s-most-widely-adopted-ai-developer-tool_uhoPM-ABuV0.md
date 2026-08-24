[Music]
so good morning everybody morning there
we go my name is Dave bernes I'm a
senior devops Advocate with GitHub and I
want to talk today about GitHub co-pilot
and demo a little bit of everything that
co-pilot is
today because it has the capabilities
have grown a lot now over the last uh 2
three years so how many how many of you
are using GitHub co-pilot
today okay looks like half to 2third
kind of a thing kind of a ratio or so
here so yeah as we get started we can
see GitHub copilot started out just as
generating code in the IDE with co-pilot
individual then we launched co-pilot
business into ga uh shortly after that
year and a half ago I guess that would
be we launched co-pilot chat so now not
only could you ask co-pilot to generate
code for you but you could pick
somebody's existing code maybe they
didn't write very good comments in their
code shocker right say hey co-pilot
explain that code to me or help me
simplify that code so many many more
ways to use GitHub co-pilot and then
just this February we launched GitHub
co-pilot Enterprise being able to not
only use co-pilot in your IDE of choice
but also right on github.com
itself have co-pilot help you generate
poll request summaries or tap into
information that may be stored in your
knowledge bases and ask co-pilot
questions uh and things like that and
use a lot of the same chat features
right there and I'll also talk about
some of the things that um we're
launching uh right now we've got in beta
and and Technical preview and and such
so as most of you know uh Gib co-pilot
is there to be your AIP pair programmer
help you uh generate code based on
comments and things now the thing about
co-pilot individual and co-pilot
business it lives and runs extensions in
Visual Studio code GitHub code spaces
which is Visual Studio code running
inside the browser the jet brains idees
like py charm and intellig and visual
studio and a key thing about this is it
doesn't actually matter where your code
lives right the code hopefully lives on
GitHub GitHub Enterprise Cloud but the
code could live in bitbucket or Azure
devops even in team Foundation Version
Control doesn't even have to be
git-based Version Control and you can
still take advantage of everything that
co-pilot business and co-pilot
individual have to offer so I am going
to play through a little little video of
the basics here because there's a couple
of things I want to point out this is
just a two-minute video let's see how
co-pilot can make me a more productive
developer I'm using Django python which
like most programming languages and
Frameworks is supported by co-pilot
Jango is a framework for cre creating
lined business applications and the
first step is to create my model classes
which is typically tedious what I'm
going to do instead is describe using
natural language what I need my model to
look like that gray italicized text is
copilot generating the appropriate code
it creates the class definition and the
full class across multiple lines of code
copilot is also context aware it saw the
fact that I created a speaker class and
once again goes well speakers need to do
something and it generates a talk class
for me that entire class all of those
lines of code was generated for me
automatically by
co-pilot there was one thing I didn't
necessarily want here which is it's
allowing for speakers and talks all to
be delet it I want to modify that so I
go back to co-pilot ask it for a new
suggestion and it generates one finally
I want to add on a code for the talk
which matches a particular pattern
normally at this point I would go
running off to stack Overflow to look up
how to write this regular expression
instead I describe in natural language
what that pattern is supposed to look
like and copilot generates all of the
appropriate code for me this allows me
to stay in the zone and focus in on the
more important aspects of writing
code all right now I know that's a very
basic demo and most of you who are using
co-pilot have seen it and used it in
this way but still there's some key
things to point out here it's called
GitHub co-pilot it's not called GitHub
autopilot you know this is not going to
replace developers we still need that
person in the middle and there was a
great example here of that you know when
it generated uh the in the talk class
initially it was allowing speakers to be
deleted even when talks existed so he
wiped out that line he continued the
conversation with
co-pilot added that additional comment
to say hey no don't allow speakers to be
deleted when talks exist and then he was
able to get you know exactly what he
needed in this case now another thing
there's there's actually an opport
opportunity here in this in even in this
little demo to talk about prompt
crafting or prompt engineering you know
when when he was adding this talk code
he didn't just say add a talk code he
was more specific right he said with a
format of three letters a dash and three
numbers and that would allowed him to
get back the regular
expression that he needed so that you
know part of prompt crafting is is that
specificity in your comments in your
requests and things but another key
element here is he was able to stay in
the flow he didn't have to leave the IDE
and go to find some regular expression
documentation or do a a Google search or
anything like that to figure out that
syntax he got that in a matter of
seconds so you can see in a second
actually you know so you can see just
how much this can improve productivity
and keep you in the flow and things like
that now next we oh so here's some at
the end I'll have a link where you can
find a lot of these resources uh and
things and at some point after this
session I'll put a PDF up there so
you've also got all of these uh links
and things but we've got several
resources now to learn about prompt
crafting you know this is not something
where you need a weekl long Boot Camp or
anything like that just an hour or two
of you know it'll take less than an hour
to understand prompt crafting but then
just kind of playing around with it
yourself to get a better feel how do you
get more accurate suggestions for the
context that you're in and everything
and then next we launched GitHub copilot
chat so we went from just typing in
comments in code to having a chat panel
right inside the IDE so now I can do
things like hey give me an overview of
the entire solution uh help me write
automated test explain this code to me
help me find and fix the bugs in my code
and stuff so let's see a little demo of
that co-pilot is great for giving you
code suggestions in line as you type but
there was no way to easily ask questions
or provide additional context until now
co-pilot chat lets you have a much
richer pair programming experience right
in visual studio and visual studio code
it can suggest tasks based on your code
for example here I have some code I've
inherited with a bunch of regular
expressions in it but it's pretty poorly
documented let's ask co-pilot what they
do oh looks like we have validation for
email addresses phone numbers and strong
passwords Mak sense but let's ask for
help to make this code a bit more
readable for the next person I'll type
make this code more
readable not bad but I'd like some more
so let's ask copilot to separate out the
validation functions and add more
comments okay great that's much better
the code is now in separate functions
with the comments and the variables have
much more meaningful names this is going
to be a lot easier to maintain going
forward so let's bring it
over now let's take a look at some code
that isn't working and see if co-pilot
can help me figure out why I'll ask
co-pilot to propose a fix for the bugs
in my
code now co-pilot's determined by
looking at my comment and comparing it
to the code that I was treating the data
as comma separated in my code but in my
comment I was saying it was space
separated it's also noticed from the
comment that I was returning the values
in a different order and is adding some
error checking for me that it typically
sees with this type of code okay so
let's bring this code over and run it
and yep that works brilliant while we're
here let's ask co-pilot to create us
some unit test so we don't accidentally
break this code again perfect co-pilots
analyzing the co- paaths we take in our
code and using the context from the
comment to generate a set of unit tests
for the branches of logic it sees it's a
great start for us so we could take this
copy it over into a test function and
then build that out over time but let me
show you one last thing with chat
functionality right in your editor it's
so much easier to stay focused and on
task you can ask for help about coding
right where you are you can even have a
conversation with Copilot to learn more
let's ask for an example here however
we're deliberately constraining the
prompt to ensure we only have questions
that we detect has an intent around
programming if we stray outside of this
it will politely
decline so yeah while Coop pilot can
help you're you're on your own as far as
figuring out what's for dinner so so
yeah you can see there he was able to
have the code explained to him generate
comments for the code refactor it uh
debug code write unit test for it all
from working right inside of GitHub
co-pilot chat so we added a lot more
capabilities there now we made a pretty
big splash at Microsoft build last month
talking about GitHub co-pilot extensions
so this brings the world's knowledge
into the most widely adopted AI
developer tool and through a growing
partner ecosystem co-pilot extensions
are going to enable developers to build
and deploy to the cloud where with
natural language with their preferred
tools and
services you know a lot of third parties
out there mongodb and and um octopus
deploy and data stacks and and and lots
of others understand that GitHub is the
place that developers want to be so that
developers can stay in the flow now with
GitHub extensions you can access
information and things uh from a lot of
these other thirdparty systems directly
from GitHub co-pilot
chat and so you can see we had an
initial set of Partners here and
actually I'm going to play through one
of the little demos here that so that
that link there and again all this will
all be provided uh at the end
uh takes you to this blog post where we
made the
announcement and I'm going to play the
uh octopus deploy
Dem the octopus extension for GitHub
co-pilot allows developers to maintain a
state of Flow by querying the state of
their deployments from the same tools
they use to write their code in this
example we have a node.js web
application we will commit and push
changes to our git repository and track
those changes through the GitHub
co-pilot chat interface we'll make a
small change to the index page save
those changes and then push those to our
repository once pushed the GitHub
actions workflow will trigger a build
and initiate a deployment to octopus
deploy we can then track the deployment
through the octopus extension for giab
co-pilot we can view the high level
status of deployments to all
environments with a text Bas
dashboard so you can see he asked there
hey octopus deploy show me the dashboard
and again without breaking the flow
right inside of GIB copilot chat he's
getting this information to see okay
have the changes been deployed all the
way to production yet let's look at the
versions and see no the latest version
is not yet in production so getting all
of this valuable information without
leaving uh your flow useful items in the
deployment logs like URLs can be
extracted we can use the comprehension
cap actually in the interest of
time we'll we'll just stop there because
there's definitely other things that I
want to uh cover but yeah you you can
see that full demo if you go to
github.io extensions blog post and we'll
have links to that uh available uh later
so in February we launched GitHub
co-pilot
Enterprise so now not only are you able
to do all of this inside of your IDE but
bringing it to GitHub Enterprise cloud
and adding new capabilities like
building uh Bing search right into uh
the chat and everything be being able to
tap into knowledge bases of information
that you have uh and everything so for
this I'm actually going to do a live
demo if I can find here we go so here I
am
on
GitHub uh let me reload
this get logged in
here there we go so I'm on github.com
GitHub you know where where we have our
repositories and everything and you can
see here now we actually have the chat
available to us right inside side of
github.com so I can come in here and I
can ask general questions like let's say
I'm starting a new project and I know we
want to put feature Flags into our
solution so I could say how do
I whoops if I type my little shortcut
right here how do I get started with
feature flages here at GitHub now if I
don't specify that I want to search our
knowledge bases I'm going to get a very
generic answer choose a feature flag
Library integrate that Library uh and
and and such but now we have the
capability to add in your own knowledge
bases so knowledge bases are collections
of markdown files that are stored right
inside of your repos themselves so if I
say hey I I want as context to look at
the GitHub engineering
documentation and then I ask that
same ask that
same well yeah I should have pulled out
my other keyboard this keyboard's a
little sticky come on
now there we go how do I get started
using feature Flags here at GitHub now
I'm going to see a different answer with
more specifics based on GitHub
engineering's uh documentation and
everything so and actually this is still
somewhat generic it's it's just it but
it is referencing documentation from our
uh from our knowledge base so I'm going
to do this again because I typically get
a little different answer there
there we go now my shortcuts
working there we go this is more what I
was hoping to see so now it's giving me
specifics you know it's saying hey we
use the flipper FR framework here
internally so it's showing me specifics
about here's what I need to actually put
in my code to get started with feature
Flags so that's using knowledge
bases all right now I'm going to flip
over to another
environment this environment uses
Enterprise managed users so let me do a
refresh here because I'll have to relog
in there we
go so yeah I have a separate identity
under Enterprise managed users because
now this is for everything internal you
know this is a Walled Garden to ensure
that nobody can accidentally take a
private repository and make it public uh
and things like that so a lot of the
security that enterprises are looking
for but in this case I have this is this
is uh Parts Unlimited uh website so if I
open
up and if I open up the website it's a
site for selling Auto Parts right and
how many recognize Parts
Unlimited anybody ever the Phoenix
project by Jean Kim okay yeah Parts
Unlimited was the fictitional company
that was in that book but anyway um yeah
so Parts Unlimited started out as a
brick and mortar store in the Washington
area so right now sales tax is kind of
hardcoded to sales tax for Washington
but that that's not what we want now
that we're an e-commerce site we have to
be able to calculate sales tax wherever
the buyer lives right so I'm going to
bring up GitHub co-pilot chat here
Enterprise chat and ask
where come on my keys will
cooperate where in this repo do we have
code that calculates sales
tax so it'll take a moment but it's
looking so something you
something to notice here is it's saying
this repository has been indexed for
improved understanding and accuracy so
with GitHub co-pilot Enterprise you go
through and pick what repos you want to
index for these types of searches so
it's telling me yes there's the default
shipping tax calculator CS file that
includes this calculate tax function and
I'm actually going come on
there we go going copy calculate tax
there but then it's also showing me who
the other callers are of calculate tax
so I I get a good picture you know of
how this is uh working throughout the
entire
solution uh or repository so we can open
that file
up and we'll see okay here's calculate
tax and yeah in fact it is hardcoded
right now to certain tax rates so
7.5% sales tax for state of Washington
that might even be out of date um but
now I'm going to ask co-pilot this is
where kind of like the the Bing built-in
Bing search comes into play are there
any public apis out there that I can use
to calculate sales tax in any postal
code so now it's going to come back with
uh a list of apis that I could use
here free sales tax API tax apis uh
Sales Tax
USA
avalara Etc so now I want to leverage
GitHub co-pilot Enterprise to say hey
what would that calculate tax function
look like if I wanted to use let's say
the AL avalara uh API so the but what I
want to do is first kind of set the
context for co-pilot so I'm going to say
now did that paste NOP doesn't look like
it uh see if I can spell it right
C and see if my keyboard will
cooperate there we go calculate tax
so now I'm telling copilot that's the
context that I'm talking about so now I
will
say how would this how would I update
this code to
use of
aara API
all right you can see this this is live
demo responding in real time so now if
we look here at the the
differences kind of try to zoom in here
yeah you can see where we were
calculating you know the tax rate here
hardcoded now it is showing me how
to it's doing the same thing it's still
returning taxable times tax rate and all
that but here it is using that avalara
API and everything instead now another
key thing here if I scroll down and look
at some of the additional explanation it
gave me said hey there's one possible
vulnerability here you're when you're
working with an API like that you're
going to have an API key that you have
to store so it's telling me make sure
you do not hardcode that API key in your
code make sure you store that in hashy
corp Vault or Azure key Vault or GitHub
Secrets or or something like that so
it's helping you with some of those
security best practices uh as well along
the
way all right couple more things and
then kind of uh
uh about five six minutes left so yeah
there's demos out there on YouTube for
GitHub co-pilot Enterprise and
everything also oh yes so that was the
chat in the repository one other thing I
want to show you
is we we have it now so that when we're
looking at poll requests so here's
here's an existing poll request and I
was kind of lazy when I first created
this poll request
I've got GitHub integrated with Azure
board so I referred to the Azure boards
user stories and uh work uh tasks and
stuff that I'm completing as part of
this but I didn't provide any other kind
of a description well now with GitHub
copilot
chat I can edit this and you'll see we
have the co-pilot icon in here as well
so I could come in here and say hey
co-pilot generate a summary for me
so how many times do developers write
nice summaries that anybody could read
you know getting ready to review the
code uh and everything yeah not very not
very often but with copilot it's going
to look at all the changes that you've
made provide a nice summary paragraph
and then file by file list out all of
the changes there we go just took a few
seconds
so now I have a nice summary here and
then you can see yeah file by file it's
listing out each change in each file
kind of a thing so and it makes it easy
for developers then to provide a lot of
information and uh you know not have to
spend a lot of time doing that now the
other thing that you can do here when
you're looking at a poll request and we
we we even have more coming with
this okay okayy come on internet you can
do it there we
go so I can go in and look at one of my
changes I'm going to skip over this one
for the moment yeah let me just look at
this change and I can come in whoops
that's not the what I want here we go
you'll see the co-pilot icon here too
now this is obviously a very simple
change we're just doing some rebranding
of the website here but if this were
more complex you know I could say
explain and have uh co-pilot explain the
change to me so yeah in this case it's
just that simple changing from fabric
cam to Koso but if this were more
complex you know the the reviewer can
look at this look back at that user
story and say okay by looking at the
user story I know what the intent was
now does co-pilot agree that the what's
actually implemented matches that
intent so that's another way to use
co-pilot enterpr
PR so we talked about the chat we talked
about searching the knowledge
bases poll request summaries and
such this this works with co-pilot works
with any language the large language
models have been built off of the vast
majority of the open source code that's
out there there's even Cobalt code out
there so I found a Cobalt uh a
repository out there that has cobal
examples in it so I said hey what what
does this code do and GitHub co-pilot
was able to provide an explanation for
me you know simple Fibonacci Sequence so
you could then next prompt and say hey
how would what would that code look like
in Java what would that code look like
in C or something so use this as a way
to modernize your your uh cobal and
other code the next one is co-pilot
workspace ah I ran out of time I
actually don't let's see let's
go all right let me do this I'm not sure
if there's anybody coming in the room
right away here at
11:15 let me do this first just in case
there is somebody coming in next so if
you want to take a screenshot of this uh
URL we have a page out there that has I
don't know 15 20 links to additional
training some of our key blog posts and
things like that that we've recently had
and yeah this will be dynamic as more
and more things come in we'll um we'll
add to that and everything uh also yes
we'll be at the GitHub Booth uh where we
can
a answer additional questions and and
things like that so yep I see people
moving on thank you very much for your
time so yeah stop by the Microsoft booth
and we'll show you co-pilot workspace
[Music]