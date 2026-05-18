---
status: draft
sources:
  - path: resources/pahami dahulu konteks dari berikut.md
    sections: ["Agent layer", "Governance"]
  - url: https://www.palantir.com/docs/foundry/action-types/overview/
last_verified: 2026-05-18
---

# Security and agent governance

**Status: draft** — pending ADR approval.

## Threat model (agent)

| Risk | Mitigation |
|------|------------|
| Excessive agency (OWASP LLM06) | Single `executeAction`; allowlisted actions |
| Shadow writes | No direct DB/API mutations from LLM tools |
| Cross-entity leakage | `legalEntityId` scoping on reads and actions |
| Unaudited changes | Action type audit log mandatory |

## Human-in-the-loop

Wave 1: every mutating action requires explicit human approval before execution.

## Roles

- **Business owner** approves ontology structural changes (Validation Kit Paket D)
- **Operator** approves agent-proposed operational actions
- **Agent** never approves its own proposals

See [ADR 002](../06-adrs/002-wave1-suggest-only-agent.md), [ADR 003](../06-adrs/003-single-execute-action.md).
