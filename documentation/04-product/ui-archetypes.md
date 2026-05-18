---
status: reviewed
sources:
  - path: resources/pahami dahulu konteks dari berikut.md
    sections: ["Pola layar", "Struktur utama"]
last_verified: 2026-05-18
---

# UI archetypes

Screens reuse a small set of patterns (from synthesis “Pola layar”).

| Archetype | Purpose | MVP examples |
|-----------|---------|--------------|
| **Command Center** | KPI strip + alerts + board | Operations Home |
| **Monitor** | Filterable high-volume grid | Shipment Monitor |
| **Detail / Timeline** | Single object depth | Shipment Detail |
| **Desk / Queue** | Triage and resolution | Exception Desk |
| **Finance Home** | Governance KPIs | Finance Home |
| **Workbench** | Multi-step transactional work | Interco Console |

## Shared UX rules (synthesis)

- Header with scope filters (branch, entity, date)
- Audit / action rail for governed actions
- Role-based density (ops vs finance)
- Empty, warning, and governance states called out per screen

Presentation components: [external-ui](../05-references/external-ui.md).
