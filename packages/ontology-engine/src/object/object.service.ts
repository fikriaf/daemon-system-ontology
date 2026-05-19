import type { SchemaRegistry } from '../registry/schema.registry.js';
import type { ObjectRepository, ObjectRow } from './object.repository.js';

export class ObjectService {
  constructor(
    private repo: ObjectRepository,
    private registry: SchemaRegistry
  ) {}

  private validateProperties(typeApiName: string, properties: Record<string, unknown>): string[] {
    const objectType = this.registry.getObjectType(typeApiName);
    if (!objectType) return [`Unknown object type: "${typeApiName}"`];

    const errors: string[] = [];
    for (const prop of objectType.properties ?? []) {
      if (prop.required && !(prop.name in properties)) {
        errors.push(`Missing required property: "${prop.name}"`);
      }
      if (prop.name in properties && prop.type === 'enum' && prop.values) {
        const val = properties[prop.name];
        if (!prop.values.includes(val as string)) {
          errors.push(`Invalid value "${val}" for enum property "${prop.name}". Allowed: ${prop.values.join(', ')}`);
        }
      }
    }
    return errors;
  }

  async createObject(
    typeApiName: string,
    properties: Record<string, unknown>
  ): Promise<ObjectRow> {
    const objectType = this.registry.getObjectType(typeApiName);
    if (!objectType) {
      throw new Error(`Unknown object type: "${typeApiName}"`);
    }

    const errors = this.validateProperties(typeApiName, properties);
    if (errors.length > 0) {
      throw new Error(`Validation failed:\n${errors.join('\n')}`);
    }

    return this.repo.create({
      typeApiName,
      properties,
      legalEntityId: (properties['legalEntityId'] as string | undefined) ?? null,
    });
  }

  async updateObject(
    id: string,
    typeApiName: string,
    properties: Record<string, unknown>
  ): Promise<ObjectRow> {
    const objectType = this.registry.getObjectType(typeApiName);
    if (!objectType) {
      throw new Error(`Unknown object type: "${typeApiName}"`);
    }

    const errors = this.validateProperties(typeApiName, properties);
    if (errors.length > 0) {
      throw new Error(`Validation failed:\n${errors.join('\n')}`);
    }

    const row = await this.repo.update(id, properties);
    if (!row) {
      throw new Error(`Object not found: "${id}"`);
    }
    return row;
  }

  async deleteObject(id: string): Promise<void> {
    const deleted = await this.repo.softDelete(id);
    if (!deleted) {
      throw new Error(`Object not found: "${id}"`);
    }
  }

  async queryObjects(
    typeApiName: string,
    filters: Record<string, unknown>
  ): Promise<ObjectRow[]> {
    const objectType = this.registry.getObjectType(typeApiName);
    if (!objectType) {
      throw new Error(`Unknown object type: "${typeApiName}"`);
    }
    return this.repo.findByType(typeApiName, filters);
  }

  async getObject(id: string): Promise<ObjectRow | undefined> {
    return this.repo.findById(id);
  }
}
