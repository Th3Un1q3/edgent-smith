tool: fetch
url: https://robertsahlin.substack.com/p/the-ai-retrospective
date: 2026-08-13
source: fetch

Contents of https://robertsahlin.substack.com/p/the-ai-retrospective:
<p>The AI Retrospective - by Robert Sahlin</p>
# Data Platform Engineering

# The AI Retrospective

### Why your code is the least important thing you built today

Robert SahlinJan 30, 2026

Most developers use AI as a high-speed completion engine. They prompt, they review, they merge, and they move to the next ticket. It is an understandable instinct because velocity is the primary metric we are taught to chase.

But this approach overlooks the most valuable output of the process.

A feature should not be considered finished just because the tests are green and the code is deployed. Completion should only happen after a full retrospective between the developer and the coding agent. The goal is to talk about the how rather than the what. By shifting the focus to the process, it is possible to build a system that gets smarter every time a task is completed.

By shifting the focus to the process, it is possible to build a system that gets smarter every time a task is completed.

### How the retrospective routes information

I treat the retrospective as a sorting mechanism. We identify three distinct types of information that are then logged automatically into the system:

* Behavioral improvements: These are lessons about our specific way of working. Any insight that can improve future sessions is added directly to the context file or the workflow file. This ensures the agent is better equipped for the next track.
* The tech debt log: Speed often requires compromises. During the retro, we identify where we took shortcuts and log them into a dedicated tech debt log so they are never forgotten or buried in the code.
* The feature backlog: Good ideas often emerge when you are in the flow of building something else. We capture these scoped-out features and move them to the backlog immediately.

### Turning lessons into mandatory guardrails

Usually, lessons learned are just notes in a file that stay buried. We have made these a functional part of the workflow by adding a mandatory review gate.

An AI agent is now technically blocked from starting the next phase of work until it has confirmed that it has read and incorporated the fixes or behavioral changes from the previous phase. The learning is no longer a suggestion; it is a hard rule enforced by the system.

This is the essence of compounding engineering. Every track we finish doesn’t just result in new code; it results in a more efficient, more capable system for the next track. We aren’t just building software; we are building the machine that builds the software.

We aren’t just building software; we are building the machine that builds the software.

### The answer is worth more than the code

If you are only using AI to generate functions, you are missing the most important part of the technology. The next time a track is finished, ask the agent what it learned about the workflow that should change for next time.

Better yet, make that question a mandatory step in the agent workflow. The answer might be significantly more valuable than the code itself.

I’m committed to keeping this content free and accessible for everyone interested in data platform engineering. If you find this post valuable, the most helpful way you can support this effort is by giving it a like, leaving a comment, or sharing it with others via a restack or recommendation. It truly helps spread the word and encourage future content!

You can also connect with me or follow my profile on LinkedIn, where I share shorter-format thoughts and daily reflections on data platform and agentic engineering.

Full Disclosure: I am a Google Developer Expert, but I am a Google customer first. I maintain a critical eye when exploring and evaluating Google’s services.

#### Discussion about this post

No posts

### Ready for more?

© 2026 Robert Sahlin · Privacy ∙ Terms ∙ Collection noticeStart your SubstackGet the appSubstack is the home for great culture