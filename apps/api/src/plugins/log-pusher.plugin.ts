import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

export interface LogPusherConfig {
  controlPlaneUrl: string;   // e.g. http://control-plane:4000
  internalSecret: string;    // sama dengan control-plane INTERNAL_SECRET
  tenantId: string;
  enabled: boolean;
}

declare module 'fastify' {
  interface FastifyInstance {
    logPusher: LogPusherConfig | null;
  }
}

const logPusherPlugin: FastifyPluginAsync<{ config: LogPusherConfig | null }> = async (
  fastify,
  opts
) => {
  fastify.decorate('logPusher', opts.config);

  if (!opts.config?.enabled) return;

  const { controlPlaneUrl, internalSecret, tenantId } = opts.config;

  fastify.addHook('onResponse', async (request, reply) => {
    // Skip metrics and logs endpoints — avoid infinite loop
    if (request.url.startsWith('/metrics') || request.url.startsWith('/logs')) return;
    if (request.url === '/health') return;

    const logEntry = {
      tenantId,
      service: 'api',
      level: reply.statusCode >= 500 ? 'error' : reply.statusCode >= 400 ? 'warn' : 'info',
      method: request.method,
      path: request.url.split('?')[0], // strip query params
      statusCode: reply.statusCode,
      responseTimeMs: Math.round(reply.elapsedTime),
      message: reply.statusCode >= 400 ? `${request.method} ${request.url} → ${reply.statusCode}` : null,
      loggedAt: new Date().toISOString(),
    };

    // Fire-and-forget — don't block response
    fetch(`${controlPlaneUrl}/logs/receive`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${internalSecret}`,
      },
      body: JSON.stringify(logEntry),
    }).catch(() => {
      // Silently ignore push failures — control plane may be down
    });
  });
};

export default fp(logPusherPlugin);
export { logPusherPlugin };
