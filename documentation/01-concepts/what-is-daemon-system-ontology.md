---
status: reviewed
sources:
  - path: resources/Memahami_Ontology_Foundational_Reading_C-Level_ABC_Express.pdf
    sections: ["Bab 1", "Positioning ontology-first"]
  - path: resources/pahami dahulu konteks dari berikut.md
    sections: ["Bentuk produk"]
last_verified: 2026-05-18
---

# What is Daemon System Ontology?

**Daemon System Ontology** is an open, Palantir-inspired pattern for building an **ontology-first enterprise operating system**: a shared semantic layer of business objects, links, functions, and governed actions, with applications and agents consuming that layer instead of inventing parallel definitions.

## What it is not

- Not a single vendor product (no requirement for Palantir Foundry in production)
- Not a chatbot or “AI replaces ERP”
- Not a full object catalog dump in public docs (property-level catalog awaits validated v0.2)

## What it is

| Layer | Role |
|-------|------|
| **Ontology language** | Declarative schemas (object types, links, actions, interfaces) |
| **Ontology engine** | Runtime validation, policies, audit, deterministic functions *(planned)* |
| **Ontology SDK** | Typed API for applications *(planned)* |
| **Applications** | Workflow UIs (ops tower, finance console, …) |
| **Agent runtime** | Propose → human gate → `executeAction` → audit |

## Reference implementation context

A reference logistics organization uses this pattern toward IPO-ready operations: **41 core objects** in four domains (Core, Commercial, Network, Financial & Governance), validated via stakeholder kits. Client-specific naming and decisions live in internal founder docs (`00-founder/`), not in generic English technical docs.

## Related reading

- [Core concepts](core-concepts.md)
- [Four layers](four-layers.md)
- [Product on a page](../04-product/product-on-a-page.md)
