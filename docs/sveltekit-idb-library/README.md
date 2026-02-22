# 🗄️ SvelteKit IndexedDB Library — Project Plan

> **Codename:** `svelte-idb`
> **Goal:** A zero-dependency, SSR-safe, Svelte 5 runes-native IndexedDB wrapper library — published as a SvelteKit package.

---

## 📋 Table of Contents

| #   | Document                                                     | Description                                                                                                                                             |
| --- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | [**Origin & Analysis**](./01-origin-analysis.md)             | Deep dive into the [`db.native.ts`](https://github.com/Michael-Obele/tif/blob/master/src/lib/db/db.native.ts) implementation that inspired this library |
| 2   | [**Competitive Landscape**](./02-competitive-landscape.md)   | Feature comparison of Dexie.js, `idb`, localForage, PouchDB, SignalDB                                                                                   |
| 3   | [**Feature Specification**](./03-feature-spec.md)            | Complete feature list, API surface, and design decisions                                                                                                |
| 4   | [**Svelte 5 Reactivity**](./04-svelte5-reactivity.md)        | How to build live queries and reactive state with `$state`, `$derived`, `$effect`                                                                       |
| 5   | [**SvelteKit Packaging**](./05-sveltekit-packaging.md)       | How to scaffold, build, and publish a SvelteKit library via `@sveltejs/package`                                                                         |
| 6   | [**API Design**](./06-api-design.md)                         | Full API reference with TypeScript signatures and usage examples                                                                                        |
| 7   | [**Architecture**](./07-architecture.md)                     | Internal architecture, module structure, and dependency graph                                                                                           |
| 8   | [**Implementation Roadmap**](./08-implementation-roadmap.md) | Phased milestones from MVP to v1.0                                                                                                                      |

---

## 🧠 Why Build This?

The existing IndexedDB ecosystem has a gap:

| Library               | Svelte 5 Native | Zero-Dep | SSR-Safe | Live Queries | Type-Safe Schema |
| --------------------- | :-------------: | :------: | :------: | :----------: | :--------------: |
| **Dexie.js**          |        ✗        |    ✗     |    ✗     |      ✓       |     Partial      |
| **idb**               |        ✗        |    ✓     |    ✗     |      ✗       |        ✓         |
| **localForage**       |        ✗        |    ✗     |    ✗     |      ✗       |        ✗         |
| **SignalDB**          |     Adapter     |    ✗     |    ✗     |      ✓       |        ✗         |
| **svelte-idb** (ours) |        ✓        |    ✓     |    ✓     |      ✓       |        ✓         |

No library natively integrates with Svelte 5 runes (`$state`, `$derived`, `$effect`) while being zero-dependency and SSR-safe out of the box. That's our niche.

---

## 🏗️ Core Principles

1. **Zero Dependencies** — Only the browser's native IndexedDB API
2. **Svelte 5 Native** — Runes-based reactivity, not store adapters
3. **SSR-Safe by Default** — Works in SvelteKit without guards
4. **TypeScript-First** — Full generic type inference on schema
5. **Minimal Surface** — Small API with escape hatches for power users

---

## 🚀 Quick Navigation

```
docs/sveltekit-idb-library/
├── README.md                      ← You are here
├── 01-origin-analysis.md          ← What we're building from
├── 02-competitive-landscape.md    ← What exists already
├── 03-feature-spec.md             ← What we're building
├── 04-svelte5-reactivity.md       ← How reactivity works
├── 05-sveltekit-packaging.md      ← How to ship it
├── 06-api-design.md               ← The developer interface
├── 07-architecture.md             ← Internal structure
└── 08-implementation-roadmap.md   ← When we build it
```

---

**Next →** [01 — Origin & Analysis](./01-origin-analysis.md)
