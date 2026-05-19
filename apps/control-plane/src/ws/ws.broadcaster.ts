import type { WebSocket } from '@fastify/websocket';

export interface LogEvent {
  tenantId: string;
  service: string;
  level: string;
  method?: string | null;
  path?: string | null;
  statusCode?: number | null;
  responseTimeMs?: number | null;
  message?: string | null;
  loggedAt: string;
}

interface Subscriber {
  socket: WebSocket;
  tenantId: string | null; // null = subscribe to all tenants
}

export class WsBroadcaster {
  private subscribers: Set<Subscriber> = new Set();

  subscribe(socket: WebSocket, tenantId: string | null): void {
    const sub: Subscriber = { socket, tenantId };
    this.subscribers.add(sub);

    socket.on('close', () => {
      this.subscribers.delete(sub);
    });

    // Send connected ack
    socket.send(JSON.stringify({
      type: 'connected',
      tenantId,
      timestamp: new Date().toISOString(),
    }));
  }

  broadcast(event: LogEvent): void {
    const payload = JSON.stringify({ type: 'log', data: event });

    for (const sub of this.subscribers) {
      // Skip if subscriber filters by different tenant
      if (sub.tenantId && sub.tenantId !== event.tenantId) continue;

      if (sub.socket.readyState === sub.socket.OPEN) {
        try {
          sub.socket.send(payload);
        } catch {
          // Remove dead socket
          this.subscribers.delete(sub);
        }
      } else {
        this.subscribers.delete(sub);
      }
    }
  }

  subscriberCount(): number {
    return this.subscribers.size;
  }
}
