---
status: reviewed
sources:
  - path: resources/pahami dahulu konteks dari berikut.md
    sections: ["Agent layer", "Modul produk"]
  - path: resources/Validation_Kit_v0.1_ABC_Express.pdf
    sections: ["Wave 1 scope"]
last_verified: 2026-05-18
---

# Agent operating loop

## Stages

| Stage | Owner | Description |
|-------|-------|-------------|
| **OBSERVE** | SDK | Load objects, links, alerts for context |
| **INTERPRET** | Functions | Deterministic rules — SLA, severity, eligibility |
| **PROPOSE** | LLM | Natural language + ranked action proposals |
| **GATE** | Human | Approve, edit, or reject |
| **ACT** | Engine | `executeAction(actionTypeId, payload)` |
| **RECORD** | Engine | Persist audit from action type |
| **SYNC** | Pipelines | Downstream apps refresh from ontology |

## Wave 1 constraint

**Suggest-only:** GATE is mandatory for all mutations. See [ADR 002](../06-adrs/002-wave1-suggest-only-agent.md).

## Boundaries

- [Functions vs agents](../02-ontology-language/functions-vs-agents.md)
- [Security](../03-architecture/security-agent-governance.md)
