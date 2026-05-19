---
status: reviewed
sources:
  - path: resources/Memahami_Ontology_Foundational_Reading_C-Level_ABC_Express.pdf
    sections: ["Prinsip Pertama: Ontology Lebih Dahulu"]
last_verified: 2026-05-18
---

# ADR 001: Ontology before applications

## Status

Accepted (principle from Foundational Reading).

## Context

Traditional builds lock entity definitions inside each application (CRM, TMS, finance), causing conflicting truths and expensive reconciliation.

## Decision

Validate **Object Catalog v0.2** before major application refactor. New workflow UIs consume the ontology via SDK; they do not define core entities locally.

## Consequences

- Slower initial app delivery, faster cross-functional queries later
- Validation Kit is on the critical path
- Platform “Antero v2” aligns to ontology, not the reverse (per Foundational Reading)

## Related

- [design-principles](../01-concepts/design-principles.md)
- [pipeline-stages](../03-architecture/pipeline-stages.md)
