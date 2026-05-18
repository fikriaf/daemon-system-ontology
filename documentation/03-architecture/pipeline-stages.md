---
status: reviewed
sources:
  - url: https://www.palantir.com/docs/foundry/building-pipelines/recommended-project-structure/
  - path: resources/Memahami_Ontology_Foundational_Reading_C-Level_ABC_Express.pdf
    sections: ["pipeline", "ontology layer"]
last_verified: 2026-05-18
---

# Pipeline stages

Recommended enterprise flow (Palantir-aligned):

| Stage | Purpose |
|-------|---------|
| **Datasource** | Connect ERP, TMS, spreadsheets, events |
| **Transform** | Cleanse, conform, join — still dataset-centric |
| **Ontology** | Map datasets to object/link types; sync objects |
| **Workflow applications** | Ops/finance UIs and agents on ontology |

[Recommended project structure](https://www.palantir.com/docs/foundry/building-pipelines/recommended-project-structure/)

## Rule

Workflow apps must not become a second system of record for core entities (Shipment, Customer, Invoice). Writes go through **action types**.
