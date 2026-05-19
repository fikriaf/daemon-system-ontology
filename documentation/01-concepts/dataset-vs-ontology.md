---
status: reviewed
sources:
  - url: https://www.palantir.com/docs/foundry/ontology/core-concepts/
  - path: resources/Memahami_Ontology_Foundational_Reading_C-Level_ABC_Express.pdf
    sections: ["Prinsip Single Source of Truth"]
last_verified: 2026-05-18
---

# Dataset vs ontology

## Dataset (data layer)

- Rows in tables, files, streams, or lakehouse tables
- Optimized for storage, ETL, and analytics
- May duplicate the same real-world entity across systems (CRM customer ≠ finance customer)

## Ontology (semantic layer)

- **Meaning**: what is a Customer, Shipment, or LegalEntity in this company?
- **Governance**: who owns the definition, which properties are required, allowed transitions
- **Operations**: actions and audit, not ad-hoc SQL updates from apps

## Pipeline relationship

```
Datasource → Transform → Ontology → Workflow applications
```

Applications should **read and write through the ontology** (or sync into it), not bypass it with shadow databases for core entities.

## Why it matters for agents

An agent that only queries raw tables inherits **ambiguous definitions**. An agent grounded in ontology uses the same Shipment lifecycle and LegalEntity rules as finance and operations.

## Further reading

- [Pipeline stages](../03-architecture/pipeline-stages.md)
- Palantir: [Core concepts](https://www.palantir.com/docs/foundry/ontology/core-concepts/)
