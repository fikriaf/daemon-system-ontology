import type {
  OntologySchema,
  ObjectTypeDefinition,
  LinkTypeDefinition,
  ActionTypeDefinition,
} from '@daemon/ontology-language';

export class SchemaRegistry {
  private objectTypes: Map<string, ObjectTypeDefinition>;
  private linkTypes: Map<string, LinkTypeDefinition>;
  private actionTypes: Map<string, ActionTypeDefinition>;

  constructor(schema: OntologySchema) {
    this.objectTypes = new Map(schema.objectTypes.map(o => [o.apiName, o]));
    this.linkTypes = new Map(schema.linkTypes.map(l => [l.apiName, l]));
    this.actionTypes = new Map(schema.actionTypes.map(a => [a.apiName, a]));
  }

  reload(schema: OntologySchema): void {
    this.objectTypes = new Map(schema.objectTypes.map(o => [o.apiName, o]));
    this.linkTypes = new Map(schema.linkTypes.map(l => [l.apiName, l]));
    this.actionTypes = new Map(schema.actionTypes.map(a => [a.apiName, a]));
  }

  toSchema(): OntologySchema {
    return {
      objectTypes: Array.from(this.objectTypes.values()),
      linkTypes: Array.from(this.linkTypes.values()),
      actionTypes: Array.from(this.actionTypes.values()),
    };
  }

  getObjectType(apiName: string): ObjectTypeDefinition | undefined {
    return this.objectTypes.get(apiName);
  }

  getLinkType(apiName: string): LinkTypeDefinition | undefined {
    return this.linkTypes.get(apiName);
  }

  getActionType(apiName: string): ActionTypeDefinition | undefined {
    return this.actionTypes.get(apiName);
  }

  getObjectTypeNames(): string[] {
    return Array.from(this.objectTypes.keys());
  }

  getActionTypeNames(): string[] {
    return Array.from(this.actionTypes.keys());
  }

  validateActionPayload(actionTypeId: string, payload: Record<string, unknown>): string[] {
    const actionType = this.actionTypes.get(actionTypeId);
    if (!actionType) {
      throw new Error(`Unknown action type: "${actionTypeId}"`);
    }

    const errors: string[] = [];

    for (const param of actionType.parameters) {
      if (param.required && !(param.name in payload)) {
        errors.push(`Missing required parameter: "${param.name}"`);
        continue;
      }

      if (param.name in payload && param.type === 'enum') {
        // TypeScript narrows param to EnumActionParameter which has `values`
        const value = payload[param.name];
        if (!param.values.includes(String(value))) {
          errors.push(
            `Parameter "${param.name}" must be one of: ${param.values.join(', ')}. Got: "${value}"`
          );
        }
      }
    }

    return errors;
  }
}
