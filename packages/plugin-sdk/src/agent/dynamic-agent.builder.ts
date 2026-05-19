import type { SubAgent } from 'deepagents';
import type { StructuredToolInterface } from '@langchain/core/tools';
import { createDefaultPluginRegistry } from '../defaults/default.plugins.js';
import { createDefaultSkillRegistry } from '../defaults/default.skills.js';
import type {
  ActivePlugin,
  PluginActivationConfig,
  PluginContext,
} from '../types/plugin.types.js';

export interface DynamicAgentBuildResult {
  tools: StructuredToolInterface[];
  subagents: SubAgent[];
  systemPromptExtension: string;
  activePlugins: ActivePlugin[];
}

export class DynamicAgentBuilder {
  constructor(
    private readonly pluginRegistry = createDefaultPluginRegistry(),
    private readonly skillRegistry = createDefaultSkillRegistry()
  ) {}

  async build(
    ctx: PluginContext,
    config: PluginActivationConfig = {}
  ): Promise<DynamicAgentBuildResult> {
    const skillResolution = this.skillRegistry.resolve(config.activeSkills ?? []);
    const pluginIds = Array.from(new Set([
      'ontology/core',
      ...skillResolution.pluginIds,
      ...(config.activePlugins ?? []),
    ]));

    const mergedPluginConfig = {
      ...skillResolution.pluginConfig,
      ...(config.pluginConfig ?? {}),
    };

    const activePlugins = await this.pluginRegistry.activate(
      pluginIds,
      {
        ...ctx,
        config: {
          ...ctx.config,
          pluginConfig: mergedPluginConfig,
        },
      }
    );

    const tools = activePlugins.flatMap(active => active.tools);
    const subagents = activePlugins.flatMap(active =>
      (active.plugin.subagents ?? []).map(subagent => ({
        name: subagent.name,
        description: subagent.description,
        systemPrompt: subagent.systemPrompt,
        tools: active.tools.filter(tool => subagent.toolIds.includes(tool.name)) as never,
      }))
    );

    const promptParts = [
      skillResolution.systemPrompt,
      ...activePlugins
        .map(active => active.plugin.systemPromptExtension)
        .filter((prompt): prompt is string => Boolean(prompt)),
    ];

    return {
      tools,
      subagents,
      systemPromptExtension: promptParts.join('\n\n'),
      activePlugins,
    };
  }
}
