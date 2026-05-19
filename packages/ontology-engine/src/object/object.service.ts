import type { SchemaRegistry } from '../registry/schema.registry.js';
import type { ObjectRepository, ObjectRow } from './object.repository.js';

export class ObjectService {
  constructor(
    private repo: ObjectRepository,
    private registry: SchemaRegistry
  ) {}

  async createObject(
    typeApiName: string,
    properties: Record<string, unknown>
  ): Promise<ObjectRow> {
    const objectType = this.registry.getObjectType(typeApiName);
    if (!objectType) {
      throw new Error(`Unknown object type: "${typeApiName}"`);
    }

    return this.repo.create({
      typeApiName,
      properties,
      legalEntityId: (properties['legalEntityId'] as string | undefined) ?? null,
    });
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
