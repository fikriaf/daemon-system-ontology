---
status: reviewed
sources:
  - path: resources/Validation_Kit_v0.1_ABC_Express.pdf
    sections: ["v0.1 → v0.2", "Catalog versioning Q8"]
  - url: https://www.palantir.com/docs/foundry/ontologies/ontology-branches-legacy/
last_verified: 2026-05-18
---

# Branching and catalog versioning

## Stakeholder catalog versions (Validation Kit)

| Version | Meaning |
|---------|---------|
| v0.1 | Draft catalog (current PDF / review) |
| v0.2 | Post–3-week validation + consolidation |
| v1.0 | Production-ready ontology |
| v2.0+ | Major expansions (e.g. global) |

After consolidation, v0.2 becomes baseline for ADRs and Wave 1 implementation.

## Palantir ontology branches

For teams using Foundry, ontology changes can be branched and merged — see [ontology branches](https://www.palantir.com/docs/foundry/ontologies/ontology-branches-legacy/).

## Daemon (planned)

Mirror semantic versioning on `ontology-language` packages; CI validates schema compatibility before engine deploy (TBD).
