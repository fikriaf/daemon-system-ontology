---
status: reviewed
sources:
  - path: resources/Memahami_Ontology_Foundational_Reading_C-Level_ABC_Express.pdf
    sections: ["Bab 2 — Lima Prinsip Inti"]
last_verified: 2026-05-18
---

# Design principles

Paraphrase of **Lima Prinsip Inti** from Foundational Reading (April 2026). Read the PDF for full narrative and examples.

## 1. Ontology first, applications second

Define business entities centrally in the ontology **before** (or as a condition for) building or refactoring applications. Avoid three conflicting definitions of “customer” across CRM, finance, and ops.

**Implication:** Object Catalog v0.1 is validated first; platform apps align to it.

## 2. Single source of truth, many faces

Separate **substance** (ontology definitions) from **representation** (dashboards, grids, reports). One Customer type; sales, ops, and finance see different views of the same object.

## 3. Two-way sync, not one-way ETL

Ontology stays **bidirectionally** connected to operational systems: operational changes update the ontology; governed actions in the ontology propagate back. Enables action-oriented analytics (insight → action in one place), not batch-only warehousing.

## 4. Logic as a separate asset

Business rules (pricing, tiers, commission) live as explicit ontology-level logic (functions / rule objects), versioned and reused — not trapped in one spreadsheet or legacy app.

## 5. Actions as first-class citizens

Mutations are formal **action types** with permissions and audit — not undocumented side effects of application code. Supports questions like who approved a price change and when.

## Daemon alignment

| Principle | ADR / doc |
|-----------|-----------|
| Ontology before apps | [ADR 001](../06-adrs/001-ontology-before-apps.md) |
| Governed change | [ADR 003](../06-adrs/003-single-execute-action.md) |
| Agent suggest-first | [ADR 002](../06-adrs/002-wave1-suggest-only-agent.md) |
