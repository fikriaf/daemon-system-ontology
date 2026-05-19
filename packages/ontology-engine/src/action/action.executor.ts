import type { SchemaRegistry } from '../registry/schema.registry.js';
import type { ObjectRepository } from '../object/object.repository.js';
import { ActionValidator, type ExecutionContext } from './action.validator.js';
import type { ActionAuditService, AuditRecord } from './action.audit.js';
import type { EventPublisher } from '../events/event.publisher.js';

export interface ActionResult {
  actionTypeId: string;
  status: 'executed';
  auditId: string;
  executedAt: Date;
}

export class ActionExecutor {
  private validator: ActionValidator;

  constructor(
    private registry: SchemaRegistry,
    private objectRepo: ObjectRepository,
    private audit: ActionAuditService,
    private events: EventPublisher
  ) {
    this.validator = new ActionValidator(registry);
  }

  async executeAction(
    actionTypeId: string,
    payload: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<ActionResult> {
    // 1. Validate — throws if invalid
    this.validator.validate(actionTypeId, payload, context);

    // 2. Resolve target object id from payload
    const objectId = await this.applyMutation(actionTypeId, payload);

    // 3. Record audit
    const auditRecord: AuditRecord = await this.audit.record(
      actionTypeId,
      payload,
      context,
      objectId
    );

    const result: ActionResult = {
      actionTypeId,
      status: 'executed',
      auditId: auditRecord.id,
      executedAt: new Date(),
    };

    // 4. Publish event
    await this.events.publish(`${actionTypeId}.executed`, result);

    return result;
  }

  private async applyMutation(
    actionTypeId: string,
    payload: Record<string, unknown>
  ): Promise<string | undefined> {
    const actionType = this.registry.getActionType(actionTypeId);
    if (!actionType) {
      throw new Error(`Unknown action type: "${actionTypeId}"`);
    }

    const targetObjectTypeDef = this.registry.getObjectType(actionType.targetObjectType);
    if (!targetObjectTypeDef) return undefined;

    const primaryKeyValue = payload[targetObjectTypeDef.primaryKey];
    if (!primaryKeyValue) return undefined;

    const rows = await this.objectRepo.findByType(actionType.targetObjectType, {
      [targetObjectTypeDef.primaryKey]: primaryKeyValue,
    });

    return rows[0]?.id;
  }
}
