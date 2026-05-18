---
status: reviewed
sources:
  - path: resources/pahami dahulu konteks dari berikut.md
    sections: ["Agent layer", "Modul produk"]
  - url: https://www.palantir.com/docs/foundry/action-types/overview/
last_verified: 2026-05-18
---

# Four layers

Product architecture groups concerns into four layers. Action types sit at the boundary between logic and change.

## 1. Data layer

Ingestion and transformation: connectors, pipelines, quality checks. Output feeds the ontology but is not the system of record for business meaning.

## 2. Logic layer

**Functions** and declarative rules: SLA breach, interco eligibility, exception classification. Deterministic; testable without an LLM.

## 3. Action layer

**Action types**: the only approved way to change ontology state (assign exception owner, post interco elimination, transition shipment state). Every action emits audit events.

## 4. Security layer

Authorization, `legalEntityId` scoping, role-based views, agent HITL gates. OWASP LLM risks (e.g. excessive agency) mitigated by **single write path** — see [security-agent-governance](../03-architecture/security-agent-governance.md).

## UI archetypes (presentation)

Applications map to archetypes (Command Center, Monitor, Workbench, Desk) — see [ui-archetypes](../04-product/ui-archetypes.md). Presentation may use Blueprint/Plottable-style components; business rules remain in ontology functions, not in the UI alone.
