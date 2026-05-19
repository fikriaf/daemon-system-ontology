import type { OntologySchema } from '../types/ontology-schema.js';

export function validateOntologySchema(schema: OntologySchema): string[] {
  const errors: string[] = [];

  // Cek duplicate apiName pada object types
  const objectTypeNames = schema.objectTypes.map(o => o.apiName);
  const duplicateObjects = objectTypeNames.filter(
    (name, idx) => objectTypeNames.indexOf(name) !== idx
  );
  for (const dup of duplicateObjects) {
    errors.push(`Duplicate apiName in objectTypes: "${dup}"`);
  }

  // Cek duplicate apiName pada link types
  const linkTypeNames = schema.linkTypes.map(l => l.apiName);
  const duplicateLinks = linkTypeNames.filter(
    (name, idx) => linkTypeNames.indexOf(name) !== idx
  );
  for (const dup of duplicateLinks) {
    errors.push(`Duplicate apiName in linkTypes: "${dup}"`);
  }

  // Cek duplicate apiName pada action types
  const actionTypeNames = schema.actionTypes.map(a => a.apiName);
  const duplicateActions = actionTypeNames.filter(
    (name, idx) => actionTypeNames.indexOf(name) !== idx
  );
  for (const dup of duplicateActions) {
    errors.push(`Duplicate apiName in actionTypes: "${dup}"`);
  }

  // Cek link types reference object types yang ada
  const knownObjectTypes = new Set(objectTypeNames);
  for (const link of schema.linkTypes) {
    if (!knownObjectTypes.has(link.fromObjectType)) {
      errors.push(
        `LinkType "${link.apiName}" references unknown fromObjectType: "${link.fromObjectType}"`
      );
    }
    if (!knownObjectTypes.has(link.toObjectType)) {
      errors.push(
        `LinkType "${link.apiName}" references unknown toObjectType: "${link.toObjectType}"`
      );
    }
  }

  // Cek action types reference object types yang ada
  for (const action of schema.actionTypes) {
    if (!knownObjectTypes.has(action.targetObjectType)) {
      errors.push(
        `ActionType "${action.apiName}" references unknown targetObjectType: "${action.targetObjectType}"`
      );
    }
  }

  return errors;
}
