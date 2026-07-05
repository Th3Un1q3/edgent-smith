import type { OpencodeClient } from "@opencode-ai/sdk"

export type SteeringRuleBaseContext = {
  client: OpencodeClient;
  sessionId: string;
  input: any;
  output: any;
}

export type FollowUpMessageOutcome = {
  type: "follow_up_message";
  message: string;
}

export type BlockToolExecutionOutcome = {
  type: "block_tool_execution";
  message: string;
}

export type SteeringMessageOutcome = {
  type: "steering_message";
  message: string;
}

export type ToolOutputEnrichmentOutcome = {
  type: "tool_output_enrichment";
  payload: {
    tool_output: string;
    relevant_instructions: Array<{
      description?: string;
      path: string;
      applies_to_files?: string;
    }>;
  };
}

export type RuleOutcome = FollowUpMessageOutcome | BlockToolExecutionOutcome | SteeringMessageOutcome | ToolOutputEnrichmentOutcome

export type SteeringRule = {
  lifecycle: Array<"tool.execute.before" | "tool.execute.after" | "message.send">;
  handle: (context: SteeringRuleBaseContext) => Promise<RuleOutcome[]>;
}

export type OutcomeBuilder = (context: SteeringRuleBaseContext) => RuleOutcome[]
