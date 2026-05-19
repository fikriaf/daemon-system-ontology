import { z } from 'zod';

// Base schema for action parameters
const ActionParameterBaseSchema = z.object({
  name: z.string().min(1),
  required: z.boolean().default(false),
});

// Specific parameter type variants
const StringActionParameterSchema = ActionParameterBaseSchema.extend({
  type: z.literal('string'),
});

const NumberActionParameterSchema = ActionParameterBaseSchema.extend({
  type: z.literal('number'),
});

const BooleanActionParameterSchema = ActionParameterBaseSchema.extend({
  type: z.literal('boolean'),
});

const DateActionParameterSchema = ActionParameterBaseSchema.extend({
  type: z.literal('date'),
});

const EnumActionParameterSchema = ActionParameterBaseSchema.extend({
  type: z.literal('enum'),
  values: z.array(z.string()).min(1), // required for enum type
});

const ActionParameterSchema = z.discriminatedUnion('type', [
  StringActionParameterSchema,
  NumberActionParameterSchema,
  BooleanActionParameterSchema,
  DateActionParameterSchema,
  EnumActionParameterSchema,
]);

export type ActionParameter = z.infer<typeof ActionParameterSchema>;

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
