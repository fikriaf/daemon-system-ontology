export interface ControlPlaneLogClientConfig {
  tenantId: string;
  controlPlaneUrl?: string;
  controlPlaneSecret?: string;
}

export interface MonitoringLogPayload {
  level: 'info' | 'warn' | 'error';
  message: string;
}

export class ControlPlaneLogClient {
  constructor(private readonly config: ControlPlaneLogClientConfig) {}

  async push(payload: MonitoringLogPayload): Promise<void> {
    const { controlPlaneUrl, controlPlaneSecret, tenantId } = this.config;
    if (!controlPlaneUrl || !controlPlaneSecret) return;

    try {
      await fetch(`${controlPlaneUrl}/logs/receive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${controlPlaneSecret}`,
        },
        body: JSON.stringify({
          tenantId,
          service: 'agent',
          level: payload.level,
          path: '/agent/monitor/run',
          message: payload.message,
          loggedAt: new Date().toISOString(),
        }),
      });
    } catch {
      // Control-plane logging is best-effort and must not fail monitoring.
    }
  }
}
