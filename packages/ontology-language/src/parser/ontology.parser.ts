import { parseYamlFile } from './yaml.parser.js';
import { ObjectTypeSchema, type ObjectTypeDefinition } from '../types/object-type.js';
import { LinkTypeSchema, type LinkTypeDefinition } from '../types/link-type.js';
import { ActionTypeSchema, type ActionTypeDefinition } from '../types/action-type.js';

export async function parseObjectTypeFile(filePath: string): Promise<ObjectTypeDefinition> {
  const raw = await parseYamlFile(filePath);
  const result = ObjectTypeSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `Invalid object type schema in ${filePath}:\n${result.error.toString()}`
    );
  }
  return result.data.objectType;
}

export async function parseLinkTypeFile(filePath: string): Promise<LinkTypeDefinition> {
  const raw = await parseYamlFile(filePath);
  const result = LinkTypeSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `Invalid link type schema in ${filePath}:\n${result.error.toString()}`
    );
  }
  return result.data.linkType;
}

export async function parseActionTypeFile(filePath: string): Promise<ActionTypeDefinition> {
  const raw = await parseYamlFile(filePath);
  const result = ActionTypeSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `Invalid action type schema in ${filePath}:\n${result.error.toString()}`
    );
  }
  return result.data.actionType;
}
