import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { internalAgentRoute, InternalAgentRouteOptions } from '../internal-agent.route.js';

const mockModel = {
  invoke: vi.fn().mockResolvedValue({
    content: 'Test answer from model',
  }),
} as unknown as ReturnType<typeof import('@langchain/openai').ChatOpenAI.prototype.invoke>;

vi.mock('../model.js', () => ({
  createModel: vi.fn(() => mockModel),
  getModelConfigFromEnv: vi.fn(() => ({
    provider: 'openrouter',
    modelName: 'test-model',
    temperature: 0.2,
    maxTokens: 2048,
  })),
}));

vi.mock('../governance.js', () => ({
  InternalAgentGovernance: vi.fn().mockImplementation(() => ({
    getEvidence: () => ({
      toolsCalled: ['list_tenants'],
      tenantIds: ['tenant-1'],
      recordsInspected: { tenants: 1, healthChecks: 0, logs: 0, metrics: 0 },
    }),
    getAudit: () => [{ tool: 'list_tenants', action: 'allowed' as const }],
  })),
}));

vi.mock('../tools.js', () => ({
  list_tenants: vi.fn().mockResolvedValue({ tenants: [{ id: 'tenant-1' }] }),
}));

describe('internal-agent.route', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(() => {
    app = Fastify();
    app.decorate('db', {
      dataSource: {
        getRepository: vi.fn().mockReturnValue({
          findAll: vi.fn().mockResolvedValue([]),
        }),
      },
    });
    vi.clearAllMocks();
  });

  it('should return answer from runner on valid request', async () => {
    await app.register(internalAgentRoute, {
      prefix: '/internal-agent',
    } as InternalAgentRouteOptions);

    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/internal-agent/invoke',
      payload: {
        question: 'List all tenants',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.answer).toBe('Test answer from model');
    expect(body.toolResults).toBeDefined();
    expect(body.evidence).toBeDefined();
    expect(body.audit).toBeDefined();
  });

  it('should pass tenantIds and toolNames to runner', async () => {
    await app.register(internalAgentRoute, {
      prefix: '/internal-agent',
    } as InternalAgentRouteOptions);

    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/internal-agent/invoke',
      payload: {
        question: 'Get health for tenant',
        tenantIds: ['tenant-1', 'tenant-2'],
        toolNames: ['get_tenant_health', 'get_tenant_metrics'],
      },
    });

    expect(response.statusCode).toBe(200);
  });

  it('should return 400 on invalid request body', async () => {
    await app.register(internalAgentRoute, {
      prefix: '/internal-agent',
    } as InternalAgentRouteOptions);

    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/internal-agent/invoke',
      payload: {
        question: '',
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('Invalid request body');
  });

  it('should return 500 on runner error', async () => {
    const { createModel } = await import('../model.js');
    vi.mocked(createModel).mockImplementation(() => {
      throw new Error('Model creation failed');
    });

    await app.register(internalAgentRoute, {
      prefix: '/internal-agent',
    } as InternalAgentRouteOptions);

    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/internal-agent/invoke',
      payload: {
        question: 'Test question',
      },
    });

    expect(response.statusCode).toBe(502);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('Internal agent failed to produce a response');
  });
});