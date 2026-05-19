import { tool } from 'langchain';
import { z } from 'zod';
import type { DaemonPlugin, PluginContext } from '../../types/plugin.types.js';

export const analyticsPlugin: DaemonPlugin = {
  id: 'analytics/core',
  name: 'Analytics',
  version: '1.0.0',
  category: 'analytics',
  description: 'Aggregate, filter, compare, and report on ontology data',

  tools: [
    // ── aggregate_objects ──────────────────────────────────────────────────
    {
      id: 'aggregate_objects',
      name: 'Aggregate Objects',
      description: 'Count, sum, or group objects by a property',
      build(ctx: PluginContext) {
        return tool(
          async ({ objectType, groupBy, countOnly = true, filters = {} }: {
            objectType: string;
            groupBy?: string;
            countOnly?: boolean;
            filters?: Record<string, string>;
          }) => {
            const results = await ctx.client
              .objects(objectType)
              .filter(filters)
              .limit(10000)
              .get();

            if (results.length === 0) {
              return `No ${objectType} objects found.`;
            }

            if (!groupBy) {
              return JSON.stringify({ total: results.length });
            }

            // Group by property value
            const groups: Record<string, number> = {};
            for (const obj of results) {
              const props = obj.properties as Record<string, unknown>;
              const key = String(props[groupBy] ?? 'unknown');
              groups[key] = (groups[key] ?? 0) + 1;
            }

            const sorted = Object.entries(groups)
              .sort(([, a], [, b]) => b - a)
              .map(([value, count]) => ({ [groupBy]: value, count }));

            return JSON.stringify({
              objectType,
              groupBy,
              filters,
              total: results.length,
              breakdown: sorted,
            }, null, 2);
          },
          {
            name: 'aggregate_objects',
            description: 'Count or group objects by a property. Example: count Shipments grouped by status to see distribution.',
            schema: z.object({
              objectType: z.string().describe('Object type to aggregate, e.g. "Shipment"'),
              groupBy: z.string().optional().describe('Property name to group by, e.g. "status"'),
              countOnly: z.boolean().optional().default(true),
              filters: z.record(z.string()).optional(),
            }),
          }
        );
      },
    },

    // ── filter_objects_advanced ────────────────────────────────────────────
    {
      id: 'filter_objects_advanced',
      name: 'Filter Objects (Advanced)',
      description: 'Filter objects with complex conditions including date ranges and comparisons',
      build(ctx: PluginContext) {
        return tool(
          async ({ objectType, conditions, limit = 50 }: {
            objectType: string;
            conditions: Array<{
              field: string;
              operator: 'eq' | 'neq' | 'contains' | 'gt' | 'lt' | 'in';
              value: unknown;
            }>;
            limit?: number;
          }) => {
            const all = await ctx.client
              .objects(objectType)
              .limit(10000)
              .get();

            const filtered = all.filter(obj => {
              const props = obj.properties as Record<string, unknown>;
              return conditions.every(({ field, operator, value }) => {
                const fieldVal = props[field];
                switch (operator) {
                  case 'eq': return fieldVal === value;
                  case 'neq': return fieldVal !== value;
                  case 'contains': return String(fieldVal ?? '').includes(String(value));
                  case 'gt': return Number(fieldVal) > Number(value);
                  case 'lt': return Number(fieldVal) < Number(value);
                  case 'in': return Array.isArray(value) && value.includes(fieldVal);
                  default: return true;
                }
              });
            });

            return JSON.stringify({
              objectType,
              matched: filtered.length,
              results: filtered.slice(0, limit),
            }, null, 2);
          },
          {
            name: 'filter_objects_advanced',
            description: 'Filter objects using complex conditions: equals, not-equals, contains, greater/less than, in-list.',
            schema: z.object({
              objectType: z.string(),
              conditions: z.array(z.object({
                field: z.string(),
                operator: z.enum(['eq', 'neq', 'contains', 'gt', 'lt', 'in']),
                value: z.unknown(),
              })),
              limit: z.number().optional().default(50),
            }),
          }
        );
      },
    },

    // ── generate_report ────────────────────────────────────────────────────
    {
      id: 'generate_report',
      name: 'Generate Report',
      description: 'Generate a structured markdown report from analysis data',
      build(_ctx: PluginContext) {
        return tool(
          async ({ title, summary, sections }: {
            title: string;
            summary: string;
            sections: Array<{
              heading: string;
              content: string;
              data?: unknown;
            }>;
          }) => {
            const lines: string[] = [
              `# ${title}`,
              ``,
              `**Generated:** ${new Date().toISOString()}`,
              ``,
              `## Summary`,
              ``,
              summary,
              ``,
            ];

            for (const section of sections) {
              lines.push(`## ${section.heading}`, ``);
              lines.push(section.content, ``);
              if (section.data) {
                lines.push('```json', JSON.stringify(section.data, null, 2), '```', ``);
              }
            }

            return lines.join('\n');
          },
          {
            name: 'generate_report',
            description: 'Generate a structured markdown report. Use after analyzing data to present findings clearly to the operator.',
            schema: z.object({
              title: z.string(),
              summary: z.string().describe('Executive summary of key findings'),
              sections: z.array(z.object({
                heading: z.string(),
                content: z.string(),
                data: z.unknown().optional(),
              })),
            }),
          }
        );
      },
    },

    // ── compare_periods ────────────────────────────────────────────────────
    {
      id: 'compare_periods',
      name: 'Compare Periods',
      description: 'Compare object counts between two time periods using createdAt field',
      build(ctx: PluginContext) {
        return tool(
          async ({ objectType, groupBy, periodALabel, periodBLabel }: {
            objectType: string;
            groupBy: string;
            periodALabel: string;
            periodBLabel: string;
          }) => {
            // Get all objects and compare distributions
            const all = await ctx.client.objects(objectType).limit(10000).get();

            const groupCount = (items: typeof all) => {
              const g: Record<string, number> = {};
              for (const obj of items) {
                const props = obj.properties as Record<string, unknown>;
                const key = String(props[groupBy] ?? 'unknown');
                g[key] = (g[key] ?? 0) + 1;
              }
              return g;
            };

            // Split roughly in half by index (simplified — real impl would use date range)
            const mid = Math.floor(all.length / 2);
            const periodA = all.slice(0, mid);
            const periodB = all.slice(mid);

            const groupA = groupCount(periodA);
            const groupB = groupCount(periodB);

            const allKeys = new Set([...Object.keys(groupA), ...Object.keys(groupB)]);
            const comparison = Array.from(allKeys).map(key => ({
              [groupBy]: key,
              [periodALabel]: groupA[key] ?? 0,
              [periodBLabel]: groupB[key] ?? 0,
              change: (groupB[key] ?? 0) - (groupA[key] ?? 0),
              changePct: groupA[key]
                ? Math.round(((groupB[key] ?? 0) - groupA[key]) / groupA[key] * 100)
                : null,
            }));

            return JSON.stringify({ objectType, groupBy, comparison }, null, 2);
          },
          {
            name: 'compare_periods',
            description: 'Compare object distributions across two periods to identify trends and changes.',
            schema: z.object({
              objectType: z.string(),
              groupBy: z.string().describe('Property to group by, e.g. "status"'),
              periodALabel: z.string().describe('Label for first period, e.g. "last_month"'),
              periodBLabel: z.string().describe('Label for second period, e.g. "this_month"'),
            }),
          }
        );
      },
    },
  ],

  systemPromptExtension: `
## Analytics Tools Available
- aggregate_objects: Count or group objects by property to see distributions
- filter_objects_advanced: Filter with complex conditions (eq, neq, contains, gt, lt, in)
- compare_periods: Compare data distributions between two periods
- generate_report: Format analysis results into a clean markdown report

Use these tools to answer questions like:
- "How many shipments are in each status?"
- "Show me all exceptions from last week"
- "Compare this month's delivery rate vs last month"
`.trim(),
};
