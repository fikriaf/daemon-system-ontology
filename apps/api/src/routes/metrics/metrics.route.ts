import type { FastifyPluginAsync } from 'fastify';
import os from 'os';

export const metricsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/metrics', async (_request, reply) => {
    const registry = fastify.engine.getRegistry();
    const uptime = process.uptime();
    const mem = process.memoryUsage();

    // Collect DB usage stats (counts only — no business content)
    const usageStats = await fastify.engine.metrics.collect(
      registry.getObjectTypeNames().length,
      registry.getActionTypeNames().length
    );

    return reply.send({
      service: 'api',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(uptime),
      schema: {
        objectTypes: usageStats.schemaObjectTypes,
        actionTypes: usageStats.schemaActionTypes,
      },
      usage: {
        objectsTotal: usageStats.objectsTotal,
        proposalsCreated: usageStats.proposalsCreated,
        proposalsApproved: usageStats.proposalsApproved,
        proposalsRejected: usageStats.proposalsRejected,
        actionsExecuted: usageStats.actionsExecuted,
      },
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        memUsedMb: Math.round(mem.rss / 1024 / 1024),
        memHeapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
        memTotalMb: Math.round(os.totalmem() / 1024 / 1024),
        cpuCount: os.cpus().length,
        loadAvg: os.loadavg(),
        uptimeSeconds: Math.floor(os.uptime()),
      },
    });
  });
};
