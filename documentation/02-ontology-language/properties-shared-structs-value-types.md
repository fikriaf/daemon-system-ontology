---
status: reviewed
sources:
  - url: https://www.palantir.com/docs/foundry/object-link-types/properties-overview/
  - url: https://www.palantir.com/docs/foundry/object-link-types/shared-property-types-overview/
  - url: https://www.palantir.com/docs/foundry/object-link-types/structs-overview/
  - url: https://www.palantir.com/docs/foundry/object-link-types/value-types-overview/
last_verified: 2026-05-18
---

# Properties, shared properties, structs, value types

| Construct | Purpose | Palantir doc |
|-----------|---------|--------------|
| **Property** | Field on one object type | [Properties](https://www.palantir.com/docs/foundry/object-link-types/properties-overview/) |
| **Shared property** | Reuse same semantic field across types | [Shared properties](https://www.palantir.com/docs/foundry/object-link-types/shared-property-types-overview/) |
| **Struct** | Embedded composite on an object | [Structs](https://www.palantir.com/docs/foundry/object-link-types/structs-overview/) |
| **Value type** | Constrained semantic type (e.g. currency code) | [Value types](https://www.palantir.com/docs/foundry/object-link-types/value-types-overview/) |

## Cross-cutting tags (reference client)

Foundational Reading and Validation Kit discuss mandatory tags such as `legalEntityId` and `cglSegmentId` on selected types — **final cardinality awaits v0.2**, not documented as fixed schema here.
