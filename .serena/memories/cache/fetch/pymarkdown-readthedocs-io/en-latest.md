Contents of https://pymarkdown.readthedocs.io/en/latest/:
<p>Introduction - PyMarkdown Linter (PyMarkdownLnt)</p>Skip to content
# Introduction#

## Note to New Readers#

As part of our effort to prepare for the upcoming version 1.0.0 release, we are moving our documentation from plain Markdown files hosted on GitHub to this new centralized documentation site that you are currently reading. We appreciate your patience as we complete this transition.

## Where to Start#

If you are looking for a high-level overview of PyMarkdown — what it is, why you might use it, and what it can do — the main README.md file is a great place to start and to decide whether PyMarkdown is a good fit for your project, your workflow, and your team.

If you have decided to use PyMarkdown for your Markdown linting needs, read our Quick Start guides to get started quickly and learn the core concepts of installing, configuring, and using PyMarkdown on your own Markdown files.

If you are looking to integrate PyMarkdown into your own Python applications or scripts, explore our API documentation, which walks through the PyMarkdownApi with practical examples and detailed usage instructions. For a complete reference of all API methods and parameters, see the API Listing.

If you have already viewed our Quick Start guides, or simply want more information on PyMarkdown and its capabilities, continue reading. By using the contents located on the left and right sidebars, you can quickly navigate to information about advanced options, configuration details, and other reference material that you can explore as you become more comfortable with PyMarkdown and want to go beyond the basics.

## Core PyMarkdown Concepts#

PyMarkdown is primarily a Markdown linter. It scans your Markdown files and checks them against a set of rules to find potential problems and style issues.

To do this, PyMarkdown uses its own Markdown parser instead of relying on regular expressions or ad‐hoc text patterns. This parser is designed to follow the GitHub Flavored Markdown and CommonMark specifications, which many other Markdown tools also follow.

Because our rules work with the structured output of this parser, they can reason about headings, lists, links, and other elements in the same way that typical Markdown renderers do. This helps ensure that the issues they report match how your documents will be interpreted on common platforms.

## Background and Foundational Information#

The rest of this document provides background information about Markdown, linters, and reasons to use the PyMarkdown linter for your projects. If you already understand these topics, continue on to the section on What to Do Next.

## What is Markdown?#

Markdown is a plain‐text format with simple markers that indicate structure, such as headings, lists, and links. These markers keep the text readable while making it easy for tools to turn it into HTML or other formats. If you look at the raw Markdown for this page, you will see that, apart from a few simple markers, it reads like normal text.

Our team prefers Markdown because it lets us focus on content instead of layout. When we write documentation, we can concentrate on what we want to say and how it is organized. We defer visual style decisions until later, when we can apply them consistently across the site.

## What Is a Linter?#

As noted above, early software developers established the term linting near the dawn of modern software development. Stephen C. Johnson needed a tool to spot issues with his code and filter them out, like a lint trap in a clothes dryer. Although the term may have unusual origins, the name stuck, and the benefits imparted by linters remain to this day. A linter is an additional process with distinct goals, designed to check for a specific set of issues in the source code that powers a software application or system.

We have found that the easiest way to explain linters is to say that their functionality is analogous to spell checkers and grammar checkers. As a matter of principle, our team only publishes documentation after running it through both spell and grammar checkers. This parallels our source code, where we run Python checkers over our source code to ensure that we are adhering to our own source code guidelines. If we extend that idea to view documentation as a kind of source code, it makes sense to have a checker for it as well. That checker should help keep our Markdown documents consistent and easy to read, just like the tools we use for our source code. That is where the PyMarkdown linter fits into the picture for our projects.

## Can It Do Anything Else?#

While PyMarkdown is primarily a Markdown linter, the breadth of the application has grown over the years of its development. In scan mode, the linter can detect Markdown issues using a robust set of Markdown-specific rules. In fix mode, certain Markdown issues can be automatically corrected without external involvement or manual editing. While fix mode is a relatively new part of the project, we b

<error>Content truncated. Call the fetch tool with a start_index of 5000 to get more content.</error>