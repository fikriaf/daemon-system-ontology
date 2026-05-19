import type {
  DaemonPlugin,
  PluginContext,
  ActivePlugin,
} from '../types/plugin.types.js';

export class PluginRegistry {
  private plugins = new Map<string, DaemonPlugin>();

  /** Register a plugin definition (call at startup) */
  register(plugin: DaemonPlugin): void {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Plugin "${plugin.id}" is already registered`);
    }
    this.plugins.set(plugin.id, plugin);
    console.log(`[plugin-registry] registered: ${plugin.id} v${plugin.version}`);
  }

  /** Register multiple plugins at once */
  registerAll(plugins: DaemonPlugin[]): void {
    for (const plugin of plugins) {
      this.register(plugin);
    }
  }

  /** Check if plugin is registered */
  has(pluginId: string): boolean {
    return this.plugins.has(pluginId);
  }

  /** Get plugin definition by ID */
  get(pluginId: string): DaemonPlugin | undefined {
    return this.plugins.get(pluginId);
  }

  /** List all registered plugins */
  list(): DaemonPlugin[] {
    return Array.from(this.plugins.values());
  }

  /** List plugins by category */
  listByCategory(category: DaemonPlugin['category']): DaemonPlugin[] {
    return this.list().filter(p => p.category === category);
  }

  /**
   * Activate a set of plugins for a specific tenant context.
   * Calls initialize() on each plugin and builds tool instances.
   */
  async activate(pluginIds: string[], ctx: PluginContext): Promise<ActivePlugin[]> {
    const active: ActivePlugin[] = [];

    for (const id of pluginIds) {
      const plugin = this.plugins.get(id);
      if (!plugin) {
        console.warn(`[plugin-registry] plugin "${id}" not found — skipping`);
        continue;
      }

      try {
        if (plugin.initialize) {
          await plugin.initialize(ctx);
        }

        const tools = plugin.tools.map(toolDef => toolDef.build(ctx));

        active.push({ plugin, ctx, tools });
        console.log(`[plugin-registry] activated: ${id} for tenant ${ctx.tenantId}`);
      } catch (err) {
        console.error(`[plugin-registry] failed to activate "${id}":`, err);
      }
    }

    return active;
  }

  /** Deactivate (cleanup) active plugins */
  async deactivate(active: ActivePlugin[]): Promise<void> {
    for (const { plugin } of active) {
      try {
        if (plugin.destroy) {
          await plugin.destroy();
        }
      } catch (err) {
        console.error(`[plugin-registry] error during destroy of "${plugin.id}":`, err);
      }
    }
  }
}
