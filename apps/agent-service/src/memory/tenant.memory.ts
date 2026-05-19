import { InMemoryStore } from '@langchain/langgraph';

// In-memory store per tenant (Wave 1)
// Wave 2+: replace with Redis-backed persistent store
const stores = new Map<string, InMemoryStore>();

export function getTenantMemoryStore(tenantId: string): InMemoryStore {
  if (!stores.has(tenantId)) {
    stores.set(tenantId, new InMemoryStore());
  }
  return stores.get(tenantId)!;
}
