import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { TenantRepository } from './tenant.repository.js';

const CreateTenantSchema = z.object({
  slug: z.string().min(2).max(64).regex(/^[a-z0-9-]+$/, 'slug must be lowercase alphanumeric with dashes'),
  displayName: z.string().min(2).max(128),
  plan: z.enum(['trial', 'standard', 'enterprise']).default('standard'),
  apiUrl: z.string().url(),
  agentUrl: z.string().url().optional(),
  vpsProvider: z.string().optional(),
  vpsRegion: z.string().optional(),
  vpsManagedByDaemon: z.boolean().default(false),
  adminEmail: z.string().email().optional(),
  notes: z.string().optional(),
});

const UpdateTenantSchema = CreateTenantSchema.partial().omit({ slug: true });

export const tenantsRoute: FastifyPluginAsync = async (fastify) => {

  // GET /tenants — list all active tenants with last health status
  fastify.get('/', async (_request, reply) => {
    const repo = new TenantRepository(fastify.db);
    const tenants = await repo.findWithStatus();
    return reply.send({ data: tenants, count: tenants.length });
  });

  // GET /tenants/all — include offboarded
  fastify.get('/all', async (_request, reply) => {
    const repo = new TenantRepository(fastify.db);
    const tenants = await repo.findAll(true);
    return reply.send({ data: tenants, count: tenants.length });
  });

  // GET /tenants/:id — single tenant detail with latest metrics
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const repo = new TenantRepository(fastify.db);
    const tenant = await repo.findById(request.params.id);

    if (!tenant) {
      return reply.code(404).send({ error: 'Tenant not found' });
    }

    const metrics = await repo.getLatestMetrics(tenant.id);

    return reply.send({ data: { ...tenant, latestMetrics: metrics } });
  });

  // POST /tenants — register new tenant
  fastify.post('/', async (request, reply) => {
    const body = CreateTenantSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: 'Invalid request body', details: body.error.errors });
    }

    const repo = new TenantRepository(fastify.db);

    // Check slug uniqueness
    const existing = await repo.findBySlug(body.data.slug);
    if (existing) {
      return reply.code(409).send({ error: `Slug "${body.data.slug}" already exists` });
    }

    const tenant = await repo.create(body.data);
    return reply.code(201).send({ data: tenant });
  });

  // PUT /tenants/:id — update tenant metadata
  fastify.put<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const body = UpdateTenantSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: 'Invalid request body', details: body.error.errors });
    }

    const repo = new TenantRepository(fastify.db);
    const tenant = await repo.update(request.params.id, body.data);

    if (!tenant) {
      return reply.code(404).send({ error: 'Tenant not found' });
    }

    return reply.send({ data: tenant });
  });

  // POST /tenants/:id/suspend — suspend tenant
  fastify.post<{ Params: { id: string } }>('/:id/suspend', async (request, reply) => {
    const repo = new TenantRepository(fastify.db);
    const tenant = await repo.update(request.params.id, { status: 'suspended' });

    if (!tenant) {
      return reply.code(404).send({ error: 'Tenant not found' });
    }

    return reply.send({ data: tenant });
  });

  // POST /tenants/:id/activate — re-activate suspended tenant
  fastify.post<{ Params: { id: string } }>('/:id/activate', async (request, reply) => {
    const repo = new TenantRepository(fastify.db);
    const tenant = await repo.update(request.params.id, { status: 'active' });

    if (!tenant) {
      return reply.code(404).send({ error: 'Tenant not found' });
    }

    return reply.send({ data: tenant });
  });

  // DELETE /tenants/:id — offboard tenant (soft)
  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const repo = new TenantRepository(fastify.db);
    const tenant = await repo.offboard(request.params.id);

    if (!tenant) {
      return reply.code(404).send({ error: 'Tenant not found' });
    }

    return reply.code(204).send();
  });
};
