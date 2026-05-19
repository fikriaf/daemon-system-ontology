import type { FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { OperatorRepository } from '../operators/operator.repository.js';

declare module 'fastify' {
  interface FastifyRequest {
    operator?: {
      id: string;
      email: string;
      role: 'admin' | 'operator';
      tenantIds: string[];
    };
  }
}

export async function operatorAuth(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.code(401).send({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.substring(7);
  const hash = crypto.createHash('sha256').update(token).digest('hex');

  const repo = new OperatorRepository(request.server.db as any);
  const op = await repo.findByApiKeyHash(hash);

  if (!op || op.status !== 'active') {
    return reply.code(401).send({ error: 'Invalid or suspended operator token' });
  }

  request.operator = {
    id: op.id,
    email: op.email,
    role: op.role,
    tenantIds: op.tenantIds,
  };
}
