export type RequireFirstToolFrontMatterConfig = {
  requiredFirstTool: string;
  applyToAgents: string[];
  message?: string;
}

export type ParsedCopilotInstruction = {
  frontMatter: {
    description?: string;
    applyTo?: string;
    requireFirstTool?: RequireFirstToolFrontMatterConfig;
    [key: string]: any;
  };
  content: string;
  path: string;
}
