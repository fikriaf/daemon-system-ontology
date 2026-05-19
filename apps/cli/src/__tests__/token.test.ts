import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import { generateToken } from '../commands/token.js';

describe('generateToken', () => {
  const secret = 'test-secret-key';

  it('generates a valid JWT with correct claims', () => {
    const token = generateToken({
      tenantId: 'tenant-acme',
      userId: 'admin-001',
      roleId: 'admin',
      legalEntityId: 'ACME',
      jwtSecret: secret,
    });

    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3); // header.payload.signature

    const decoded = jwt.verify(token, secret) as Record<string, unknown>;
    expect(decoded.tenantId).toBe('tenant-acme');
    expect(decoded.userId).toBe('admin-001');
    expect(decoded.roleId).toBe('admin');
    expect(decoded.legalEntityId).toBe('ACME');
  });

  it('generates token with custom expiry', () => {
    const token = generateToken({
      tenantId: 'tenant-x',
      userId: 'user-1',
      roleId: 'viewer',
      legalEntityId: 'X',
      jwtSecret: secret,
      expiresIn: '1h',
    });

    const decoded = jwt.verify(token, secret) as Record<string, unknown>;
    const exp = decoded.exp as number;
    const iat = decoded.iat as number;
    const diff = exp - iat;

    // ~3600 seconds for 1h
    expect(diff).toBeGreaterThanOrEqual(3590);
    expect(diff).toBeLessThanOrEqual(3610);
  });

  it('generates different tokens for different users', () => {
    const t1 = generateToken({ tenantId: 'T', userId: 'u1', roleId: 'admin', legalEntityId: 'E', jwtSecret: secret });
    const t2 = generateToken({ tenantId: 'T', userId: 'u2', roleId: 'admin', legalEntityId: 'E', jwtSecret: secret });
    expect(t1).not.toBe(t2);
  });

  it('token is invalid with wrong secret', () => {
    const token = generateToken({
      tenantId: 'T', userId: 'u', roleId: 'admin', legalEntityId: 'E', jwtSecret: secret,
    });
    expect(() => jwt.verify(token, 'wrong-secret')).toThrow();
  });

  it('operator role token has correct roleId', () => {
    const token = generateToken({
      tenantId: 'T', userId: 'op', roleId: 'operator', legalEntityId: 'E', jwtSecret: secret,
    });
    const decoded = jwt.verify(token, secret) as Record<string, unknown>;
    expect(decoded.roleId).toBe('operator');
  });
});
