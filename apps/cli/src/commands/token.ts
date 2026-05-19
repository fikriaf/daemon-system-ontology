import jwt from 'jsonwebtoken';

export interface TokenOptions {
  tenantId: string;
  userId: string;
  roleId: string;
  legalEntityId: string;
  jwtSecret: string;
  expiresIn?: string;
}

export function generateToken(opts: TokenOptions): string {
  const payload = {
    tenantId: opts.tenantId,
    userId: opts.userId,
    roleId: opts.roleId,
    legalEntityId: opts.legalEntityId,
  };

  return jwt.sign(payload, opts.jwtSecret, {
    expiresIn: (opts.expiresIn ?? '30d') as jwt.SignOptions['expiresIn'],
  });
}
