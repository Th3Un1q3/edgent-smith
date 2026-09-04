# Source: https://ai.pydantic.dev/tools/

import random from pydantic_ai import Agent, RunContext, Tool instructions = """You're a dice game, you should roll the die and see if the number you get back matches the user's guess. If so, tell them they're a winner. Use the player's name in the response. """ def roll_dice() -> str: """Roll a six-sided die and return the result.""" return str(random.randint(1, 6)) def get_player_name(ctx: RunContext[str]) -> str: """Get the player's name.""" return ctx.deps agent_a = Agent( 'google:gemini-3-flash-preview', deps_type=str, tools=[roll_dice, get_player_name], # (1) instructions=instructions, ) agent_b = Agent( 'google:gemini-3-flash-preview', deps_type=str, tools=[ # (2) Tool(roll_dice, takes_ctx=False), Tool(get_player_name, takes_ctx=True), ], instructions=instructions, ) dice_result = [...] from pydantic_ai import Agent, ModelMessage, ModelResponse, TextPart from pydantic_ai.models.function import AgentInfo, FunctionModel agent = Agent() @agent.tool_plain(docstring_format='google', require_parameter_descriptions=True) def foobar(a: int, b: str, c: dict[str, list[float]]) -> str: """Get me foobar. Args: a: apple pie b: banana cake c: carrot smoothie """ return f'{a} {b} {c}' def print_schema(messages: list[ModelMessage], info: AgentInfo) -> ModelResponse: tool = info.function_tools print(tool.description) #> Get me foobar. print(tool.parameters_json_schema) """ { 'additionalProperties': False, 'properties': { 'a': {'description': 'apple pie', 'type': 'integer'}, 'b': {'description': 'banana cake', 'type': 'string'}, 'c': { 'additionalProperties': {'items': {'type': 'number'}, [...] single\_parameter\_tool.py

```
from pydantic import BaseModel from pydantic_ai import Agent from pydantic_ai.models.test import TestModel agent = Agent() class Foobar(BaseModel): """This is a Foobar""" x: int y: str z: float = 3.14 @agent.tool_plain def foobar(f: Foobar) -> str: return str(f) test_model = TestModel() result = agent.run_sync('hello', model=test_model) print(result.output) #> {"foobar":"x=0 y='a' z=3.14"} print(test_model.last_model_request_parameters.function_tools) """ [ ToolDefinition( name='foobar', parameters_json_schema={ 'properties': { 'x': {'type': 'integer'}, 'y': {'type': 'string'}, 'z': {'default': 3.14, 'type': 'number'}, }, 'required': ['x', 'y'], 'title': 'Foobar', 'type': 'object', }, description='This is a Foobar', toolset_id='', ) ] """ 
```

---

# Source: https://ai.pydantic.dev/agents/

Skip to content

/  Docs Pydantic Docs

Agents are Pydantic AI’s primary interface for interacting with LLMs.

In some use cases a single Agent will control an entire application or component, but multiple agents can also interact to embody more complex workflows.

The `Agent` class has full API documentation, but conceptually you can think of an agent as a container for: [...] (This example is complete, it can be run “as is”)

### Iterating Over an Agent’s Graph

Under the hood, each `Agent` in Pydantic AI uses pydantic-graph to manage its execution flow. pydantic-graph is a generic, type-centric library for building and running finite state machines in Python. It doesn’t actually depend on Pydantic AI — you can use it standalone for workflows that have nothing to do with GenAI — but Pydantic AI makes use of it to orchestrate the handling of model requests and model responses in an agent’s run. [...] from pydantic_ai import Agent, ModelRequest, capture_run_messages from pydantic_ai.messages import ( ModelMessage, ModelResponse, ToolCallPart, ToolReturnPart, ) from pydantic_ai.models.function import AgentInfo, FunctionModel def call_tools(_messages: list[ModelMessage], _info: AgentInfo) -> ModelResponse: return ModelResponse( parts=[ ToolCallPart(tool_name='get_volume', args={'size': 6}, tool_call_id='volume_call'), ToolCallPart(tool_name='get_mass', args={'size': 6}, tool_call_id='mass_call'), ] ) agent = Agent(FunctionModel(function=call_tools)) @agent.tool_plain(sequential=True) def get_volume(size: int) -> int: return size3 @agent.tool_plain(sequential=True) def get_mass(size: int) -> int: raise RuntimeError('missing density') with capture_run_messages() as messages: try:

---

