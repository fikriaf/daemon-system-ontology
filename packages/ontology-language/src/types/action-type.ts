import { z } from 'zod';

const ActionParameterSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['string', 'number', 'boolean', 'date', 'enum']),
  required: z.boolean().default(false),
  values: z.array(z.string()).optional(), // untuk type: enum
});

export const ActionTypeDefinitionSchema = z.object({
  apiName: z.string().min(1),
  displayName: z.string().min(1),
  targetObjectType: z.string().min(1),
  parameters: z.array(ActionParameterSchema),
  requiresApproval: z.boolean().default(true),
  description: z.string().optional(),
});

export const ActionTypeSchema = z.object({
  actionType: ActionTypeDefinitionSchema,
});

export type ActionTypeDefinition = z.infer<typeof ActionTypeDefinitionSchema>;
export type ActionType = z.infer<typeof ActionTypeSchema>;
