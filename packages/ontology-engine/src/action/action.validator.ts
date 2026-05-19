import type { SchemaRegistry } from '../registry/schema.registry.js';

export interface ExecutionContext {
  userId: string;
  legalEntityId: string;
  roleId: string;
}

export class ActionValidator {
  constructor(private registry: SchemaRegistry) {}

  validate(
    actionTypeId: string,
    payload: Record<string, unknown>,
    _context: ExecutionContext
  ): void {
    const errors = this.registry.validateActionPayload(actionTypeId, payload);
    if (errors.length > 0) {
      throw new Error(`Validation failed for action "${actionTypeId}":\n${errors.join('\n')}`);
    }
  }
}
