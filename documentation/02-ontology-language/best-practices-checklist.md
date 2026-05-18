---
status: reviewed
sources:
  - url: https://www.palantir.com/docs/foundry/ontology/ontology-best-practices-and-anti-patterns/
last_verified: 2026-05-18
---

# Best practices checklist (PR review)

Use when reviewing ontology schema or application PRs. Based on Palantir anti-patterns doc.

## Modeling

- [ ] Object type names are business nouns, not table names
- [ ] Shared properties used for repeated semantics (`legalEntityId`, etc.) only when validated
- [ ] Link types used instead of duplicating foreign-key IDs without relationship metadata
- [ ] No duplicate object types for the same real-world entity

## Behavior

- [ ] Business rules live in **functions**, not UI or LLM prompts
- [ ] All mutations go through **action types** with audit
- [ ] Lifecycle states are explicit enums, not free-text status fields

## Applications

- [ ] Apps do not write core entities only in app-local DB without ontology sync
- [ ] Read paths use ontology SDK / API, not shadow copies

## Agents

- [ ] Agent cannot call arbitrary write APIs
- [ ] Wave 1: suggest-only; HITL before `executeAction`
- [ ] Tool list is allowlisted action types + read tools

## Security

- [ ] `legalEntityId` (or equivalent) enforced on transactional objects where required
- [ ] Role checks on action types, not hidden in agent prompt

**Source:** [Ontology best practices and anti-patterns](https://www.palantir.com/docs/foundry/ontology/ontology-best-practices-and-anti-patterns/)
