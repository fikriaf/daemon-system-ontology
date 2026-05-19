import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  parseObjectTypeContent,
  parseLinkTypeContent,
  parseActionTypeContent,
  validateOntologySchema,
} from '@daemon/ontology-language';
import type { OntologySchema } from '@daemon/ontology-language';

const UploadBodySchema = z.object({
  // Array of YAML strings — one per definition file
  files: z.array(z.string().min(1)).min(1),
});

function parseYamlToSchema(yamlStrings: string[]): { schema: OntologySchema; errors: string[] } {
  const schema: OntologySchema = { objectTypes: [], linkTypes: [], actionTypes: [] };
  const errors: string[] = [];

  for (let i = 0; i < yamlStrings.length; i++) {
    const content = yamlStrings[i];
    try {
      if (content.includes('objectType:')) {
        schema.objectTypes.push(parseObjectTypeContent(content));
      } else if (content.includes('linkType:')) {
        schema.linkTypes.push(parseLinkTypeContent(content));
      } else if (content.includes('actionType:')) {
        schema.actionTypes.push(parseActionTypeContent(content));
      } else {
        errors.push(`File[${i}]: unknown schema type — must contain objectType, linkType, or actionType`);
      }
    } catch (err: unknown) {
      errors.push(`File[${i}]: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { schema, errors };
}

export const schemaUploadRoute: FastifyPluginAsync = async (fastify) => {
  // POST /schema/upload — upload YAML definitions, hot-reload engine
  fastify.post('/upload', {
    preHandler: fastify.requireRole('admin'),
  }, async (request, reply) => {
    const body = UploadBodySchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: 'Invalid request body', details: body.error.errors });
    }

    const { schema, errors: parseErrors } = parseYamlToSchema(body.data.files);
    if (parseErrors.length > 0) {
      return reply.code(422).send({ error: 'Schema parse errors', details: parseErrors });
    }

    const validationErrors = validateOntologySchema(schema);
    if (validationErrors.length > 0) {
      return reply.code(422).send({ error: 'Schema validation errors', details: validationErrors });
    }

    try {
      await fastify.engine.reloadSchema(schema, request.userId);
    } catch (err: unknown) {
      return reply.code(422).send({ error: err instanceof Error ? err.message : String(err) });
    }

    return reply.send({
      status: 'reloaded',
      objectTypes: schema.objectTypes.length,
      linkTypes: schema.linkTypes.length,
      actionTypes: schema.actionTypes.length,
      uploadedBy: request.userId,
      uploadedAt: new Date().toISOString(),
    });
  });
};
