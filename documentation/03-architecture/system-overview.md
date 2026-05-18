---
status: draft
sources:
  - path: resources/pahami dahulu konteks dari berikut.md
    sections: ["Bentuk produk", "Modul produk"]
  - path: resources/Memahami_Ontology_Foundational_Reading_C-Level_ABC_Express.pdf
    sections: ["Bab 4–5"]
last_verified: 2026-05-18
---

# System overview

**Status: draft** — target architecture; no `ontology-engine` implementation in repo yet.

```mermaid
flowchart TB
  subgraph lang [ontology-language]
    YAML[Schemas YAML]
  end
  subgraph engine [ontology-engine planned]
    RT[Runtime + policies]
    FN[Functions]
    ACT[Action executor]
  end
  subgraph sdk [ontology-sdk planned]
    API[Typed client]
  end
  subgraph apps [Applications]
    OPS[Ops Control Tower]
    FIN[Financial Governance]
  end
  subgraph agent [Agent runtime planned]
    LG[LangGraph]
  end
  YAML --> RT
  RT --> FN
  RT --> ACT
  API --> RT
  OPS --> API
  FIN --> API
  LG --> API
  LG --> ACT
```

## Package responsibilities

| Package | Responsibility |
|---------|----------------|
| `ontology-language` | Declarative types *(schemas TBD)* |
| `ontology-engine` | Validation, functions, action execution, audit |
| `ontology-sdk` | Application & agent consumer API |
| Applications | Workflow UIs |
| Agent | Propose + HITL; no shadow writes |
