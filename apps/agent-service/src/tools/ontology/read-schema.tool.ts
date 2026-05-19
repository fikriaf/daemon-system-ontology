import { tool } from 'langchain';
import { z } from 'zod';
import type { OntologyEngine } from '@daemon/ontology-engine';

const ReadSchemaInputSchema = z.object({
  include: z
    .enum(['objectTypes', 'actionTypes', 'all'])
    .default('all')
    .describe('Which parts of the schema to return'),
});

export function createReadSchemaTool(engine: OntologyEngine) {
  return tool(
    async ({ include }: { include: 'objectTypes' | 'actionTypes' | 'all' }) => {
      const registry = engine.getRegistry();
      const output: Record<string, string[]> = {};

      if (include === 'objectTypes' || include === 'all') {
        output.objectTypes = registry.getObjectTypeNames();
      }

      if (include === 'actionTypes' || include === 'all') {
        output.actionTypes = registry.getActionTypeNames();
      }

      return JSON.stringify(output, null, 2);
    },
    {
      name: 'read_schema',
      description:
        'Read the ontology schema — list available object types and action types. Use at the start of a session to understand what is available.',
      schema: ReadSchemaInputSchema,
    }
  );
}
