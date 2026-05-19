import Fastify from 'fastify';
import { OntologyEngine } from '@daemon/ontology-engine';
import { OntologyClient, ActionProposer } from '@daemon/ontology-sdk';
import { createRedisClient } from '@daemon/ontology-engine';
import { createRootAgent } from './agents/root.agent.js';
import { createModelFromEnv, type ModelConfig } from './model/model.factory.js';

export interface AgentServerConfig {
  port: number;
  modelConfig: ModelConfig;
  dbHost: string;
  dbPort: number;
  dbUser: string;
  dbPassword: string;
  dbName: string;
  redisHost: string;
  redisPort: number;
  schemaDir: string;
  defaultTenantId: string;
}

export async function buildAgentServer(config: AgentServerConfig) {
  const app = Fastify({ logger: false });

  // Resolve model instance sekali — dipakai semua request
  const model = createModelFromEnv(config.modelConfig);

  // Setup engine once per server
  const engine = await OntologyEngine.create({
    db: {
      host: config.dbHost,
      port: config.dbPort,
      user: config.dbUser,
      password: config.dbPassword,
      database: config.dbName,
    },
    redis: { host: config.redisHost, port: config.redisPort },
    tenantId: config.defaultTenantId,
    schemaDir: config.schemaDir,
  });

  const redis = createRedisClient({ host: config.redisHost, port: config.redisPort });

  // POST /agent/invoke — invoke root agent with a message
  app.post<{
    Body: { tenantId?: string; message: string };
  }>('/agent/invoke', async (request, reply) => {
    const { tenantId = config.defaultTenantId, message } = request.body;

    const client = new OntologyClient(engine, redis, tenantId);
    const proposer = new ActionProposer(redis, tenantId);

    const agent = createRootAgent({
      tenantId,
      model,
      engine,
      client,
      proposer,
    });

    const result = await agent.invoke({
      messages: [{ role: 'user', content: message }],
    });

    const messages = result.messages ?? [];
    const lastMessage = messages[messages.length - 1];
    const content =
      lastMessage
        ? (typeof lastMessage.content === 'string'
            ? lastMessage.content
            : JSON.stringify(lastMessage.content))
        : '(no response)';

    return reply.send({ response: content, tenantId });
  });

  // Health check — also shows active model config
  app.get('/health', async () => ({
    status: 'ok',
    model: config.modelConfig.agentModel,
  }));

  return app;
}
