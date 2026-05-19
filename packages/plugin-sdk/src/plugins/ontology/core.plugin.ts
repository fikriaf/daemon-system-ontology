import { tool } from 'langchain';
import { z } from 'zod';
import type { DaemonPlugin, PluginContext } from '../../types/plugin.types.js';

function isActionAllowed(actionTypeId: string, allowlist: string[]): boolean {
  return allowlist.includes(actionTypeId);
}

/**
 * ontology/core — built-in plugin yang menyediakan tools dasar:
 * read_objects, get_object, read_schema, propose_action
 */
export const ontologyCorePlugin: DaemonPlugin = {
  id: 'ontology/core',
  name: 'Ontology Core',
  version: '1.0.0',
  category: 'ontology',
  description: 'Core ontology tools: read objects, get schema, propose actions',

  tools: [
    {
      id: 'read_objects',
      name: 'Read Objects',
      description: 'Query ontology objects by type with optional filters',
      build(ctx: PluginContext) {
        return tool(
          async ({ objectType, filters = {}, limit = 20 }: {
            objectType: string;
            filters?: Record<string, string>;
            limit?: number;
          }) => {
            const results = await ctx.client
              .objects(objectType)
              .filter(filters)
              .limit(limit)
              .get();

            if (results.length === 0) {
              return `No ${objectType} objects found matching: ${JSON.stringify(filters)}`;
            }
            return JSON.stringify(results, null, 2);
          },
          {
            name: 'read_objects',
            description: 'Query ontology objects by type with optional filters. Use to observe current state of shipments, customers, exceptions, etc.',
            schema: z.object({
              objectType: z.string().describe('Object type API name, e.g. "Shipment"'),
              filters: z.record(z.string()).optional().describe('Key-value filters'),
              limit: z.number().optional().default(20),
            }),
          }
        );
      },
    },

    {
      id: 'get_object',
      name: 'Get Object',
      description: 'Get a single object by ID',
      build(ctx: PluginContext) {
        return tool(
          async ({ id }: { id: string }) => {
            const obj = await ctx.engine.objects.getObject(id);
            if (!obj) return `Object not found: ${id}`;
            return JSON.stringify(obj, null, 2);
          },
          {
            name: 'get_object',
            description: 'Get details of a single object by its UUID',
            schema: z.object({
              id: z.string().describe('UUID of the object'),
            }),
          }
        );
      },
    },

    {
      id: 'read_schema',
      name: 'Read Schema',
      description: 'Read the ontology schema — object types and action types',
      build(ctx: PluginContext) {
        return tool(
          async () => {
            const registry = ctx.engine.getRegistry();
            const schema = registry.toSchema();
            return JSON.stringify({
              objectTypes: schema.objectTypes.map(o => ({
                apiName: o.apiName,
                displayName: o.displayName,
                properties: o.properties,
              })),
              actionTypes: schema.actionTypes.map(a => ({
                apiName: a.apiName,
                displayName: a.displayName,
                parameters: a.parameters,
                requiresApproval: a.requiresApproval,
              })),
            }, null, 2);
          },
          {
            name: 'read_schema',
            description: 'Read the ontology schema to understand available object types, their properties, and available action types',
            schema: z.object({}),
          }
        );
      },
    },

    {
      id: 'propose_action',
      name: 'Propose Action',
      description: 'Propose a governed action (requires human approval)',
      build(ctx: PluginContext) {
        const allowlist = (ctx.config.actionAllowlist as string[] | undefined) ?? [];

        return tool(
          async ({ actionTypeId, payload, reasoning }: {
            actionTypeId: string;
            payload: Record<string, unknown>;
            reasoning: string;
          }) => {
            if (allowlist.length > 0 && !isActionAllowed(actionTypeId, allowlist)) {
              return `Action "${actionTypeId}" not in allowlist. Allowed: ${allowlist.join(', ')}`;
            }

            const registry = ctx.engine.getRegistry();
            const actionType = registry.getActionType(actionTypeId);
            if (!actionType) {
              return `Unknown action type: "${actionTypeId}". Use read_schema to see available types.`;
            }

            const errors = registry.validateActionPayload(actionTypeId, payload);
            if (errors.length > 0) {
              return `Validation failed:\n${errors.join('\n')}`;
            }

            const proposal = await ctx.proposer.propose(actionTypeId, {
              ...payload,
              _agentReasoning: reasoning,
            });

            return [
              `Proposed: ${actionTypeId}`,
              `Proposal ID: ${proposal.proposalId}`,
              `Status: ${proposal.status}`,
              `Reasoning: "${reasoning}"`,
              `Requires human approval via POST /actions/${proposal.proposalId}/approve`,
            ].join('\n');
          },
          {
            name: 'propose_action',
            description: 'Propose a governed action. Does NOT execute — creates proposal for human approval. Always include clear reasoning.',
            schema: z.object({
              actionTypeId: z.string(),
              payload: z.record(z.unknown()),
              reasoning: z.string().describe('Why this action is being proposed — shown to approver'),
            }),
          }
        );
      },
    },
  ],

  systemPromptExtension: `
## Ontology Tools Available
- read_schema: Learn what object types and action types exist
- read_objects: Query current state of any object type
- get_object: Get details of a single object
- propose_action: Propose a governed action (requires human approval — NEVER execute directly)
`.trim(),
};
