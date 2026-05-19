import { parseYamlFile, parseYamlContent } from './yaml.parser.js';
import { ObjectTypeSchema, type ObjectTypeDefinition } from '../types/object-type.js';
import { LinkTypeSchema, type LinkTypeDefinition } from '../types/link-type.js';
import { ActionTypeSchema, type ActionTypeDefinition } from '../types/action-type.js';
import { readdir } from 'fs/promises';
import { join, extname } from 'path';
import type { OntologySchema } from '../types/ontology-schema.js';

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

export function parseObjectTypeContent(content: string): ObjectTypeDefinition {
  const raw = parseYamlContent(content);
  const result = ObjectTypeSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Invalid object type schema:\n${result.error.toString()}`);
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

export function parseLinkTypeContent(content: string): LinkTypeDefinition {
  const raw = parseYamlContent(content);
  const result = LinkTypeSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Invalid link type schema:\n${result.error.toString()}`);
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

export function parseActionTypeContent(content: string): ActionTypeDefinition {
  const raw = parseYamlContent(content);
  const result = ActionTypeSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Invalid action type schema:\n${result.error.toString()}`);
  }
  return result.data.actionType;
}

export async function loadOntologyFromDirectory(dirPath: string): Promise<OntologySchema> {
  const files = await readdir(dirPath);
  const yamlFiles = files.filter(f => extname(f) === '.yaml' || extname(f) === '.yml');

  const objectTypes: OntologySchema['objectTypes'] = [];
  const linkTypes: OntologySchema['linkTypes'] = [];
  const actionTypes: OntologySchema['actionTypes'] = [];

  for (const file of yamlFiles) {
    const filePath = join(dirPath, file);
    if (file.endsWith('.object-type.yaml') || file.endsWith('.object-type.yml')) {
      objectTypes.push(await parseObjectTypeFile(filePath));
    } else if (file.endsWith('.link-type.yaml') || file.endsWith('.link-type.yml')) {
      linkTypes.push(await parseLinkTypeFile(filePath));
    } else if (file.endsWith('.action-type.yaml') || file.endsWith('.action-type.yml')) {
      actionTypes.push(await parseActionTypeFile(filePath));
    }
  }

  return { objectTypes, linkTypes, actionTypes };
}
