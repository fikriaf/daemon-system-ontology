# Client Monitoring Agent Design

**Date:** 2026-05-19
**Status:** Approved for implementation
**Scope:** Plan 16 — scheduled client-side monitoring agent in `apps/agent-service`

## Context

Plan 15 introduced runtime plugin activation through `@daemon/plugin-sdk`, including `monitoring/core` tools for SLA checks, anomaly detection, trend analysis, and alerting. Plan 16 proves that plugin system in an autonomous background loop by running a monitoring-capable agent on a schedule for each tenant instance.

This remains a Wave 1 safe agent. It observes, analyzes, and alerts. It must not execute ontology actions directly. Any action proposal still goes through `propose_action` and human approval.

## Chosen Approach

Use an **Agent-Driven Scheduled Monitor**.

The scheduler invokes the existing root agent with the `monitoring` skill active. The agent uses dynamically resolved plugin tools, especially `check_sla`, `detect_anomaly`, `get_trend`, and `send_alert`. After each run, the scheduler records status locally and pushes a structured log event to the control plane.

Alternative approaches were rejected for this phase:

- Deterministic worker only: simpler, but does not validate the plugin/agent runtime path.
- Hybrid deterministic scan plus agent summary: likely production direction later, but too broad for this incremental plan.

## Components

### `MonitoringScheduler`

Lives in `apps/agent-service/src/monitoring/monitoring.scheduler.ts`.

Responsibilities:

- start and stop an interval timer
- run one monitoring cycle on demand
- load tenant agent config
- force-enable the `monitoring` skill for this run
- create the tenant model, ontology client, proposer, and root agent
- invoke the root agent with a fixed monitoring prompt
- store the latest run status in memory and Redis
- push success/error logs to control plane if configured
- never throw from background interval ticks

### `ControlPlaneLogClient`

Lives in `apps/agent-service/src/monitoring/control-plane-log.client.ts`.

Responsibilities:

- send a POST request to `${controlPlaneUrl}/logs/receive`
- include `Authorization: Bearer ${controlPlaneSecret}`
- format monitoring result as a control-plane log payload
- fail soft when control-plane logging is unavailable

### Monitoring Routes

Added to `apps/agent-service/src/server.ts`.

- `POST /agent/monitor/run`: trigger one monitoring cycle manually
- `GET /agent/monitor/status`: inspect scheduler state, latest result, and latest error

These routes are intended for internal operators or the control plane. This plan does not add a new auth layer to agent-service; deployment should keep agent-service private as already assumed by the single-tenant architecture.

## Configuration

Extend `AgentServerConfig` with optional monitoring settings:

- `monitoringEnabled?: boolean`
- `monitoringIntervalMs?: number`
- `controlPlaneUrl?: string`
- `controlPlaneSecret?: string`

Environment variables can map into these in `apps/agent-service/src/index.ts`:

- `MONITORING_ENABLED=true|false`
- `MONITORING_INTERVAL_MS=300000`
- `CONTROL_PLANE_URL=http://control-plane:4000`
- `CONTROL_PLANE_SECRET=...`

Default behavior:

- disabled unless `MONITORING_ENABLED=true`
- interval defaults to 5 minutes when enabled
- manual endpoint still works even when scheduled interval is disabled

## Data Flow

1. Timer fires or `POST /agent/monitor/run` is called.
2. Scheduler loads tenant config from Redis.
3. Scheduler merges tenant config with `activeSkills: ['monitoring']` for this run.
4. Scheduler creates model via `createModelFromConfig`.
5. Scheduler creates `OntologyClient` and `ActionProposer` for the tenant.
6. Scheduler calls `createRootAgent` with monitoring skill enabled.
7. Agent invokes monitoring tools and optionally calls `send_alert`.
8. Scheduler stores result under `monitor:last-run:{tenantId}` in Redis.
9. Scheduler pushes a structured log to control plane when `controlPlaneUrl` is configured.
10. `GET /agent/monitor/status` returns in-memory status and latest result summary.

## Monitoring Prompt

The scheduled prompt should be deterministic and bounded:

```text
Run a monitoring pass for this tenant.
Use read_schema first to discover object and action types.
Check for SLA breaches, anomalous status distributions, and worsening trends.
If you find a critical issue, call send_alert with severity warning or critical.
Do not execute actions directly. If an operational action is needed, only propose it and explain why.
Return a concise JSON-like summary with findings, alertsSent, and recommendedFollowUp.
```

## Safety And Governance

- The scheduler is fail-soft: interval runs catch errors and update `lastError`.
- The agent is still governed by HITL. No code path calls `executeAction` directly.
- The monitoring run forces only the `monitoring` skill in addition to tenant-configured plugins; it does not bypass the action allowlist.
- Control-plane logging is best-effort and must not fail the monitoring run.
- Alert payloads should contain operational metadata, not secrets or credentials.

## Testing

Add unit tests under `apps/agent-service/src/__tests__/monitoring-scheduler.test.ts`.

Required coverage:

- `runOnce()` creates a root agent with `activeSkills: ['monitoring']`.
- `runOnce()` stores latest result in Redis.
- `runOnce()` pushes a control-plane log on success when configured.
- `runOnce()` records `lastError` and pushes an error log when agent invocation fails.
- `start()` schedules interval and `stop()` clears it.
- `POST /agent/monitor/run` triggers a run.
- `GET /agent/monitor/status` returns current state.

## Out Of Scope

- Daemon Internal Agent in control plane.
- UI dashboard for alerts.
- Deterministic pre-scan optimization.
- Multi-tenant agent-service process. Current model remains one tenant instance per client.
- Direct autonomous action execution.

## Success Criteria

- Full test suite remains passing.
- Agent-service exposes manual run and status routes.
- Scheduled monitoring can be enabled via env config.
- Monitoring runs activate `monitoring/core` dynamically through Plan 15 plugin infrastructure.
- Monitoring results are visible both locally and in control-plane logs when configured.
