import type { DaemonSkill } from '../types/plugin.types.js';
import { SkillRegistry } from '../registry/skill.registry.js';

export const defaultSkills: DaemonSkill[] = [
  {
    id: 'analytics',
    name: 'Analytics Analyst',
    description: 'Analyze ontology data with aggregation, filtering, comparisons, and reports.',
    pluginIds: ['ontology/core', 'analytics/core'],
    allowedRoles: ['viewer', 'operator', 'admin'],
    systemPrompt: 'You are an analytics analyst. Use analytics tools to quantify patterns before making recommendations.',
  },
  {
    id: 'monitoring',
    name: 'Monitoring Agent',
    description: 'Monitor ontology data for SLA breaches, anomalies, trends, and alerts.',
    pluginIds: ['ontology/core', 'monitoring/core'],
    allowedRoles: ['operator', 'admin'],
    systemPrompt: 'You are a monitoring agent. Proactively identify operational risk, explain evidence, and alert when attention is required.',
  },
];

export function createDefaultSkillRegistry(): SkillRegistry {
  const registry = new SkillRegistry();
  registry.registerAll(defaultSkills);
  return registry;
}
