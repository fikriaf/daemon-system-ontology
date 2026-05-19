import type { DaemonSkill } from '../types/plugin.types.js';

export class SkillRegistry {
  private skills = new Map<string, DaemonSkill>();

  register(skill: DaemonSkill): void {
    if (this.skills.has(skill.id)) {
      throw new Error(`Skill "${skill.id}" is already registered`);
    }
    this.skills.set(skill.id, skill);
    console.log(`[skill-registry] registered: ${skill.id}`);
  }

  registerAll(skills: DaemonSkill[]): void {
    for (const skill of skills) {
      this.register(skill);
    }
  }

  get(skillId: string): DaemonSkill | undefined {
    return this.skills.get(skillId);
  }

  has(skillId: string): boolean {
    return this.skills.has(skillId);
  }

  list(): DaemonSkill[] {
    return Array.from(this.skills.values());
  }

  listForRole(role: string): DaemonSkill[] {
    return this.list().filter(s => s.allowedRoles.includes(role));
  }

  /**
   * Resolve a set of skill IDs into:
   * - merged list of plugin IDs to activate
   * - merged system prompt
   * - merged plugin config
   */
  resolve(skillIds: string[]): {
    pluginIds: string[];
    systemPrompt: string;
    pluginConfig: Record<string, Record<string, unknown>>;
  } {
    const pluginIds = new Set<string>();
    const systemPrompts: string[] = [];
    const pluginConfig: Record<string, Record<string, unknown>> = {};

    for (const id of skillIds) {
      const skill = this.skills.get(id);
      if (!skill) {
        console.warn(`[skill-registry] skill "${id}" not found — skipping`);
        continue;
      }

      skill.pluginIds.forEach(pid => pluginIds.add(pid));
      if (skill.systemPrompt) systemPrompts.push(skill.systemPrompt);
      if (skill.pluginConfig) {
        Object.assign(pluginConfig, skill.pluginConfig);
      }
    }

    return {
      pluginIds: Array.from(pluginIds),
      systemPrompt: systemPrompts.join('\n\n'),
      pluginConfig,
    };
  }
}
