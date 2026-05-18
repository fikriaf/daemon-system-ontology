---
status: reviewed
sources:
  - path: resources/Validation_Kit_v0.1_ABC_Express.pdf
    sections: ["Paket A Keputusan 1–3", "Paket B Keputusan 1–3", "Paket C Keputusan 1–3", "Paket D Area 1–5"]
last_verified: 2026-05-18
---

# Log keputusan Founder — 12 keputusan kritis + meta

Isi kolom **Putusan / Tanggal / Owner** setelah sesi konsolidasi. Jangan mengisi putusan di dokumen ini sebelum Founder menandatangani — opsi di bawah diambil dari Validation Kit v0.1 (bukan keputusan final).

## Paket A — Commercial (11 objek review)

| # | Keputusan | Opsi / usulan (dari kit) | Putusan | Tanggal | Owner |
|---|-----------|--------------------------|---------|---------|-------|
| A1 | Hierarki **Account → Customer** | Account = master grup/holding di atas Customer (legal entity per anak) | | | |
| A2 | Lifecycle **Opportunity** (7 state) | Prospecting → Qualified → Proposal → Negotiation → ClosedWon / ClosedLost / OnHold; tambah stage tender/site visit? | | | |
| A3 | Definisi **3 CGL** | Apakah segmentasi CGL sudah final untuk katalog v0.2? | | | |

## Paket B — Financial & Governance (9 objek review)

| # | Keputusan | Opsi / usulan (dari kit) | Putusan | Tanggal | Owner |
|---|-----------|--------------------------|---------|---------|-------|
| B1 | **LegalEntity** untuk IPO | ANT + ARA + HOLD + SPV-IPO; setiap transaksi wajib `legalEntityId` | | | |
| B2 | **Transfer Pricing** A1–A7 + 4 skema | Objek TransferPricingActivity + IntercoTransaction; benchmark per aktivitas | | | |
| B3 | **IntercoTransaction** & double-count | Workflow eliminasi Pending → Eliminated → Reviewed; satu invoice satu entity | | | |

## Paket C — Operations & Network (16 objek review)

| # | Keputusan | Opsi / usulan (dari kit) | Putusan | Tanggal | Owner |
|---|-----------|--------------------------|---------|---------|-------|
| C1 | **Shipment lifecycle** (10 state) | Draft → … → Closed; tambah state khusus 3T (checkpoint, weather, reconsolidating, returned)? | | | |
| C2 | **HubRO 6 profiles** | Klasifikasi RO per Network Role / Product Mix / Coverage Span (JKT/SUB/UPG mapping) | | | |
| C3 | **LocalHero engagement** | Individual / UMKM / MicroAgency; adaptasi koperasi/BUMDes di daerah tertentu? | | | |

## Paket D — Strategic Meta (Founder only)

| # | Area | Pertanyaan kunci (ringkas) | Putusan | Tanggal | Owner |
|---|------|----------------------------|---------|---------|-------|
| D1 | Ownership matrix | Business owner per domain (Core, Commercial, Network, Financial); delegasi perubahan tanpa CEO tiap kali? | | | |
| D2 | Missing strategic objects | RegulatoryLicense, Brand/IP, ClaimCase, PhysicalAsset, RiskRegister, dll. — tambah ke v0.2? | | | |
| D3 | Cross-cutting consistency | `cglSegmentId`, `legalEntityId` wajib; polymorphic carrier; naming CGLSegment vs neutral | | | |
| D4 | IPO storytelling | Narasi moat distribusi, asset-light, revenue quality — objek v0.1 cukup? | | | |
| D5 | Global expansion readiness | Address ID-centric, currency, tax regime, i18n labels | | | |

## ADR terkait (English, setelah putusan)

- [ADR 004 — Legal entity four-way](../06-adrs/004-legal-entity-four-way.md) — **terbuka** sampai baris B1 diisi.
