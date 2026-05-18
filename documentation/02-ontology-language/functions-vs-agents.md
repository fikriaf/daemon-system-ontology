---
status: reviewed
sources:
  - url: https://www.palantir.com/docs/foundry/functions/overview/
  - url: https://www.palantir.com/docs/foundry/ontology/ontology-best-practices-and-anti-patterns/
  - path: resources/pahami dahulu konteks dari berikut.md
    sections: ["Agent layer", "INTERPRET"]
last_verified: 2026-05-18
---

# Functions vs agents

Critical boundary: **do not use an LLM as the rules engine.**

## Ontology functions (deterministic)

| Attribute | Detail |
|-----------|--------|
| Runs in | `ontology-engine` *(planned)* |
| Input | Object IDs, properties, links |
| Output | Booleans, scores, enums, structured facts |
| Examples | SLA breached?, interco pair valid?, exception severity |
| Testing | Unit tests, no model stochasticity |

[Functions overview](https://www.palantir.com/docs/foundry/functions/overview/)

## LangGraph agent (stochastic)

| Attribute | Detail |
|-----------|--------|
| Runs in | Agent runtime *(planned)* |
| Input | Function outputs + user context |
| Output | Natural language, ranked **proposals** |
| Must not | Direct SQL/ORM writes, skip action types |

## Operating loop

```
OBSERVE (SDK read)
  → INTERPRET (functions only)
  → PROPOSE (LLM)
  → GATE (HITL)
  → ACT (executeAction)
  → RECORD (audit)
```

## Anti-pattern

Encoding business rules only in prompts — violates Palantir [anti-patterns](https://www.palantir.com/docs/foundry/ontology/ontology-best-practices-and-anti-patterns/) guidance. See [best-practices-checklist](best-practices-checklist.md).
