import type { FastifyPluginAsync } from 'fastify';
import websocket from '@fastify/websocket';
import type { WsBroadcaster } from './ws.broadcaster.js';

export const wsRoute: FastifyPluginAsync<{ broadcaster: WsBroadcaster }> = async (
  fastify,
  opts
) => {
  await fastify.register(websocket);

  const { broadcaster } = opts;

  // WS /ws/logs — subscribe to all tenant logs
  fastify.get('/ws/logs', { websocket: true }, (socket) => {
    broadcaster.subscribe(socket, null);
  });

  // WS /ws/logs/:tenantId — subscribe to specific tenant logs
  fastify.get<{ Params: { tenantId: string } }>(
    '/ws/logs/:tenantId',
    { websocket: true },
    (socket, request) => {
      broadcaster.subscribe(socket, request.params.tenantId);
    }
  );

  // GET /ws/status — how many active WS connections
  fastify.get('/ws/status', async (_request, reply) => {
    return reply.send({
      subscribers: broadcaster.subscriberCount(),
      timestamp: new Date().toISOString(),
    });
  });
};
