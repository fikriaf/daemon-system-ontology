import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OntologyClient } from '../client/ontology.client.js';
import type { OntologyEngine } from '@daemon/ontology-engine';

describe('OntologyClient', () => {
  let client: OntologyClient;
  const mockEngine = {
    objects: {
      queryObjects: vi.fn().mockResolvedValue([
        {
          id: 'obj-001',
          typeApiName: 'Shipment',
          properties: { shipmentId: 'SHP-001', status: 'Draft', legalEntityId: 'ANT' },
        },
      ]),
      getObject: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    client = new OntologyClient(mockEngine as unknown as OntologyEngine);
  });

  describe('objects()', () => {
    it('returns query builder for type', () => {
      const builder = client.objects('Shipment');
      expect(builder).toBeDefined();
      expect(typeof builder.filter).toBe('function');
      expect(typeof builder.limit).toBe('function');
      expect(typeof builder.get).toBe('function');
    });

    it('executes query via engine', async () => {
      const results = await client.objects('Shipment').get();
      expect(mockEngine.objects.queryObjects).toHaveBeenCalledWith('Shipment', {});
      expect(results).toHaveLength(1);
    });

    it('applies filter correctly', async () => {
      await client
        .objects('Shipment')
        .filter({ status: 'InTransit', legalEntityId: 'ANT' })
        .get();

      expect(mockEngine.objects.queryObjects).toHaveBeenCalledWith('Shipment', {
        status: 'InTransit',
        legalEntityId: 'ANT',
      });
    });
  });

  describe('actions.propose()', () => {
    it('returns proposal id and status', async () => {
      const mockRedis = {
        set: vi.fn().mockResolvedValue('OK'),
      };
      const clientWithRedis = new OntologyClient(
        mockEngine as unknown as OntologyEngine,
        mockRedis as any,
        'abc-express'
      );

      const result = await clientWithRedis.actions.propose(
        'transitionShipmentState',
        { shipmentId: 'SHP-001', newStatus: 'InTransit' }
      );

      expect(result.status).toBe('awaiting_approval');
      expect(result.proposalId).toBeDefined();
    });
  });
});
