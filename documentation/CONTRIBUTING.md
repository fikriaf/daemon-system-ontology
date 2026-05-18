# Contributing to documentation

## Required frontmatter

Every markdown file under `documentation/` (except this file and `MANIFEST.md`) must start with:

```yaml
---
status: draft | reviewed | stale
sources:
  - path: resources/Validation_Kit_v0.1_ABC_Express.pdf
    sections: ["Paket B", "Keputusan 1"]
  - url: https://www.palantir.com/docs/foundry/ontology/core-concepts/
last_verified: YYYY-MM-DD
---
```

### Rules

1. **`reviewed`** — Every factual claim must have a matching `sources` entry. No invented object properties, API endpoints, or dates.
2. **`draft`** — Work in progress; incomplete `sources` is allowed.
3. **`stale`** — Source material changed; needs re-verification.

## Source hierarchy

1. **Primary:** Files in [`../resources/`](../resources/) (PDFs, synthesis markdown).
2. **Reference:** Palantir public documentation (summarize + link; do not paste full pages).
3. **Design (draft):** Target Daemon architecture — label clearly as *planned*, not implemented.

## Language and confidentiality

| Path | Rule |
|------|------|
| `00-founder/` | Bahasa Indonesia. May name the reference client and internal figures per existing PDFs. **Internal only.** |
| All other paths | English. Use *reference logistics organization* for client-specific examples. No confidential figures in public-facing exports. |

Do not copy PDFs into `documentation/`. Link with relative paths to `resources/`.

## What not to document without evidence

- Full 41-object property catalog (wait for catalog v0.2 after validation)
- `ontology-engine` API or OpenAPI (no implementation in repo yet)
- LangGraph graph source code (not in repo yet)
- Exact financial amounts in English public docs unless cited from `resources/` PDFs

## Updating MANIFEST

When a file reaches `reviewed`, update its row in [`MANIFEST.md`](MANIFEST.md).

## Consistency checks

Before marking a phase complete, verify:

| Check | Expected value |
|-------|------------------|
| Commercial object count | 11 (Validation Kit Paket A) |
| Finance object count | 9 (Validation Kit Paket B) |
| Operations object count | 16 (Validation Kit Paket C) |
| MVP screens | 6 (see `04-product/mvp-screens.md`) |
| Wave 1 | Jul–Sep 2026 (Foundational Reading PDF) |
| Wave 2 | Oct–Dec 2026 |
| Wave 3 | Jan–Mar 2027 |
| Wave 4 | Apr–Jun 2027 |
