---
status: draft
sources:
  - url: https://www.palantir.com/docs/foundry/action-types/overview/
  - path: resources/pahami dahulu konteks dari berikut.md
    sections: ["Action layer"]
last_verified: 2026-05-18
---

# ADR 003: Single execute-action write path

## Status

Draft — implement with `ontology-engine`.

## Context

Multiple write paths (REST ad-hoc, SQL, agent tools) break auditability and enable OWASP LLM excessive-agency failures.

## Decision

Applications and agents mutate ontology **only** through `executeAction(actionTypeId, payload)` implemented by the engine against registered action types.

## Consequences

- All writes auditable and permission-checked uniformly
- Agent tool surface is finite (action type catalog)
- Slightly higher latency vs raw DB updates

## Related

- [action-types](../02-ontology-language/action-types.md)
- [functions-vs-agents](../02-ontology-language/functions-vs-agents.md)
