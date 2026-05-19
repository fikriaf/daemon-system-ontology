import { tool } from 'langchain';
import { z } from 'zod';
import type { OntologyEngine } from '@daemon/ontology-engine';

const GetObjectInputSchema = z.object({
  id: z.string().describe('The UUID of the object to retrieve'),
});

export function createGetObjectTool(engine: OntologyEngine) {
  return tool(
    async ({ id }: { id: string }) => {
      const object = await engine.objects.getObject(id);
      if (!object) {
        return `Object with id "${id}" not found.`;
      }
      return JSON.stringify(object, null, 2);
    },
    {
      name: 'get_object',
      description:
        'Get a single ontology object by its UUID. Use after read_objects to get full details.',
      schema: GetObjectInputSchema,
    }
  );
}
