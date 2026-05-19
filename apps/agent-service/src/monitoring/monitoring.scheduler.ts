import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { OntologyEngine } from '@daemon/ontology-engine';
import type { OntologyClient, ActionProposer } from '@daemon/ontology-sdk';
import type { Redis } from 'ioredis';
import type { TenantAgentConfig, TenantConfigStore } from '../config/tenant-config.store.js';
import type { ModelConfig } from '../model/model.factory.js';
import type { RootAgent, RootAgentContext } from '../agents/root.agent.js';
import type { ControlPlaneLogClient } from './control-plane-log.client.js';

const MONITORING_PROMPT = `Run a monitoring pass for this tenant.
Use read_schema first to discover object and action types.
Check for SLA breaches, anomalous status distributions, and worsening trends.
If you find a critical issue, call send_alert with severity warning or critical.
Do not execute actions directly. If an operational action is needed, only propose it and explain why.
Return a concise JSON-like summary with findings, alertsSent, and recommendedFollowUp.`;

export interface MonitoringRunResult {
  status: 'success' | 'error';
  tenantId: string;
  startedAt: string;
  finishedAt: string;
  summary?: string;
  error?: string;
}

export interface MonitoringSchedulerStatus {
  enabled: boolean;
  running: boolean;
  intervalMs: number;
  lastRunAt: string | null;
  lastResult: MonitoringRunResult | null;
  lastError: string | null;
}

export interface MonitoringSchedulerDeps {
  tenantId: string;
  enabled?: boolean;
  intervalMs: number;
  redis: Redis;
  engine: OntologyEngine;
  modelConfig: ModelConfig;
  configStore: TenantConfigStore;
  logClient: ControlPlaneLogClient;
  modelFactory(config: TenantAgentConfig | null, envConfig: ModelConfig): BaseChatModel;
  createClient(engine: OntologyEngine, redis: Redis, tenantId: string): OntologyClient;
  createProposer(redis: Redis, tenantId: string): ActionProposer;
  createAgent(ctx: RootAgentContext): Promise<RootAgent>;
}

export class MonitoringScheduler {
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private lastRunAt: string | null = null;
  private lastResult: MonitoringRunResult | null = null;
  private lastError: string | null = null;

  constructor(private readonly deps: MonitoringSchedulerDeps) {}

  start(): void {
    if (!this.deps.enabled || this.timer) return;
    this.timer = setInterval(() => {
      void this.runOnce();
    }, this.deps.intervalMs);
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  getStatus(): MonitoringSchedulerStatus {
    return {
      enabled: Boolean(this.deps.enabled),
      running: this.running,
      intervalMs: this.deps.intervalMs,
      lastRunAt: this.lastRunAt,
      lastResult: this.lastResult,
      lastError: this.lastError,
    };
  }

  async runOnce(): Promise<MonitoringRunResult> {
    const startedAt = new Date().toISOString();
    this.running = true;
    this.lastRunAt = startedAt;

    try {
      const tenantConfig = await this.deps.configStore.get(this.deps.tenantId);
      const activeSkills = Array.from(new Set([...(tenantConfig?.activeSkills ?? []), 'monitoring']));
      const model = this.deps.modelFactory(tenantConfig, this.deps.modelConfig);
      const client = this.deps.createClient(this.deps.engine, this.deps.redis, this.deps.tenantId);
      const proposer = this.deps.createProposer(this.deps.redis, this.deps.tenantId);

      const agent = await this.deps.createAgent({
        tenantId: this.deps.tenantId,
        model,
        engine: this.deps.engine,
        client,
        proposer,
        redis: this.deps.redis,
        systemPromptPrefix: tenantConfig?.systemPromptPrefix,
        actionAllowlist: tenantConfig?.actionAllowlist,
        activeSkills,
        activePlugins: tenantConfig?.activePlugins,
        pluginConfig: tenantConfig?.pluginConfig,
      });

      const response = await agent.invoke({
        messages: [{ role: 'user', content: MONITORING_PROMPT }],
      });

      const messages = response.messages ?? [];
      const lastMessage = messages[messages.length - 1];
      const summary = typeof lastMessage?.content === 'string'
        ? lastMessage.content
        : JSON.stringify(lastMessage?.content ?? null);

      const result: MonitoringRunResult = {
        status: 'success',
        tenantId: this.deps.tenantId,
        startedAt,
        finishedAt: new Date().toISOString(),
        summary,
      };

      this.lastResult = result;
      this.lastError = null;
      await this.deps.redis.set(`monitor:last-run:${this.deps.tenantId}`, JSON.stringify(result));
      await this.deps.logClient.push({
        level: 'info',
        message: `Monitoring run completed for ${this.deps.tenantId}: ${summary}`,
      });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const result: MonitoringRunResult = {
        status: 'error',
        tenantId: this.deps.tenantId,
        startedAt,
        finishedAt: new Date().toISOString(),
        error: message,
      };

      this.lastResult = result;
      this.lastError = message;
      await this.deps.redis.set(`monitor:last-run:${this.deps.tenantId}`, JSON.stringify(result));
      await this.deps.logClient.push({
        level: 'error',
        message: `Monitoring run failed for ${this.deps.tenantId}: ${message}`,
      });
      return result;
    } finally {
      this.running = false;
    }
  }
}
