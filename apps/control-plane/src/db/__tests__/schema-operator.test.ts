import { describe, it, expect } from 'vitest';
import { operators, operatorTenantAccess } from '../schema.js';

describe('Operator Schema', () => {
  it('exports operators and operatorTenantAccess tables', () => {
    expect(operators).toBeDefined();
    expect(operatorTenantAccess).toBeDefined();
  });
});