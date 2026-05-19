---
status: reviewed
sources:
  - url: https://docs.langchain.com/
  - path: resources/pahami dahulu konteks dari berikut.md
    sections: ["Agent layer"]
last_verified: 2026-05-18
---

# LangChain / LangGraph — index

Agent runtime is **out of band** from ontology business rules. Use this index for implementation; boundary rules are in [functions-vs-agents](../02-ontology-language/functions-vs-agents.md).

## LangChain

| Topic | URL |
|-------|-----|
| Docs home | https://docs.langchain.com/ |
| Agents overview | https://docs.langchain.com/oss/python/langchain/agents |
| Middleware (HITL) | https://docs.langchain.com/oss/python/langchain/middleware |

## LangGraph

| Topic | URL |
|-------|-----|
| LangGraph overview | https://docs.langchain.com/oss/python/langgraph/overview |
| Persistence / threads | https://docs.langchain.com/oss/python/langgraph/persistence |
| Human-in-the-loop | https://docs.langchain.com/oss/python/langgraph/interrupts |

## Daemon usage pattern (planned)

1. **Observe** — read ontology via SDK (objects, links, alerts)
2. **Interpret** — call ontology **functions** (no LLM)
3. **Propose** — LLM narrates + ranks actions
4. **Gate** — human approval (interrupt)
5. **Act** — single `executeAction` API
6. **Record** — audit trail from action type

No LangGraph graph definitions exist in this repository yet (TBD).
