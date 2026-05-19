# Daemon System Ontology — Documentation

Documentation for the ontology-first enterprise operating system pattern implemented as **Daemon System Ontology**. Sources live in [`../resources/`](../resources/); this tree is the maintained, traceable index.

## Start here

| Audience | Start with |
|----------|------------|
| Founder / C-level (internal) | [`00-founder/ringkasan-eksekutif.md`](00-founder/ringkasan-eksekutif.md) + PDFs in `resources/` |
| New engineers | [`01-concepts/what-is-daemon-system-ontology.md`](01-concepts/what-is-daemon-system-ontology.md) |
| Schema authors | [`02-ontology-language/types-reference.md`](02-ontology-language/types-reference.md) |
| Architects | [`03-architecture/system-overview.md`](03-architecture/system-overview.md) |
| PM / design | [`04-product/product-on-a-page.md`](04-product/product-on-a-page.md) |
| Agent engineers | [`02-ontology-language/functions-vs-agents.md`](02-ontology-language/functions-vs-agents.md) |

## Layers (target architecture)

1. **Ontology Language** — declarative types (object, link, action, interface)
2. **Ontology Engine** — runtime, policies, audit, functions (planned)
3. **Ontology SDK** — typed consumer for applications (planned)
4. **Applications** — workflow UIs (many faces, one ontology)
5. **Agent runtime** — LangGraph; propose → human gate → act (Wave 1: suggest-only)

## Language split

| Folder | Language |
|--------|----------|
| `00-founder/` | Bahasa Indonesia (internal stakeholder pack) |
| All other folders | English |

## Governance

- File status and completeness: [`MANIFEST.md`](MANIFEST.md)
- How to write and cite sources: [`CONTRIBUTING.md`](CONTRIBUTING.md)
- Do not copy client PDFs into `documentation/` — link to `resources/` only.

## External references

- [Palantir documentation portal index](05-references/palantir-foundry-index.md) — maps [palantir.com/docs](https://www.palantir.com/docs/) capabilities to Daemon docs
- [Lattice sample apps](05-references/lattice-sample-apps.md) — entity / objects / tasks patterns mapped to Daemon (reference only)
- [LangChain / LangGraph index](05-references/langchain-langgraph-index.md)
- [External UI (Blueprint / Plottable)](05-references/external-ui.md)
