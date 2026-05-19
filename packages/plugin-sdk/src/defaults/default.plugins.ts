import type { DaemonPlugin } from '../types/plugin.types.js';
import { analyticsPlugin } from '../plugins/analytics/analytics.plugin.js';
import { monitoringPlugin } from '../plugins/monitoring/monitoring.plugin.js';
import { ontologyCorePlugin } from '../plugins/ontology/core.plugin.js';
import { PluginRegistry } from '../registry/plugin.registry.js';

export const defaultPlugins: DaemonPlugin[] = [
  ontologyCorePlugin,
  analyticsPlugin,
  monitoringPlugin,
];

export function createDefaultPluginRegistry(): PluginRegistry {
  const registry = new PluginRegistry();
  registry.registerAll(defaultPlugins);
  return registry;
}
