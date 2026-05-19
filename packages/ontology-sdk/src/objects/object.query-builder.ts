import type { OntologyEngine } from '@daemon/ontology-engine';

export type ObjectRow = {
  id: string;
  typeApiName: string;
  properties: Record<string, unknown>;
  legalEntityId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

export class ObjectQueryBuilder {
  private filters: Record<string, unknown> = {};
  private limitValue?: number;

  constructor(
    private engine: OntologyEngine,
    private typeApiName: string
  ) {}

  filter(filters: Record<string, unknown>): this {
    this.filters = { ...this.filters, ...filters };
    return this;
  }

  limit(n: number): this {
    this.limitValue = n;
    return this;
  }

  async get(): Promise<ObjectRow[]> {
    const results = await this.engine.objects.queryObjects(
      this.typeApiName,
      this.filters
    );

    if (this.limitValue !== undefined) {
      return results.slice(0, this.limitValue) as ObjectRow[];
    }

    return results as ObjectRow[];
  }
}
