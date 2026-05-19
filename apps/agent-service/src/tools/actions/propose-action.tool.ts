import { tool } from 'langchain';
import { z } from 'zod';
import type { OntologyEngine } from '@daemon/ontology-engine';
import type { ActionProposer } from '@daemon/ontology-sdk';
import { isActionAllowed } from '../../permissions/action-allowlist.js';

const ProposeActionInputSchema = z.object({
  actionTypeId: z
    .string()
    .describe('The API name of the action type to propose, e.g. "transitionShipmentState"'),
  payload: z
    .record(z.unknown())
    .describe('The parameters for this action as defined in the action type schema'),
  reasoning: z
    .string()
    .describe('Brief explanation of why this action is being proposed — shown to the human approver'),
});

export function createProposeActionTool(
  engine: OntologyEngine,
  proposer: ActionProposer,
  allowlist: string[]
) {
  return tool(
    async ({ actionTypeId, payload, reasoning }: {
      actionTypeId: string;
      payload: Record<string, unknown>;
      reasoning: string;
    }) => {
      // 1. Check allowlist — agent cannot propose actions outside this list
      if (!isActionAllowed(actionTypeId, allowlist)) {
        return `Action "${actionTypeId}" is not allowed for this agent. Allowed actions: ${allowlist.join(', ')}`;
      }

      // 2. Validate action type exists
      const registry = engine.getRegistry();
      const actionType = registry.getActionType(actionTypeId);
      if (!actionType) {
        return `Unknown action type: "${actionTypeId}". Use read_schema to see available action types.`;
      }

      // 3. Validate payload
      const errors = registry.validateActionPayload(actionTypeId, payload);
      if (errors.length > 0) {
        return `Validation failed for "${actionTypeId}":\n${errors.join('\n')}\n\nPlease fix the payload and try again.`;
      }

      // 4. Create proposal — NO executeAction here (HITL enforced)
      const proposal = await proposer.propose(actionTypeId, {
        ...payload,
        _agentReasoning: reasoning,
      });

      return [
        `Action proposed successfully.`,
        `Proposal ID: ${proposal.proposalId}`,
        `Status: ${proposal.status}`,
        `Action: ${actionTypeId}`,
        `Reasoning shown to approver: "${reasoning}"`,
        ``,
        `A human operator must approve this proposal via POST /actions/${proposal.proposalId}/approve before it executes.`,
      ].join('\n');
    },
    {
      name: 'propose_action',
      description:
        'Propose a governed action on the ontology. This does NOT execute the action — it creates a proposal that requires human approval. Always include clear reasoning for the approver.',
      schema: ProposeActionInputSchema,
    }
  );
}
