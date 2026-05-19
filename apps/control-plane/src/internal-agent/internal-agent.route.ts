import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createModel, getModelConfigFromEnv } from './model.js';
import { READONLY_OPERATOR_POLICY, composeInternalAgentPolicy } from './policy.js';
import type { InternalAgentPolicy } from './policy.js';
import { InternalAgentGovernance } from './governance.js';
import type { InternalAgentGovernance as InternalAgentGovernanceType } from './governance.js';
import * as tools from './tools.js';
import { createUserPrompt } from './prompt.js';
import { InternalAgentRunner } from './runner.js';
import type { InternalAgentRequest, InternalAgentResponse } from './runner.js';
import { TenantRepository } from '../tenants/tenant.repository.js';
import { HealthRepository } from '../health/health.repository.js';
import { LogRepository } from '../logs/log.repository.js';
import type { TenantRepository as ITenantRepository } from '../tenants/tenant.repository.js';
import type { HealthRepository as IHealthRepository } from '../health/health.repository.js';
import type { LogRepository as ILogRepository } from '../logs/log.repository.js';

const InvokeRequestSchema = z.object({
  question: z.string().min(1),
  tenantIds: z.array(z.string()).optional(),
  toolNames: z.array(z.string()).optional(),
});

export interface ModelConfig {
  agentModel?: string;
  temperature?: number;
}

export interface InternalAgentRouteOptions {
  modelConfig?: ModelConfig;
  createRunner?: InternalAgentRunnerFactory;
}

export type InternalAgentRunnerFactory = (
  policy: InternalAgentPolicy,
  governance: InternalAgentGovernanceType,
  repositories: {
    tenantRepository: ITenantRepository;
    healthRepository: IHealthRepository;
    logRepository: ILogRepository;
  },
  model: ReturnType<typeof createModel>
) => InternalAgentRunner;

export const internalAgentRoute: FastifyPluginAsync<InternalAgentRouteOptions> = async (fastify, options) => {
  const { modelConfig, createRunner } = options;

  fastify.post<{ Body: z.infer<typeof InvokeRequestSchema> }>(
    '/invoke',
    async (request, reply) => {
      const parseResult = InvokeRequestSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.code(400).send({
          error: 'Invalid request body',
          details: parseResult.error.errors,
        });
      }

      const { question, tenantIds, toolNames } = parseResult.data;

      try {
        const modelFromEnv = getModelConfigFromEnv();
        const model = createModel({
          provider: modelFromEnv.provider,
          modelName: modelConfig?.agentModel ?? modelFromEnv.modelName,
          temperature: modelConfig?.temperature ?? modelFromEnv.temperature,
          maxTokens: modelFromEnv.maxTokens,
        });

        const policyOverride: { allowedTools?: string[]; tenantIds?: string[] } = {};
        if (toolNames) {
          policyOverride.allowedTools = toolNames;
        }
        if (tenantIds) {
          policyOverride.tenantIds = tenantIds;
        }

        const effectivePolicy = composeInternalAgentPolicy(
          Object.keys(policyOverride).length > 0 ? policyOverride : undefined
        );

        const governance = new InternalAgentGovernance(effectivePolicy);

        const tenantRepo = new TenantRepository(fastify.db);
        const healthRepo = new HealthRepository(fastify.db);
        const logRepo = new LogRepository(fastify.db);

        const runner =
          createRunner?.(
            effectivePolicy,
            governance,
            {
              tenantRepository: tenantRepo,
              healthRepository: healthRepo,
              logRepository: logRepo,
            },
            model
          ) ??
          new InternalAgentRunner(
            effectivePolicy,
            governance,
            {
              list_tenants: async (ctx, _args) => tools.list_tenants(ctx),
              get_tenant: async (ctx, args) => tools.get_tenant(args.tenantId as string, ctx),
              get_tenant_health: async (ctx, args) => tools.get_tenant_health(args.tenantId as string, ctx),
              get_tenant_metrics: async (ctx, args) => tools.get_tenant_metrics(args.tenantId as string, ctx),
              query_tenant_logs: async (ctx, args) =>
                tools.query_tenant_logs(
                  args.tenantId as string,
                  ctx,
                  args.query as string | undefined,
                  args.limit as number | undefined
                ),
              summarize_tenant_incidents: async (ctx, args) =>
                tools.summarize_tenant_incidents(args.tenantId as string, ctx),
            },
            model
          );

        const internalAgentRequest: InternalAgentRequest = {
          question,
          tenantIds,
          toolNames,
        };

        const response = await runner.run(internalAgentRequest);

        const result: InternalAgentResponse = {
          answer: response.answer,
          toolResults: response.toolResults,
          evidence: response.evidence,
          audit: response.audit,
        };

        return reply.send(result);
      } catch (error) {
        fastify.log.error(error, 'Internal agent invoke error');
        return reply.code(502).send({
          error: 'Internal agent failed to produce a response',
        });
      }
    }
  );
};