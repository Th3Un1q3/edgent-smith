Contents of https://pymarkdown.readthedocs.io/en/latest/quick-starts/advanced:
<p>Quick Start: Fast Path for Experienced Python Users - PyMarkdown Linter (PyMarkdownLnt)</p>Skip to content
# Quick Start: Fast Path for Experienced Python Users#

This page is a focused, opinionated path to get PyMarkdown installed and scanning a project quickly. It assumes you already know Python, the command line, and packaging tools, and you just want to see PyMarkdown running on your code — without reading all the docs first.

This is not a complete guide. It is a fast run through our Quick Start pages with the single goal of getting you scanning Markdown as quickly as possible.

If you prefer more explanation, screenshots, or step‐by‐step troubleshooting, use the links in each "Running Into Trouble?" box to jump into the longer guides.

## Is This Guide Right For You?#

Ready for a quick "jog" through the installation and example process? If so, this guide is for you.

If you are not sure if you are ready, please go to our Quick Start: Introduction page. No harm, no foul. We would rather you have a good experience being introduced to PyMarkdown than be frustrated and giving up on it!

## TL;DR: Fastest Path#

If you just want the absolute shortest path to see PyMarkdown work:

```
# Install globally pip install pymarkdownlnt # Or with Pipenv pipenv install pymarkdownlnt # Run once on a sample file echo -e "# First Heading\n# Another First Heading" > sample.md pymarkdown scan sample.md
```

Continue reading for explanations and additional options.

* If the commands above worked, you can safely skip to:
  
  + Pre‐Commit if you want to enforce checks on every commit, or
  + Scan Mode to learn how to scan your own files and directories.
* If they did not work, read Prerequisites and Installation in order.

### Page Overview#

This guide is organized as:

1. Prerequisites – skim to confirm assumptions.
2. Installation – jump here for install commands.
3. Pre‐Commit – jump here if you already use pre-commit.
4. Scan Mode – run scans and read the output.
5. Further Reading – more configuration and features.

## Prerequisites#

Unlike our other Quick Start pages, where we try and keep things as simple as possible for all users, this page assumes that:

* you are comfortable using the command line in your favorite shell and understanding commands like "go to your project root directory and run this"
* Python 3.10+ is installed and available on your PATH
* you know whether you need to use a Python package manager like Pipenv to install PyMarkdown, and if you want to install it as a development-only dependency
* if you plan to install PyMarkdown via Pre-Commit, the basic usage and configuration of Pre-Commit

## Installation#

### Command Line#

Enter one of the following commands at the command line:

```
pip install pymarkdownlnt
```
```
pipenv install pymarkdownlnt
```

If you are using Pipenv as your Python package manager and would like to install PyMarkdown as a development-only dependency, use the following command line instead of the one above:

```
pipenv install -d pymarkdownlnt
```

When using a Python package manager other than Pipenv, consult that tool's docs for adding a dependency. For example:

```
# Poetry poetry add --dev pymarkdownlnt # uv uv add --dev pymarkdownlnt
```

In general, the command is of the form:

```
<package-manager> add/install [--dev] pymarkdownlnt
```
#### Troubleshooting: Installation#

Quick checks

Before jumping to other docs, verify:

1. python --version shows Python 3.10 or higher.
2. pip show pymarkdownlnt (or pipenv graph | grep pymarkdownlnt) shows the package installed.

More help

If those checks still fail:

* See Install PyMarkdown Locally for a step‐by‐step, environment‐focused install guide.
* See Installing PyMarkdown for virtualenvs, CI setups, and other advanced install scenarios.

### Pre-Commit#

Here you will integrate PyMarkdown into your existing Pre-Commit workflow so that Markdown checks run automatically with your other project hooks.

Locate the .pre-commit-config.yaml file in the root of your project directory and add the following content under the repos: heading. Pin rev to the latest tagged release:

```
- repo: https://github.com/jackdewinter/pymarkdown rev: v0.9.36 # replace with the latest tag hooks: - id: pymarkdown
```

After that, you can run PyMarkdown manually via Pre‐Commit with pre-commit run --all-files to verify that your .pre-commit-config.yaml file change is working properly.

#### Troubleshooting: Pre-Commit#

Quick checks

First, verify:

1. pre-commit --version runs successfully.
2. pre-commit run --all-files shows the pymarkdown hook in the output (even if it fails).

More help

If the hook still doesn't run or isn't listed:

* Use Install PyMarkdown Through Pre‐Commit for a copy‐paste .pre-commit-config.yaml that is known to work.
* Use Installing Via Pre‐Commit for custom hooks, multiple repos, or complex Pre‐Commit setups.

## Scan Mode#

This section shows you how to:

* Create A Sample File To Scan
* Perform A Scan Of

<error>Content truncated. Call the fetch tool with a start_index of 5000 to get more content.</error>