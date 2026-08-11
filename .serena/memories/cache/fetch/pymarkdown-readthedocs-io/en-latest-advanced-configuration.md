Contents of https://pymarkdown.readthedocs.io/en/latest/advanced_configuration/:
<p>Advanced Configuration - PyMarkdown Linter (PyMarkdownLnt)</p>Skip to content
# Advanced Configuration#

Configuration is how applications handle command-line options, enable features, and set their values. Early in PyMarkdown's development, we decided to build our own configuration system that is both reliable and flexible.

## A Note To Begin With#

The base documentation for application\_properties was originally adapted from this document. That library now hosts the generic configuration concepts, while this page explains how they are used in PyMarkdown. Moving the generic material there let us refine it for broader use while keeping this page focused on PyMarkdown users.

## Why this Matters#

Some users rely mostly on defaults or a few command‐line tweaks. Others experiment with extensions, Rule Plugins, and settings on the command line, then capture what works in configuration files. The rest of this page shows how to combine those approaches and use PyMarkdown's configuration effectively.

## Skipping Ahead#

From this point on, we use the same basic terminology as the application\_properties module: configuration item keys (like log.level), configuration item values (such as INFO), and configuration sources (command line and configuration files). If you'd like a more formal definition of these terms, see the module's nomenclature section, but it isn't required to follow this document.

To help you either explore configuration concepts or look up specific topics, here is a roadmap of what this page covers:

* Configuration File Types
* Configuration Sources and Layering
* Set command
* Strict Configuration Mode
* Available Configuration Items
* Choosing Between Command Line and Configuration Files

If a topic isn't listed explicitly, look for nearby categories — for example, Rule Plugin configuration is under "Available Configuration Items." Your browser's page search can also help you find specific keys or terms.

## Configuration File Types#

PyMarkdown reads configuration from JSON, YAML, and TOML files via the application\_properties package. This document assumes you are comfortable with at least one of these formats.

At a high level:

* JSON/JSON5 uses a single top‐level object with sections like system, log, plugins, and extensions.
* YAML uses nested mappings with the same keys.
* TOML uses a [tool.pymarkdown] table and dotted keys (for example, log.level and plugins.MD013.enabled).

For full parsing details, see Configuration File Types. The examples below are sufficient for most PyMarkdown configurations.

### Examples#

Each of the three file types is presented on its own tab with the same information:

* the names for implicitly loaded configuration files of that type
* suggested names for the explicitly loaded configuration files that use the --config command-line argument
* a code block with an example configuration file in the specified format

Even though these three files use different formats, they provide identical configuration data to PyMarkdown. Scenario tests (prefixed with test\_markdown\_documentation\_advanced\_configuration\_) verify this for each release.

NOTE: To maintain parity with the other file types, we use a JSON5 parser that allows for inline comments.

Valid file names for JSON files are:

* implicitly loaded: .pymarkdown in current directory
* explicitly loaded with --config: anything, anything.json

```
{ // Do not allow any files starting with `draft-` "system" : { "exclude_path" : "draft-*.md" }, "extensions": { "markdown-tables": { "enabled" : true } }, "plugins": { "MD013": { "enabled": true, "line_length": 100 } } }
```

Valid file names for YAML files are:

* implicitly loaded: .pymarkdown.yml and .pymarkdown.yaml in current directory
* explicitly loaded with --config: anything, anything.yml, anything.yaml

```
# Do not allow any files starting with `draft-` system: exclude_path: "draft-*.md" extensions: markdown-tables: enabled: true plugins: MD013: enabled: true line_length: 100
```

Valid file names for TOML files are:

* implicitly loaded: pyproject.toml in current directory
* explicitly loaded with --config: anything, anything.toml

```
[tool.pymarkdown] # Do not allow any files starting with `draft-` system.exclude_path = "draft-*.md" extensions.markdown-tables.enabled = true plugins.MD013.enabled = true plugins.MD013.line_length = 100
```

When --config is given a file whose extension is not .json, .yaml, .yml, or .toml, application\_properties tries the formats in order: JSON, then YAML, then TOML. This allows extensionless or custom‐named files (such as anything) to work without an explicit extension.

### Need More Information#

For a deeper explanation of how we evaluate these file types, refer to the application\_properties Configuration File Types documentation.

### Which One Is Best - Addendum for PyMarkdown#

In the original documentation, we made the following observation:

> If comments are important to you, then JSON is out.

Howev

<error>Content truncated. Call the fetch tool with a start_index of 5000 to get more content.</error>