import type { OntologyEngine } from '@daemon/ontology-engine';
import type { OntologyClient, ActionProposer } from '@daemon/ontology-sdk';
import type { StructuredToolInterface } from '@langchain/core/tools';
import type { Redis } from 'ioredis';

// ─── Plugin Categories ────────────────────────────────────────────────────────

export type PluginCategory =
  | 'ontology'    // core object/schema/action operations
  | 'analytics'   // aggregation, filtering, reporting
  | 'monitoring'  // SLA, anomaly detection, alerting
  | 'integration' // external APIs, ERPs, webhooks
  | 'custom';     // client-specific custom plugins

// ─── Plugin Context ───────────────────────────────────────────────────────────
// Injected into every plugin at initialization time

export interface PluginContext {
  tenantId: string;
  engine: OntologyEngine;
  client: OntologyClient;
  proposer: ActionProposer;
  redis?: Redis;
  /** Plugin-specific config from tenant config */
  config: Record<string, unknown>;
}

// ─── Plugin Resolution Input ─────────────────────────────────────────────────

export interface PluginActivationConfig {
  activePlugins?: string[];
  activeSkills?: string[];
  pluginConfig?: Record<string, Record<string, unknown>>;
}

// ─── Tool Definition ──────────────────────────────────────────────────────────

export interface ToolDefinition {
  /** Unique tool ID within plugin, e.g. "aggregate_objects" */
  id: string;
  /** Human-readable name for LLM */
  name: string;
  /** Description that LLM uses to decide when to call this tool */
  description: string;
  /** Build the actual LangChain tool instance from context */
  build(ctx: PluginContext): StructuredToolInterface;
}

// ─── SubAgent Definition ──────────────────────────────────────────────────────

export interface SubAgentDefinition {
  name: string;
  description: string;
  systemPrompt: string;
  /** Tool IDs (within this plugin) that this subagent can use */
  toolIds: string[];
}

// ─── Plugin Interface ─────────────────────────────────────────────────────────

export interface DaemonPlugin {
  /** Unique plugin ID, e.g. "analytics/aggregate" */
  id: string;
  /** Display name */
  name: string;
  /** Semver version */
  version: string;
  /** Category */
  category: PluginCategory;
  /** Short description for UI */
  description: string;
  /** Tools this plugin provides */
  tools: ToolDefinition[];
  /** Optional subagents this plugin provides */
  subagents?: SubAgentDefinition[];
  /** Optional system prompt extension injected into root agent */
  systemPromptExtension?: string;
  /** Called once when plugin is activated for a tenant */
  initialize?(ctx: PluginContext): Promise<void>;
  /** Called when plugin is deactivated */
  destroy?(): Promise<void>;
}

// ─── Skill Definition ─────────────────────────────────────────────────────────
// A skill bundles multiple plugins for a specific domain use case

export interface DaemonSkill {
  /** Unique skill ID, e.g. "logistics-analyst" */
  id: string;
  /** Display name */
  name: string;
  /** Description for tenant admin UI */
  description: string;
  /** Plugin IDs that this skill activates */
  pluginIds: string[];
  /** Domain-specific system prompt prepended to root agent */
  systemPrompt: string;
  /** Roles allowed to use this skill */
  allowedRoles: string[];
  /** Optional per-plugin config overrides */
  pluginConfig?: Record<string, Record<string, unknown>>;
}

// ─── Resolved Plugin State ────────────────────────────────────────────────────

export interface ActivePlugin {
  plugin: DaemonPlugin;
  ctx: PluginContext;
  tools: StructuredToolInterface[];
}

// ─── Plugin Manifest (for external HTTP plugins) ──────────────────────────────

export interface ExternalPluginManifest {
  id: string;
  name: string;
  version: string;
  category: PluginCategory;
  description: string;
  endpoint: string;         // Base URL of plugin HTTP server
  tools: Array<{
    id: string;
    name: string;
    description: string;
    inputSchema: Record<string, unknown>; // JSON Schema
  }>;
  systemPromptExtension?: string;
}
