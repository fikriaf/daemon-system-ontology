---
status: reviewed
sources:
  - url: https://www.palantir.com/docs/foundry/action-types/overview/
  - path: resources/pahami dahulu konteks dari berikut.md
    sections: ["Action layer"]
last_verified: 2026-05-18
---

# Action types

**Action types** are governed mutations on the ontology: permissions, validation, side effects, and **audit**.

[Action types overview](https://www.palantir.com/docs/foundry/action-types/overview/)

## Daemon rule

All writes from applications and agents go through action types (see [ADR 003](../06-adrs/003-single-execute-action.md)).

## Wave 1 agent

Agent may **propose** actions; human approves; runtime calls `executeAction` once. No direct database patches from the LLM.

## Example categories (illustrative)

| Category | Example action |
|----------|----------------|
| Shipment | `transitionShipmentState` |
| Exception | `assignExceptionOwner` |
| Interco | `markIntercoEliminated` |

Exact action catalog: TBD with v0.2.
