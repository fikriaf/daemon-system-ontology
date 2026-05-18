# Documentation manifest

Last updated: 2026-05-18. Consistency verified: Commercial 11, Finance 9, Ops 16 (kit); catalog 41 (Foundational); MVP 6 screens; Wave 1 Jul–Sep 2026.

| Path | Lang | Status | Notes |
|------|------|--------|-------|
| README.md | EN | reviewed | Index |
| CONTRIBUTING.md | EN | reviewed | Governance |
| MANIFEST.md | EN | reviewed | This file |
| **00-founder/** | | | |
| 00-founder/ringkasan-eksekutif.md | ID | reviewed | |
| 00-founder/log-keputusan-founder.md | ID | reviewed | Sign-off columns empty by design |
| 00-founder/kalender-validasi-3-minggu.md | ID | reviewed | |
| 00-founder/agenda-sesi-founder.md | ID | reviewed | |
| 00-founder/produk-satu-halaman.md | ID | reviewed | |
| **01-concepts/** | | | |
| 01-concepts/what-is-daemon-system-ontology.md | EN | reviewed | |
| 01-concepts/core-concepts.md | EN | reviewed | |
| 01-concepts/dataset-vs-ontology.md | EN | reviewed | |
| 01-concepts/four-layers.md | EN | reviewed | |
| 01-concepts/design-principles.md | EN | reviewed | Lima prinsip (paraphrase) |
| **02-ontology-language/** | | | |
| 02-ontology-language/types-reference.md | EN | reviewed | |
| 02-ontology-language/object-types.md | EN | reviewed | |
| 02-ontology-language/properties-shared-structs-value-types.md | EN | reviewed | |
| 02-ontology-language/link-types.md | EN | reviewed | |
| 02-ontology-language/action-types.md | EN | reviewed | |
| 02-ontology-language/interfaces.md | EN | reviewed | |
| 02-ontology-language/functions-vs-agents.md | EN | reviewed | |
| 02-ontology-language/best-practices-checklist.md | EN | reviewed | |
| **03-architecture/** | | | |
| 03-architecture/system-overview.md | EN | draft | Planned packages |
| 03-architecture/pipeline-stages.md | EN | reviewed | |
| 03-architecture/branching-and-catalog-versioning.md | EN | reviewed | |
| 03-architecture/security-agent-governance.md | EN | draft | Pending ADR 003 approval |
| 03-architecture/models-in-ontology.md | EN | reviewed | |
| **04-product/** | | | |
| 04-product/product-on-a-page.md | EN | reviewed | |
| 04-product/modules-and-waves.md | EN | reviewed | |
| 04-product/mvp-screens.md | EN | reviewed | |
| 04-product/ui-archetypes.md | EN | reviewed | |
| 04-product/agent-operating-loop.md | EN | reviewed | |
| **05-references/** | | | |
| 05-references/palantir-foundry-index.md | EN | reviewed | |
| 05-references/langchain-langgraph-index.md | EN | reviewed | |
| 05-references/external-ui.md | EN | reviewed | |
| 05-references/lattice-sample-apps.md | EN | reviewed | Pattern map; not a dependency |
| **06-adrs/** | | | |
| 06-adrs/001-ontology-before-apps.md | EN | reviewed | |
| 06-adrs/002-wave1-suggest-only-agent.md | EN | reviewed | |
| 06-adrs/003-single-execute-action.md | EN | draft | |
| 06-adrs/004-legal-entity-four-way.md | EN | draft | Open — Founder B1 |
| **07-derived-index/** | | | |
| 07-derived-index/synthesis-toc.md | EN | reviewed | + synthesis-toc.raw.txt |
| 07-derived-index/ui-spec-index.md | EN | reviewed | |
| 07-derived-index/object-catalog-stub.md | EN | reviewed | Counts only |

## Deferred (TBD in manifest)

| Topic | Reason |
|-------|--------|
| Full 41-object property catalog | Await catalog v0.2 post-validation |
| ontology-language YAML schemas | No files in repo |
| ontology-engine API | Not implemented |
| LangGraph graph definitions | Not in repo |

## Verification

```bash
chmod +x scripts/verify-doc-manifest.sh
./scripts/verify-doc-manifest.sh
```
