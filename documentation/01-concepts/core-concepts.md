---
status: reviewed
sources:
  - url: https://www.palantir.com/docs/foundry/ontology/core-concepts/
  - path: resources/Memahami_Ontology_Foundational_Reading_C-Level_ABC_Express.pdf
    sections: ["Bab 2–3", "konsep dasar"]
last_verified: 2026-05-18
---

# Core concepts

Summary aligned with [Palantir Foundry core concepts](https://www.palantir.com/docs/foundry/ontology/core-concepts/) and the reference client Foundational Reading. Follow Palantir docs for authoritative definitions.

## Ontology

A formal, organization-wide model of **business entities** (object types), **relationships** (link types), **behavior** (action types), and **shared logic** (functions). It sits above raw datasets and below applications.

## Object type

A schema for a real-world entity (e.g. Shipment, Customer, Invoice). Instances are **objects** with properties, lifecycle, and links.

## Link type

A typed relationship between object types (e.g. Shipment → Customer). Enables graph traversal and consistent joins across apps.

## Action type

A **governed, auditable** mutation on the ontology (create/update/transition) with permissions and side effects — the only path for agents and apps to change state in the target design.

## Function

Deterministic logic over ontology objects (rules, calculations, eligibility). **Not** an LLM prompt.

## Interface

Optional polymorphic contract shared by multiple object types (deferred for MVP in product plan).

## Dataset vs ontology

See [dataset-vs-ontology.md](dataset-vs-ontology.md).

## Alignment table (Palantir ↔ Daemon)

| Palantir concept | Daemon package (target) |
|------------------|-------------------------|
| Object / link / action types | `ontology-language` |
| Ontology runtime | `ontology-engine` *(planned)* |
| Consumer APIs | `ontology-sdk` *(planned)* |
| Workshop / custom apps | Application layer |
| AIP / agents | LangGraph + HITL *(planned)* |
