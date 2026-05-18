---
status: draft
sources:
  - path: resources/Validation_Kit_v0.1_ABC_Express.pdf
    sections: ["Paket B", "Keputusan 1: LegalEntity Structure untuk IPO"]
last_verified: 2026-05-18
---

# ADR 004: Legal entity four-way model

## Status

**Open** — awaiting Founder sign-off in [`log-keputusan-founder.md`](../00-founder/log-keputusan-founder.md) row B1.

## Context

IPO readiness requires every transactional object to attribute to a **LegalEntity**. Validation Kit proposes four entities:

| Code | Role (from kit) |
|------|-----------------|
| ANT | Operating entity (Antero) |
| ARA | Operating entity (Arandy) |
| HOLD | Holding company |
| SPV-IPO | Listing vehicle |

Kit asks whether four entities suffice or subsidiaries (e.g. international) are needed before catalog v0.2.

## Options

1. **Accept four-entity model** — enforce `legalEntityId` on Shipment, Employee, Invoice, Vehicle, IntercoTxn, etc.
2. **Add entities** — e.g. international subsidiary type before Wave 2 financial go-live
3. **Merge ANT/ARA** within 2 years — different tagging strategy (Founder Paket D cross-cutting question)

## Decision

*Not recorded.* Do not implement schema enforcement until B1 is signed.

## Consequences

When accepted, Wave 2 financial modules and interco console depend on consistent entity attribution.
