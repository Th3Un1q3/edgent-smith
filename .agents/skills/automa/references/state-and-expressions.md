# Reference: State & Expressions

Canonical facts on data flow in an Automa workflow: the `{{}}` interpolation language, data namespaces, variables, tables, global data, secrets, loop data, built-in functions, JS expressions, and condition-builder value types. For the block catalog see [block-reference.md](./block-reference.md); for the workflow JSON schema see [workflow-json-schema.md](./workflow-json-schema.md).

When to load: when you need to write, read, or debug any expression in an Automa workflow — templating a block field, naming a variable, selecting table rows, or building a condition value.

## Vocabulary

- **mustache tag** — a `{{...}}` placeholder in a field value; the engine replaces it with runtime data before the block handler runs.
- **namespace** — the first segment of a key inside a tag (`variables`, `table`, ...); selects one data source.
- **refDataKeys** — the per-block registry list of field names the engine templates before that block runs.
- **storage variable** — a `$$`-prefixed variable persisted across workflows in browser storage.
- **replacedValue** — the templated result; the engine stores it on the working copy of the block.

## The `{{}}` language

The engine templates a field value before the block handler runs. Which fields get templated is per-block: the block registry lists each templated field in `refDataKeys`. The engine finds tags with regex `/\{\{(.*?)\}\}/g` in `src/workflowEngine/templating/mustacheReplacer.js` and replaces each match. A field value mixes literal text and tags freely.

```
Visit {{variables.site}}/docs
```

A field value may mix text and tags; the field must be in the block's `refDataKeys` to template.

Inside a tag, a key resolves as `namespace.selector`. Nested index expressions use bracket syntax for dynamic keys:

```
{{table.[loopData.loopId.$index].columnName}}
```

Bracket the index expression; here the table row is the current loop iteration's index.

## Namespaces

| Namespace | What it holds | Example |
|---|---|---|
| `prevBlockData` | Output of the block connected directly into this block | `{{prevBlockData}}` |
| `variables.<name>` | Workflow variables (untyped) | `{{variables.socials.0.url}}` |
| `table` | Spreadsheet-like table (typed columns) | `{{table.0.color}}` |
| `globalData` | Workflow-level JSON object | `{{globalData.url}}` |
| `loopData.<loopId>` | Current loop iteration item and index | `{{loopData.loopId.data}}` |
| `secrets` | Encrypted credentials | `{{secrets@credentialName}}` |
| `workflow.<executeId>` | Data passed into an Execute Workflow block from its parent | `{{workflow.<executeId>}}` |
| `googleSheets.<referenceKey>` | Data returned by a Google Sheets block | `{{googleSheets.<referenceKey>}}` |
| `activeTabUrl` | URL of the active tab (per worker) | `{{activeTabUrl}}` |

- `table.$last` — the last row; `table.$lastRowId` — the id of the last row.
- Aliases `dataColumn` and `dataColumns` resolve to the table too.

```
{{table.$last.color}}
```

`$last` picks the final row without knowing its index.

- `loopData.<loopId>.data` — the current item; `loopData.<loopId>.$index` — the current index.
- The engine splices `.data` into the path, so `{{loopData.<loopId>}}` also resolves the current item.

```
Item {{loopData.products.$index}}: {{loopData.products.data.name}}
```

`$index` gives the position; `data` gives the item; the bare loopId resolves the item too.

## Variables

Variables are untyped: they hold text, numbers, objects, or arrays, and assignment overwrites the previous value.

Naming rules (for mustache access):

- No spaces in names: `{{variables.first name}}` fails.
- No `@` or `[]` in names.
- Use camelCase or underscores: `{{variables.firstName}}`.

Prefixes:

- `$$` — storage variable, persisted across workflows: `$$variableName`.
- `$push:` — append-to-array on assignment. The first assignment makes the prior value the array's first item; each later assignment appends.

```
$push:texts = "Text 1"   →   variables.texts == ["Text 1"]
$push:texts = "Text 2"   →   variables.texts == ["Text 1", "Text 2"]
```

The first assignment turns the prior value into the array's first item; later assignments append.

Trigger parameters inject as variables: a parameter named `keyword` on the trigger block reads back as `{{variables.keyword}}`.

## Table

The table stores rows under typed columns. Column types are strict: Text, Number, Boolean, Array, Any.

Extraction blocks (Get Text, Attribute Value) with "Insert to table" enabled append a row at the end of the table.

```
{{table.$last.title}}
```

Extraction inserts add rows; read the newest with `$last`.

The bare key `{{table}}` (no selector after it) renders the WHOLE table as a JSON array — each row is an object keyed by column name. Use it to serialize the table into a webhook body, e.g. `"items":{{table}}`. There is no `tableData` function or namespace: an unresolved key like `{{tableData(JSON)}}` stays literal in the rendered string and breaks the webhook's `JSON.parse`. Functions are `$`-prefixed only (`templatingFunctions.js`).

Table vs variable: table columns are typed and inserts append; variables are untyped and assignment overwrites.

## Global data

`globalData` is a workflow-level JSON object stored as a JSON string on the workflow definition. Access properties with dot paths.

```
{{globalData.url}}/login
```

Dot path resolves into the workflow-level object.

## Secrets

`secrets` reads encrypted credentials stored in the extension. Access with `secrets@credentialName`. Credentials are encrypted, add-only, and managed through the extension's storage; only the `secrets` keyword can read them. See the official docs `reference/storage.md`.

```
{{secrets@githubToken}}
```

The `@` separator follows the credential name, not a variable name.

## Loop data

Inside a loop block, `loopData.<loopId>` exposes the current iteration. The loop block's id identifies the loop.

```
{{loopData.products.data.sku}}
```

Current item via `.data`, position via `.$index` (see Namespaces).

## Functions catalog

All built-in functions start with `$`; the implementations live in `src/workflowEngine/templating/templatingFunctions.js`. A nested expression inside a function call wraps in brackets: `{{$increment([variables.variableName])}}`.

| Function | Behavior | Example |
|---|---|---|
| `$date(date, dateFormat?)` | Format a date; day.js format strings, or `"relative"`, `"timestamp"` | `{{$date([variables.createdAt], 'DD/MM/YYYY')}}` |
| `$randint(min?, max?)` | Random integer in range | `{{$randint(1, 10)}}` |
| `$getLength(str)` | String length | `{{$getLength([variables.username])}}` |
| `$randData(expr)` | Random data from codes `?l ?u ?d ?f ?s ?m ?n ?a` | `{{$randData('?l?u?d')}}` |
| `$multiply(value, by)` | Multiply | `{{$multiply([variables.price], 1.1)}}` |
| `$increment(value, by)` | Add | `{{$increment([variables.counter], 1)}}` |
| `$divide` | Divide | `{{$divide([variables.total], [variables.count])}}` |
| `$subtract` | Subtract | `{{$subtract([variables.total], 5)}}` |
| `$replace(value, search, replace)` | Replace first occurrence | `{{$replace([variables.name], ' ', '_')}}` |
| `$replaceAll` | Replace all occurrences | `{{$replaceAll([variables.text], 'a', 'b')}}` |
| `$toLowerCase` | Lowercase the value | `{{$toLowerCase([variables.name])}}` |
| `$toUpperCase` | Uppercase the value | `{{$toUpperCase([variables.code])}}` |
| `$modulo(num, divisor)` | Remainder | `{{$modulo([variables.index], 2)}}` |
| `$filter(data, jsonpath)` | Filter data with a JSONPath expression | `{{$filter([variables.users], '$.name')}}` |
| `$stringify(value)` | Serialize to a JSON string | `{{$stringify([variables.obj])}}` |
| `$slice` | Slice a list | `{{$slice([variables.list], 0, 3)}}` |

Bracket the inner expression, as in `{{$increment([variables.variableName])}}`.

## JS expressions (Chromium only)

Prefix a field value with `!!` to evaluate the rest as JavaScript in a sandbox; full JS also works inside tags. Chromium browsers only — the feature depends on a sandboxed message call (`renderString.js` → `messageSandbox('blockExpression', ...)`).

```
!!The number is: {{variables.number}}
```

```
{{Date.now()}}
{{table[table.length - 1].columnName}}
{{loopData.loopId.data}}
```

`!!` for mixed text+JS; raw JS inside tags; do not use on non-Chromium browsers.

Caveat (1.30.02, runtime-verified): `!!` sandbox expressions are NOT evaluated for the new-tab `url` field — the prefix is consumed and the raw expression body is treated as the URL, failing with "is an invalid URL". Use plain `{{variables.*}}` interpolation in `url`.

## Condition builder value types

The condition builder prefixes value literals with a type:

- `string::` — string value
- `json::` — JSON value
- `number::` — numeric value
- `boolean::` — boolean value

Condition kinds:

- "Code" — a JavaScript expression, evaluated as a condition.
- "Data Exists" — checks a data path such as `variables.name` or `variables@name`.
- Element conditions — text, exists, not exists, visible, visible in screen, hidden in screen, attribute value.

```
string::active
number::42
boolean::true
json::{"a": 1}
variables.name
variables@name
```

The prefix precedes the literal; Data Exists accepts `@` as a path separator.

## Common mistakes

- **Spaces in variable names** break mustache access — `{{variables.first name}}` never resolves. Use camelCase.
- **`@` or `[]` in variable names** break mustache access — `@` is the `secrets` separator, not a variable-name character.
- **Forgetting trigger parameters are variables** — a parameter named `keyword` reads as `{{variables.keyword}}`, not `{{keyword}}`.
- **Expecting assignment to append to a table** — assignment overwrites variables; only extraction blocks with "Insert to table" append rows.
- **Unbracketed nested expressions** — `{{$increment(variables.counter)}}` fails; write `{{$increment([variables.counter])}}`.
- **JS expressions on non-Chromium browsers** — the `!!` prefix and raw JS in tags are Chromium-only.
