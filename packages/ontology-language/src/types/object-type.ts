import { z } from 'zod';

const PropertyBaseSchema = z.object({
  name: z.string().min(1),
  required: z.boolean().default(false),
});

const StringPropertySchema = PropertyBaseSchema.extend({
  type: z.literal('string'),
});

const NumberPropertySchema = PropertyBaseSchema.extend({
  type: z.literal('number'),
});

const BooleanPropertySchema = PropertyBaseSchema.extend({
  type: z.literal('boolean'),
});

const DatePropertySchema = PropertyBaseSchema.extend({
  type: z.literal('date'),
});

const TimestampPropertySchema = PropertyBaseSchema.extend({
  type: z.literal('timestamp'),
});

const EnumPropertySchema = PropertyBaseSchema.extend({
  type: z.literal('enum'),
  values: z.array(z.string()).min(1),
});

const PropertySchema = z.discriminatedUnion('type', [
  StringPropertySchema,
  NumberPropertySchema,
  BooleanPropertySchema,
  DatePropertySchema,
  TimestampPropertySchema,
  EnumPropertySchema,
]);

export type Property = z.infer<typeof PropertySchema>;

export const ObjectTypeDefinitionSchema = z.object({
  apiName: z.string().min(1),
  displayName: z.string().min(1),
  primaryKey: z.string().min(1),
  titleProperty: z.string().min(1),
  properties: z.array(PropertySchema).min(1),
  description: z.string().optional(),
});

export const ObjectTypeSchema = z.object({
  objectType: ObjectTypeDefinitionSchema,
});

export type ObjectTypeDefinition = z.infer<typeof ObjectTypeDefinitionSchema>;
export type ObjectType = z.infer<typeof ObjectTypeSchema>;
