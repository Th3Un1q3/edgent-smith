Contents of https://vale.sh/docs/:
<p>Introduction | Vale</p>Vale⌘Ctrlk

StudioGeneratorExplorerLibrary

GitBook Assistant
##### Good night

I'm here to help you with the docs.

⌘CtrliAI Based on your contextVale

* + Introduction
  + Quickstart
  + Installation
  + .vale.ini
  + CLI
  + Styles
  + Scopes
  + Actions
  + Filters
  + Templates
  + Views
* + StylesPath
  + Packages
  + Vocabularies
  + MinAlertLevel
  + IgnoredScopes
  + IgnoredClasses
  + SkippedScopes
  + BasedOnStyles
  + BlockIgnores
  + TokenIgnores
  + CommentDelimiters
  + Transform
  + WordTemplate
  + View
* + existence
  + substitution
  + occurrence
  + repetition
  + consistency
  + conditional
  + capitalization
  + metric
  + readability
  + spelling
  + sequence
  + script
* + suggest
  + replace
  + remove
  + edit
* + Front Matter
  + Markdown
  + AsciiDoc
  + MDX
  + HTML
  + reStructuredText
  + XML
  + Org
  + DITA
  + Code
* + LSP
  + MCP
  + Regex
  + Hunspell
  + Globbing
  + FAQ
* + CircleCI
  + Emacs
  + GitHub Actions
  + pre-commit
  + JetBrains
  + Laravel
  + Obsidian
  + Oxygen XML
  + Sublime Text
  + Neovim
  + VS Code
  + Qt Creator
  + Zed

Powered by GitBook

For the complete documentation index, see llms.txt. This page is also available as Markdown.
# Introduction

Learn about what Vale is (and isn't).

Vale is a command-line tool that brings code-like linting to prose. Vale is cross-platform (Windows, macOS, and Linux), written in Go, and available on GitHub.

> Linting is the process of ensuring that written work (source code or prose) adheres to a particular style—for example, Python’s PEP 8 style guide (code) or the Google’s Documentation Style Guide (prose).

Before getting into the details of what makes Vale useful, there’s one point that needs clarification: Vale is not a general-purpose writing aid.

It doesn’t teach you how to write; it’s a tool for writers.

More specifically, Vale focuses (primarily) on the style of writing rather than its grammatical correctness—making it fundamentally different from, for example, Grammarly.

In other words, Vale focuses on ensuring consistency across multiple authors (according to customizable guidelines) rather than the general “correctness” of a single author’s work.

This distinction is particularly important to understand because Vale doesn’t offer any of its own advice. Instead, it offers a framework for creating and enforcing custom rules. Its approach is much more similar to code linters than it is to traditional grammar checkers.

## Your style, our editor

One of Vale’s most important features is its ability to support external styles through its extension system, which only requires some familiarity with the YAML file format (and, optionally, regular expressions).

To get a better idea of how this works, let’s look at an example from the Linode documentation:

In the above example, we’ve defined a few terms that have a particular capitalization style. If Vale finds an instance of a term that matches a pattern on the left of swap (case-insensitive) but doesn’t exactly match the value on the right, it issues an error. So, for example, Nodebalancer, nodebalancer or any other variation that doesn’t exactly match NodeBalancer will be flagged as an error.

While this example may appear quite simple, it’s possible to achieve fairly high coverage on complete editorial style guides. Check out the Explorer for more examples.

## Syntax- and context-aware linting

Another feature that separates Vale from other linters is its ability to understand its input at both a syntactic and contextual level.

This level of understanding gives you fine-grained control over the linting process, including the ability to limit rules to certain sections (e.g., only headings) or ignore sections entirely (block and inline code are ignored by default).

Additionally, since Vale is built on top of an NLP library, you can also target specific segments of text—allowing you to, for example, warn about paragraphs that exceed a certain number of words or sentences that end with prepositions.

## Tech stack

Vale is a 100% open-source, MIT-licensed project that consists of multiple parts:

NameTechInfo

vale

Go

The main repository containing the Vale command-line interface.

vale-ls

Rust

An implementation of the Language Server Protocol (LSP) for the Vale command-line tool.

vale.sh

Svelte

Website and documentation for the Vale CLI and related projects.

vale-action

TypeScript

The official GitHub Action for Vale -- install, manage, and run Vale with ease.

packages

YAML

A collection of pre-packaged, Vale-compatible style guides and configurations.

vale-native

Go

A native messaging host for the Vale CLI: Use your local configurations in Chrome, Firefox, Opera, and Edge.

NextQuickstart

Last updated 4 days ago

* Your style, our editor
* Syntax- and context-aware linting
* Tech stack
Terms.yml
```
# `extends` specifies the extension point you're using. Here, we're # using `substitution` to ensure correct usage

<error>Content truncated. Call the fetch tool with a start_index of 5000 to get more content.</error>