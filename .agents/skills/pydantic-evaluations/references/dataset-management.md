# Reference: Dataset Management

## Dataset Construction

| API | Purpose | Notes |
|---|---|---|
| `Dataset(...)` | Create a dataset in code | Best for fast iteration |
| `dataset.add_case(...)` | Add cases dynamically | Useful during bootstrap or discovery |
| `dataset.add_evaluator(...)` | Add dataset-level evaluators | Applies to all cases |
| `Case(...)` | Define one scenario | `name` is strongly recommended |

## Loading And Saving

| API | Purpose | Notes |
|---|---|---|
| `Dataset.from_file(path, ...)` | Load YAML or JSON datasets | Format inferred from extension unless `fmt` is provided |
| `Dataset.from_text(text, fmt=...)` | Load from raw YAML or JSON text | Useful for generated or embedded content |
| `Dataset.from_dict(data)` | Load from Python dictionaries | Useful when dataset content is already structured in code |
| `dataset.to_file(path, ...)` | Save dataset to YAML or JSON | Can also generate a schema file alongside the dataset |

## Schema And Custom Types

| API or option | Purpose | Notes |
|---|---|---|
| `Dataset.model_json_schema_with_evaluators(...)` | Generate editor-friendly schema | Include custom evaluator types when needed |
| `custom_evaluator_types=[...]` | Register custom case evaluators for file loading | Required when loading datasets containing custom evaluators |
| `custom_report_evaluator_types=[...]` | Register custom report evaluators for file loading or schema generation | Required for custom report evaluators in file-backed datasets |
| `schema_path=...` in `to_file(...)` | Control schema path emission | Can be omitted with `schema_path=None` |

## Generation

| API | Purpose | Notes |
|---|---|---|
| `generate_dataset(...)` | Generate a dataset with an LLM | Useful for bootstrapping, not a substitute for human review |

## Type-Safe Dataset Shapes

| Shape choice | Best for |
|---|---|
| simple built-ins | quick experiments |
| `TypedDict` | lightweight structured I/O |
| Pydantic models | richer schemas, validation, and editor support |

## Common Storage Patterns

| Pattern | When to use |
|---|---|
| dataset in code | early iteration, local experimentation |
| YAML dataset with schema | collaborative editing and code review |
| separate smoke and regression files | short gating suite plus durable bug coverage |
| generated dataset plus manual cleanup | fast coverage seeding |
