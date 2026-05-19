import { z } from 'zod';

const CardinalitySchema = z.enum([
  'ONE_TO_ONE',
  'ONE_TO_MANY',
  'MANY_TO_ONE',
  'MANY_TO_MANY',
]);

export const LinkTypeDefinitionSchema = z.object({
  apiName: z.string().min(1),
  displayName: z.string().min(1),
  fromObjectType: z.string().min(1),
  toObjectType: z.string().min(1),
  cardinality: CardinalitySchema,
  description: z.string().optional(),
});

export const LinkTypeSchema = z.object({
  linkType: LinkTypeDefinitionSchema,
});

export type LinkTypeDefinition = z.infer<typeof LinkTypeDefinitionSchema>;
export type LinkType = z.infer<typeof LinkTypeSchema>;
