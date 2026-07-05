import { describe, it, expectTypeOf } from 'vitest'
import type { ParsedCopilotInstruction } from '../../plugins/types/instructions.ts'
import type {
  SteeringRuleBaseContext,
  FollowUpMessageOutcome,
  BlockToolExecutionOutcome,
  SteeringMessageOutcome,
  ToolOutputEnrichmentOutcome,
  RuleOutcome,
  SteeringRule,
  OutcomeBuilder,
} from '../../plugins/types/steering.ts'

describe('plugin type exports', () => {
  it('ParsedCopilotInstruction has the expected shape', () => {
    expectTypeOf<ParsedCopilotInstruction>().toHaveProperty('frontMatter')
    expectTypeOf<ParsedCopilotInstruction>().toHaveProperty('content')
    expectTypeOf<ParsedCopilotInstruction>().toHaveProperty('path')
  })

  it('SteeringRuleBaseContext has the expected shape', () => {
    expectTypeOf<SteeringRuleBaseContext>().toHaveProperty('client')
    expectTypeOf<SteeringRuleBaseContext>().toHaveProperty('sessionId')
    expectTypeOf<SteeringRuleBaseContext>().toHaveProperty('input')
    expectTypeOf<SteeringRuleBaseContext>().toHaveProperty('output')
  })

  it('outcome types are distinct literals', () => {
    expectTypeOf<FollowUpMessageOutcome>().toHaveProperty('type').toEqualTypeOf<'follow_up_message'>()
    expectTypeOf<BlockToolExecutionOutcome>().toHaveProperty('type').toEqualTypeOf<'block_tool_execution'>()
    expectTypeOf<SteeringMessageOutcome>().toHaveProperty('type').toEqualTypeOf<'steering_message'>()
    expectTypeOf<ToolOutputEnrichmentOutcome>().toHaveProperty('type').toEqualTypeOf<'tool_output_enrichment'>()
  })

  it('RuleOutcome is the union of outcome types', () => {
    expectTypeOf<FollowUpMessageOutcome>().toMatchTypeOf<RuleOutcome>()
    expectTypeOf<BlockToolExecutionOutcome>().toMatchTypeOf<RuleOutcome>()
    expectTypeOf<SteeringMessageOutcome>().toMatchTypeOf<RuleOutcome>()
    expectTypeOf<ToolOutputEnrichmentOutcome>().toMatchTypeOf<RuleOutcome>()
  })

  it('SteeringRule has lifecycle and handle properties', () => {
    expectTypeOf<SteeringRule>().toHaveProperty('lifecycle')
    expectTypeOf<SteeringRule>().toHaveProperty('handle')
  })

  it('OutcomeBuilder is a function from context to rule outcomes', () => {
    expectTypeOf<OutcomeBuilder>().toBeFunction()
    expectTypeOf<OutcomeBuilder>().parameter(0).toEqualTypeOf<SteeringRuleBaseContext>()
    expectTypeOf<OutcomeBuilder>().returns.toEqualTypeOf<RuleOutcome[]>()
  })
})
