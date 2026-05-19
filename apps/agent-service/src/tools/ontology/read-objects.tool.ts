import { tool } from 'langchain';
import { z } from 'zod';
import type { OntologyClient } from '@daemon/ontology-sdk';

const ReadObjectsInputSchema = z.object({
  objectType: z.string().describe('The API name of the object type to query, e.g. "Shipment"'),
  filters: z
    .record(z.string())
    .optional()
    .describe('Key-value filters to apply, e.g. { "status": "InTransit" }'),
  limit: z.number().optional().default(20).describe('Maximum number of results to return'),
});

export function createReadObjectsTool(client: OntologyClient) {
  return tool(
    async ({ objectType, filters = {}, limit = 20 }: {
      objectType: string;
      filters?: Record<string, string>;
      limit?: number;
    }) => {
      const results = await client
        .objects(objectType)
        .filter(filters)
        .limit(limit)
        .get();

      if (results.length === 0) {
        return `No ${objectType} objects found matching filters: ${JSON.stringify(filters)}`;
      }

      return JSON.stringify(results, null, 2);
    },
    {
      name: 'read_objects',
      description:
        'Query ontology objects by type with optional filters. Use this to observe the current state of shipments, customers, exceptions, etc.',
      schema: ReadObjectsInputSchema,
    }
  );
}
