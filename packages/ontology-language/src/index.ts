// Types
export type { ObjectType, ObjectTypeDefinition, Property } from './types/object-type.js';
export type { LinkType, LinkTypeDefinition } from './types/link-type.js';
export type { ActionType, ActionTypeDefinition } from './types/action-type.js';
export type { OntologySchema } from './types/ontology-schema.js';

// Schemas (Zod — untuk re-use di package lain)
export { ObjectTypeSchema } from './types/object-type.js';
export { LinkTypeSchema } from './types/link-type.js';
export { ActionTypeSchema } from './types/action-type.js';
export { OntologySchemaSchema } from './types/ontology-schema.js';

// Parser
export {
  parseObjectTypeFile,
  parseObjectTypeContent,
  parseLinkTypeFile,
  parseLinkTypeContent,
  parseActionTypeFile,
  parseActionTypeContent,
  loadOntologyFromDirectory,
} from './parser/ontology.parser.js';

// Validator
export { validateOntologySchema } from './validator/schema.validator.js';
