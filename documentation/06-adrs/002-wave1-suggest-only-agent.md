---
status: reviewed
sources:
  - path: resources/pahami dahulu konteks dari berikut.md
    sections: ["Agent layer", "MVP"]
  - path: resources/Memahami_Ontology_Foundational_Reading_C-Level_ABC_Express.pdf
    sections: ["Wave 1"]
last_verified: 2026-05-18
---

# ADR 002: Wave 1 suggest-only agent

## Status

Accepted for Wave 1 (Jul–Sep 2026).

## Context

Agents with direct write access create audit and safety risk before ontology and action types are battle-tested.

## Decision

Wave 1 agent may **read** ontology and **propose** actions. All mutations require explicit human approval via HITL before `executeAction`.

## Consequences

- Lower automation ROI initially; higher trust and compliance
- UI must surface proposals inline (not side-channel chat only)
- Autonomous loops deferred to later waves with expanded action allowlists

## Related

- [agent-operating-loop](../04-product/agent-operating-loop.md)
- [security-agent-governance](../03-architecture/security-agent-governance.md)
