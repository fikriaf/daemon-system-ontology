import { z } from 'zod';
import { ObjectTypeDefinitionSchema } from './object-type.js';
import { LinkTypeDefinitionSchema } from './link-type.js';
import { ActionTypeDefinitionSchema } from './action-type.js';

export const OntologySchemaSchema = z.object({
  objectTypes: z.array(ObjectTypeDefinitionSchema),
  linkTypes: z.array(LinkTypeDefinitionSchema),
  actionTypes: z.array(ActionTypeDefinitionSchema),
});

export type OntologySchema = z.infer<typeof OntologySchemaSchema>;
