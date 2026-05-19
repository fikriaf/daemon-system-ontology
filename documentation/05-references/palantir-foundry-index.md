---
status: reviewed
sources:
  - url: https://www.palantir.com/docs/
  - url: https://www.palantir.com/docs/foundry/getting-started/foundry-platform-summary-llm/
  - url: https://www.palantir.com/docs/foundry/api-reference/
last_verified: 2026-05-18
---

# Palantir documentation — portal index

**Portal utama:** [https://www.palantir.com/docs/](https://www.palantir.com/docs/)

Dokumen ini hanya berisi **tautan dan peta topik** — jangan menyalin isi penuh dokumentasi Palantir. Untuk agen/LLM, Palantir menyediakan ringkasan resmi: [Foundry platform summary for LLMs](https://www.palantir.com/docs/foundry/getting-started/foundry-platform-summary-llm/).

**API Reference:** [https://www.palantir.com/docs/foundry/api-reference/](https://www.palantir.com/docs/foundry/api-reference/)

**Produk terpisah di portal:** [Apollo](https://www.palantir.com/docs/apollo/) · [Gotham](https://www.palantir.com/docs/gotham/) — di luar scope Daemon (fokus Foundry + pola ontology).

---

## Navigasi portal (capability)

| Capability | Overview | Relevansi Daemon |
|------------|----------|------------------|
| **AI Platform (AIP)** | [aip/overview](https://www.palantir.com/docs/foundry/aip/overview/) | Setara lapisan agent + HITL; kita pakai LangGraph, bukan AIP Logic |
| **Data connectivity & integration** | [data-integration/overview](https://www.palantir.com/docs/foundry/data-integration/overview/) | `datasource → transform` |
| **Model connectivity & development** | [model-integration/overview](https://www.palantir.com/docs/foundry/model-integration/overview/) | Wave 2+; [models-in-ontology](../03-architecture/models-in-ontology.md) |
| **Ontology building** | [ontology/overview](https://www.palantir.com/docs/foundry/ontology/overview/) | **Inti** — `02-ontology-language/`, `ontology-engine` |
| **Developer toolchain** | Lihat [Getting started → Application reference](https://www.palantir.com/docs/foundry/getting-started/application-reference/) | SDK, CI, OSDK |
| **Use case development** | [delivering-a-use-case](https://www.palantir.com/docs/foundry/getting-started/delivering-a-use-case/) | Validasi kit → v0.2 |
| **Observability** | [aip-observability/overview](https://www.palantir.com/docs/foundry/aip-observability/overview/) | Audit agent + action types |
| **Analytics** | Contour, Quiver, Code Workbook | Bukan MVP; ops pakai app kustom |
| **Product delivery** | Workshop, Slate, Carbon | Pola UI; kita pakai Blueprint/Plottable |
| **Security & governance** | [security/overview](https://www.palantir.com/docs/foundry/security/overview/) | [security-agent-governance](../03-architecture/security-agent-governance.md) |
| **Management & enablement** | Training, roles | [learn.palantir.com ↗](https://learn.palantir.com/) |

---

## Getting started

| Topik | URL |
|-------|-----|
| Overview | https://www.palantir.com/docs/foundry/getting-started/overview/ |
| Introductory concepts (data vs object layer) | https://www.palantir.com/docs/foundry/getting-started/introductory-concepts/ |
| Authentication | https://www.palantir.com/docs/foundry/getting-started/authentication/ |
| Orientation & navigation | https://www.palantir.com/docs/foundry/getting-started/orientation-and-nav/ |
| Delivering a use case | https://www.palantir.com/docs/foundry/getting-started/delivering-a-use-case/ |
| Application reference | https://www.palantir.com/docs/foundry/getting-started/application-reference/ |
| Next steps by role | https://www.palantir.com/docs/foundry/getting-started/next-steps-by-role/ |
| Start with examples | https://www.palantir.com/docs/foundry/getting-started/start-with-examples/ |
| **Foundry platform summary for LLMs** | https://www.palantir.com/docs/foundry/getting-started/foundry-platform-summary-llm/ |

---

## Architecture center

Portal: cari **Architecture center** dari [docs home](https://www.palantir.com/docs/) — pola deployment, integrasi, best practice arsitektur enrollment.

Daemon setara: [system-overview](../03-architecture/system-overview.md), [pipeline-stages](../03-architecture/pipeline-stages.md).

---

## Platform updates

| Topik | URL |
|-------|-----|
| Announcements | https://www.palantir.com/docs/foundry/announcements/ |
| Release notes | https://www.palantir.com/docs/foundry/release-notes/ |

---

## Data integration (detail)

| Topik | URL |
|-------|-----|
| Overview | https://www.palantir.com/docs/foundry/data-integration/overview/ |
| Connecting to data | https://www.palantir.com/docs/foundry/data-integration/connecting-to-data/ |
| Data pipeline / Build | https://www.palantir.com/docs/foundry/data-integration/data-pipeline/ |
| Datasets | https://www.palantir.com/docs/foundry/data-integration/datasets/ |
| Virtual tables | https://www.palantir.com/docs/foundry/data-integration/virtual-tables/ |
| Pipeline Builder | https://www.palantir.com/docs/foundry/pipeline-builder/overview/ |
| Maintaining pipelines | https://www.palantir.com/docs/foundry/maintaining-pipelines/overview/ |
| Recommended project structure | https://www.palantir.com/docs/foundry/building-pipelines/recommended-project-structure/ |

---

## Model integration

| Topik | URL |
|-------|-----|
| Integrate overview | https://www.palantir.com/docs/foundry/integrate-models/integrate-overview/ |
| Model evaluation | https://www.palantir.com/docs/foundry/evaluate-models/model-evaluation-automatic/ |

---

## Ontology (detail — prioritas Daemon)

### Konsep & mengapa

| Topik | URL |
|-------|-----|
| Ontology overview | https://www.palantir.com/docs/foundry/ontology/overview/ |
| Why create an ontology? | https://www.palantir.com/docs/foundry/ontology/why-ontology/ |
| Core concepts | https://www.palantir.com/docs/foundry/ontology/core-concepts/ |
| Best practices & anti-patterns | https://www.palantir.com/docs/foundry/ontology/ontology-best-practices-and-anti-patterns/ |
| Ontology in applications | https://www.palantir.com/docs/foundry/ontology/applications/ |
| Models in ontology | https://www.palantir.com/docs/foundry/ontology/models/ |
| Ontology branching (legacy) | https://www.palantir.com/docs/foundry/ontologies/ontology-branches-legacy/ |

### Object & link types

| Topik | URL |
|-------|-----|
| Object types overview | https://www.palantir.com/docs/foundry/object-link-types/object-types-overview/ |
| Link types overview | https://www.palantir.com/docs/foundry/object-link-types/link-types-overview/ |
| Type reference | https://www.palantir.com/docs/foundry/object-link-types/type-reference/ |
| Properties | https://www.palantir.com/docs/foundry/object-link-types/properties-overview/ |
| Shared properties | https://www.palantir.com/docs/foundry/object-link-types/shared-property-types-overview/ |
| Structs | https://www.palantir.com/docs/foundry/object-link-types/structs-overview/ |
| Value types | https://www.palantir.com/docs/foundry/object-link-types/value-types-overview/ |

### Perilaku (kinetik)

| Topik | URL |
|-------|-----|
| Action types | https://www.palantir.com/docs/foundry/action-types/overview/ |
| Functions | https://www.palantir.com/docs/foundry/functions/overview/ |
| Interfaces | https://www.palantir.com/docs/foundry/interfaces/interface-overview/ |

---

## AIP (AI Platform)

| Topik | URL |
|-------|-----|
| AIP overview | https://www.palantir.com/docs/foundry/aip/overview/ |
| AIP features | https://www.palantir.com/docs/foundry/aip/aip-features/ |
| AIP observability | https://www.palantir.com/docs/foundry/aip-observability/overview/ |
| AIP Assist | https://www.palantir.com/docs/foundry/assist/overview/ |
| Palantir MCP | https://www.palantir.com/docs/foundry/palantir-mcp/overview/ |

**Daemon:** baca [functions-vs-agents](../02-ontology-language/functions-vs-agents.md) — aturan bisnis di functions, LLM hanya PROPOSE.

---

## Analytics (referensi produk)

| Produk | Titik masuk (dari portal) |
|--------|---------------------------|
| Contour | Cari di [Application reference](https://www.palantir.com/docs/foundry/getting-started/application-reference/) |
| Quiver | Idem |
| Code Workbook | Idem |

---

## Application building (referensi produk)

| Produk | Catatan Daemon |
|--------|----------------|
| **Workshop** | Pola app low-code di atas ontology; setara “workflow apps” kustom |
| **Slate** | Dashboard |
| **Carbon** | Reporting |

MVP kita: 6 layar kustom — lihat [mvp-screens](../04-product/mvp-screens.md), [external-ui](external-ui.md).

---

## Security

| Topik | URL |
|-------|-----|
| Security overview | https://www.palantir.com/docs/foundry/security/overview/ |
| Securing a data foundation | https://www.palantir.com/docs/foundry/security/securing-a-data-foundation/ |
| Data protection and governance | https://www.palantir.com/docs/foundry/security/data-protection-and-governance/ |

---

## Peta cepat: Palantir → folder dokumentasi Daemon

| Palantir | Daemon doc |
|----------|------------|
| Ontology overview, core concepts | `01-concepts/` |
| Object/link/action/function/interface | `02-ontology-language/` |
| Pipelines, project structure | `03-architecture/pipeline-stages.md` |
| AIP / agents | `04-product/agent-operating-loop.md` + `05-references/langchain-langgraph-index.md` |
| Workshop / analytics | `04-product/ui-archetypes.md` |
| Security | `03-architecture/security-agent-governance.md` |

---

## Referensi terkait

| Topik | Doc |
|-------|-----|
| Lattice sample apps (entity, objects, tasks) | [lattice-sample-apps.md](lattice-sample-apps.md) |
| LangChain / LangGraph | [langchain-langgraph-index.md](langchain-langgraph-index.md) |
| UI libraries | [external-ui.md](external-ui.md) |

---

## Sumber internal proyek

- Screenshot integrasi: [`../../resources/Ontology Integration Action-2026-05-18-113749.png`](../../resources/Ontology%20Integration%20Action-2026-05-18-113749.png)
- UI repos: [external-ui.md](external-ui.md)
