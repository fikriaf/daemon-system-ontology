---
status: reviewed
sources:
  - url: https://www.palantir.com/docs/foundry/object-link-types/link-types-overview/
last_verified: 2026-05-18
---

# Link types

**Link types** define directed relationships between object types (one-to-one, one-to-many, many-to-many per Palantir modeling rules).

[Link types overview](https://www.palantir.com/docs/foundry/object-link-types/link-types-overview/)

## Examples (generic logistics)

| Link | From | To |
|------|------|-----|
| `shipment_customer` | Shipment | Customer |
| `shipment_assigned_branch` | Shipment | Branch |
| `invoice_legal_entity` | Invoice | LegalEntity |

Concrete link catalog: Object Catalog v0.2 (TBD).
