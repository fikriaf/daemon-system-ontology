import { describe, it, expect } from 'vitest';
import { join } from 'path';
import { loadOntologyFromDirectory } from '../parser/ontology.parser.js';
import { validateOntologySchema } from '../validator/schema.validator.js';

const fixturesDir = join(import.meta.dirname, 'fixtures');

describe('loadOntologyFromDirectory', () => {
  it('loads all schema files from a directory', async () => {
    const schema = await loadOntologyFromDirectory(fixturesDir);
    expect(schema.objectTypes.length).toBeGreaterThanOrEqual(1);
    expect(schema.linkTypes.length).toBeGreaterThanOrEqual(1);
    expect(schema.actionTypes.length).toBeGreaterThanOrEqual(1);
  });
});

describe('validateOntologySchema', () => {
  it('passes for valid schema', async () => {
    const schema = await loadOntologyFromDirectory(fixturesDir);
    const errors = validateOntologySchema(schema);
    expect(errors).toHaveLength(0);
  });

  it('catches duplicate apiName within object types', () => {
    const schema = {
      objectTypes: [
        {
          apiName: 'Shipment',
          displayName: 'Shipment',
          primaryKey: 'id',
          titleProperty: 'id',
          properties: [{ name: 'id', type: 'string' as const, required: true }],
        },
        {
          apiName: 'Shipment', // duplicate!
          displayName: 'Shipment 2',
          primaryKey: 'id',
          titleProperty: 'id',
          properties: [{ name: 'id', type: 'string' as const, required: true }],
        },
      ],
      linkTypes: [],
      actionTypes: [],
    };
    const errors = validateOntologySchema(schema);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('Duplicate apiName');
  });
});
