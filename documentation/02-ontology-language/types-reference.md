---
status: reviewed
sources:
  - url: https://www.palantir.com/docs/foundry/object-link-types/type-reference/
last_verified: 2026-05-18
---

# Types reference

Palantir defines property value types used on object types (strings, dates, geopoints, etc.). Daemon `ontology-language` will mirror this catalog in YAML when schemas land in the repo.

**Authoritative list:** [Palantir type reference](https://www.palantir.com/docs/foundry/object-link-types/type-reference/)

## Planned Daemon mapping

| Concern | Location |
|---------|----------|
| Scalar & composite types | `ontology-language` schemas *(TBD)* |
| Validation at write | `ontology-engine` *(planned)* |

Do not document per-property types for the 41-object catalog until v0.2 validation completes.
