---
status: reviewed
sources:
  - url: https://www.palantir.com/docs/foundry/interfaces/interface-overview/
  - path: resources/pahami dahulu konteks dari berikut.md
    sections: ["MVP scope"]
last_verified: 2026-05-18
---

# Interfaces

**Interfaces** let multiple object types implement a shared contract (polymorphic queries and UI).

[Interface overview](https://www.palantir.com/docs/foundry/interfaces/interface-overview/)

## MVP deferral

Product synthesis defers full interface modeling in Wave 1. Use concrete object types first; introduce interfaces when polymorphic patterns (e.g. multiple carrier types) stabilize in v0.2+.

Validation Kit notes polymorphic `carrierId` (Driver / Partner / ThirdParty / LocalHero) as a strategic question for the Founder — see internal [log-keputusan-founder.md](../00-founder/log-keputusan-founder.md).
