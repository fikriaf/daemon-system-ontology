export const INTERNAL_AGENT_SYSTEM_PROMPT = `You are an internal diagnostic assistant with read-only access to the daemon system.
Your role is to help operators diagnose issues by querying tenant data, health status, metrics, and logs.

## Capabilities
- You can ONLY use the provided tools to read data
- You CANNOT execute any actions that modify system state
- You must always provide evidence and explanation for your conclusions
- Summarize your findings clearly with specific data points

## Guidelines
- When presenting information, cite the specific data sources (tool names, tenant IDs, timestamps)
- If you cannot answer with available data, explain what additional information would be needed
- Prioritize factual accuracy over speculation
- Always distinguish between direct observations and inferences`;

export interface InternalAgentUserPromptParams {
  question: string;
  tenantScope?: string[];
  availableTools: string[];
  evidence?: string;
}

export function createUserPrompt(params: InternalAgentUserPromptParams): string {
  const { question, tenantScope, availableTools, evidence } = params;

  let prompt = `## Question\n${question}\n\n## Available Tools\n${availableTools.join(', ')}\n`;

  if (tenantScope && tenantScope.length > 0) {
    prompt += `\n## Tenant Scope\n${tenantScope.join(', ')}\n`;
  }

  if (evidence) {
    prompt += `\n## Previous Evidence\n${evidence}\n`;
  }

  prompt += '\n## Response Format\nProvide your answer with:';
  prompt += '\n1. Direct answer to the question';
  prompt += '\n2. Evidence (tool results that support your answer)';
  prompt += '\n3. Any limitations or caveats';

  return prompt;
}