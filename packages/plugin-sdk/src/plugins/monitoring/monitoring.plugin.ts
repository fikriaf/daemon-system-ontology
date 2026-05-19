import { tool } from 'langchain';
import { z } from 'zod';
import type { DaemonPlugin, PluginContext } from '../../types/plugin.types.js';

function getObjectTimestamp(createdAt: Date): number {
  return new Date(createdAt).getTime();
}

export const monitoringPlugin: DaemonPlugin = {
  id: 'monitoring/core',
  name: 'Monitoring',
  version: '1.0.0',
  category: 'monitoring',
  description: 'SLA checking, anomaly detection, and alerting tools',

  tools: [
    // ── check_sla ─────────────────────────────────────────────────────────
    {
      id: 'check_sla',
      name: 'Check SLA',
      description: 'Find objects that have been in a given status longer than threshold',
      build(ctx: PluginContext) {
        return tool(
          async ({ objectType, statusField, statusValue, thresholdHours, limit = 50 }: {
            objectType: string;
            statusField: string;
            statusValue: string;
            thresholdHours: number;
            limit?: number;
          }) => {
            const all = await ctx.client.objects(objectType).limit(10000).get();
            const now = Date.now();
            const thresholdMs = thresholdHours * 60 * 60 * 1000;

            const breached = all.filter(obj => {
              const props = obj.properties as Record<string, unknown>;
              if (props[statusField] !== statusValue) return false;
              const createdAt = getObjectTimestamp(obj.createdAt);
              return (now - createdAt) > thresholdMs;
            });

            if (breached.length === 0) {
              return `No SLA breaches found: ${objectType} with ${statusField}="${statusValue}" older than ${thresholdHours}h.`;
            }

            return JSON.stringify({
              slaBreaches: breached.length,
              objectType,
              condition: `${statusField} = "${statusValue}" for > ${thresholdHours}h`,
              items: breached.slice(0, limit).map(obj => ({
                id: obj.id,
                properties: obj.properties,
                createdAt: obj.createdAt,
                ageHours: Math.round((now - getObjectTimestamp(obj.createdAt)) / 3600000),
              })),
            }, null, 2);
          },
          {
            name: 'check_sla',
            description: 'Find objects stuck in a status longer than a threshold. Use to detect SLA breaches, e.g. shipments in Draft for >24h.',
            schema: z.object({
              objectType: z.string(),
              statusField: z.string().describe('Property name that holds status, e.g. "status"'),
              statusValue: z.string().describe('Status value to check, e.g. "Draft"'),
              thresholdHours: z.number().describe('Hours threshold — flag items older than this'),
              limit: z.number().optional().default(50),
            }),
          }
        );
      },
    },

    // ── detect_anomaly ────────────────────────────────────────────────────
    {
      id: 'detect_anomaly',
      name: 'Detect Anomaly',
      description: 'Detect unusual spikes or drops in object counts by status',
      build(ctx: PluginContext) {
        return tool(
          async ({ objectType, groupBy }: {
            objectType: string;
            groupBy: string;
          }) => {
            const all = await ctx.client.objects(objectType).limit(10000).get();

            // Group by property
            const groups: Record<string, number> = {};
            for (const obj of all) {
              const props = obj.properties as Record<string, unknown>;
              const key = String(props[groupBy] ?? 'unknown');
              groups[key] = (groups[key] ?? 0) + 1;
            }

            const total = all.length;
            const counts = Object.values(groups);
            const avg = counts.reduce((s, c) => s + c, 0) / counts.length;
            const stdDev = Math.sqrt(
              counts.reduce((s, c) => s + Math.pow(c - avg, 2), 0) / counts.length
            );

            // Flag groups that are > 2 standard deviations from mean
            const anomalies = Object.entries(groups)
              .filter(([, count]) => Math.abs(count - avg) > 2 * stdDev)
              .map(([value, count]) => ({
                [groupBy]: value,
                count,
                pctOfTotal: Math.round(count / total * 100),
                deviations: Math.round(Math.abs(count - avg) / stdDev * 10) / 10,
              }));

            if (anomalies.length === 0) {
              return `No anomalies detected in ${objectType} grouped by ${groupBy}. Distribution looks normal.`;
            }

            return JSON.stringify({
              objectType,
              groupBy,
              total,
              avg: Math.round(avg),
              anomalies,
              message: `${anomalies.length} anomalous group(s) detected (>2σ from mean)`,
            }, null, 2);
          },
          {
            name: 'detect_anomaly',
            description: 'Detect statistically unusual distributions in object data. Flags groups that are >2 standard deviations from the mean.',
            schema: z.object({
              objectType: z.string(),
              groupBy: z.string().describe('Property to analyze for anomalies, e.g. "status"'),
            }),
          }
        );
      },
    },

    // ── get_trend ─────────────────────────────────────────────────────────
    {
      id: 'get_trend',
      name: 'Get Trend',
      description: 'Analyze trend direction for a metric over time buckets',
      build(ctx: PluginContext) {
        return tool(
          async ({ objectType, statusField, statusValue, buckets = 7 }: {
            objectType: string;
            statusField: string;
            statusValue: string;
            buckets?: number;
          }) => {
            const all = await ctx.client.objects(objectType).limit(10000).get();

            const now = Date.now();
            const bucketMs = (7 * 24 * 60 * 60 * 1000) / buckets; // 7 days / buckets

            const bucketCounts = Array(buckets).fill(0);

            for (const obj of all) {
              const props = obj.properties as Record<string, unknown>;
              if (props[statusField] !== statusValue) continue;

              const age = now - getObjectTimestamp(obj.createdAt);
              const bucketIdx = Math.min(Math.floor(age / bucketMs), buckets - 1);
              bucketCounts[buckets - 1 - bucketIdx]++; // most recent last
            }

            // Simple trend: is last half higher than first half?
            const mid = Math.floor(buckets / 2);
            const firstHalf = bucketCounts.slice(0, mid).reduce((s, c) => s + c, 0);
            const secondHalf = bucketCounts.slice(mid).reduce((s, c) => s + c, 0);
            const trend = secondHalf > firstHalf ? 'increasing' : secondHalf < firstHalf ? 'decreasing' : 'stable';

            return JSON.stringify({
              objectType,
              filter: `${statusField} = "${statusValue}"`,
              trend,
              buckets: bucketCounts.map((count, i) => ({
                period: `T-${buckets - i}`,
                count,
              })),
              summary: `${statusValue} count is ${trend} over the last 7 days`,
            }, null, 2);
          },
          {
            name: 'get_trend',
            description: 'Analyze trend direction (increasing/decreasing/stable) for objects matching a status over time buckets.',
            schema: z.object({
              objectType: z.string(),
              statusField: z.string(),
              statusValue: z.string(),
              buckets: z.number().optional().default(7).describe('Number of time buckets (default: 7 days)'),
            }),
          }
        );
      },
    },

    // ── send_alert ────────────────────────────────────────────────────────
    {
      id: 'send_alert',
      name: 'Send Alert',
      description: 'Push an alert to the operator via Redis pub/sub',
      build(ctx: PluginContext) {
        return tool(
          async ({ severity, title, message, affectedObjects = [] }: {
            severity: 'info' | 'warning' | 'critical';
            title: string;
            message: string;
            affectedObjects?: string[];
          }) => {
            const alert = {
              type: 'agent-alert',
              tenantId: ctx.tenantId,
              severity,
              title,
              message,
              affectedObjects,
              timestamp: new Date().toISOString(),
            };

            // Store in Redis with 24h TTL so operators can poll
            await ctx.redis?.set(
              `alert:${ctx.tenantId}:${Date.now()}`,
              JSON.stringify(alert),
              'EX',
              86400
            );

            return [
              `Alert sent: [${severity.toUpperCase()}] ${title}`,
              `Message: ${message}`,
              affectedObjects.length > 0
                ? `Affected: ${affectedObjects.slice(0, 5).join(', ')}${affectedObjects.length > 5 ? '...' : ''}`
                : '',
            ].filter(Boolean).join('\n');
          },
          {
            name: 'send_alert',
            description: 'Send an alert to operators. Use when you detect a problem that requires immediate attention. Severity: info | warning | critical.',
            schema: z.object({
              severity: z.enum(['info', 'warning', 'critical']),
              title: z.string().describe('Short alert title, e.g. "47 Shipments SLA Breach"'),
              message: z.string().describe('Detailed description of the issue'),
              affectedObjects: z.array(z.string()).optional().describe('IDs of affected objects'),
            }),
          }
        );
      },
    },
  ],

  systemPromptExtension: `
## Monitoring Tools Available
- check_sla: Find objects stuck in a status longer than threshold hours
- detect_anomaly: Detect statistically unusual distributions (>2σ from mean)
- get_trend: Analyze if a metric is increasing/decreasing/stable over time
- send_alert: Push alert to operators when critical issues are detected

Use these proactively to identify problems before operators notice them.
`.trim(),
};
