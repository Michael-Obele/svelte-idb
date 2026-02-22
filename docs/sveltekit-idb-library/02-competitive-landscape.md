# 02 — Competitive Landscape

> Feature comparison of existing IndexedDB wrapper libraries — and where `svelte-idb` fills the gap.

**← [01 Origin Analysis](./01-origin-analysis.md)** | **[Next → 03 Feature Spec](./03-feature-spec.md)**

---

## The Players

### 1. **Dexie.js** — The Feature King

- **Stars:** 14K+ | **Downloads:** 757K/week | **Size:** ~25KB min+gz
- **Strengths:** Full query builder, live queries (`liveQuery()`), compound indexes, transactions, middleware API, used by ChatGPT/WhatsApp Web
- **Weaknesses:** Large bundle, no Svelte 5 native integration (requires adapter), complex internals, SSR requires custom handling
- **Live Queries:** Yes — `liveQuery()` observes IndexedDB changes and re-executes queries via binary range tree diffing. React has `useLiveQuery()`, but no Svelte 5 runes equivalent.
- **Key Insight:** Dexie's `liveQuery()` is the gold standard for IndexedDB reactivity — we should study and simplify it.

### 2. **idb** — The Minimalist

- **Stars:** 7.2K+ | **Downloads:** 10.4M/week | **Size:** ~1.2KB brotli
- **Strengths:** Tiny, mirrors native API closely, excellent TypeScript via `DBSchema`, `tx.done` for transaction completion, async cursor iteration
- **Weaknesses:** No reactivity, no query builder, no change tracking, just a Promise wrapper
- **Key Insight:** `idb`'s `DBSchema` interface for typed database schemas is the best pattern in the ecosystem. We should adapt it.

### 3. **localForage** — The Legacy Giant

- **Stars:** 25.7K+ | **Downloads:** 4.9M/week | **Size:** ~8KB min+gz
- **Strengths:** Simple key-value API (like async `localStorage`), fallback to WebSQL/localStorage, battle-tested
- **Weaknesses:** No complex queries, no indexes, no transactions, no TypeScript types, last published 4+ years ago, unmaintained
- **Key Insight:** LocalForage proved the market wants simplicity. Our API should be _as simple_ for basic cases but scale to complex ones.

### 4. **PouchDB** — The Sync Engine

- **Stars:** 17.5K+ | **Downloads:** Moderate | **Size:** ~46KB min+gz
- **Strengths:** CouchDB-compatible sync, offline-first with conflict resolution, map/reduce queries
- **Weaknesses:** Huge bundle, complex mental model, overkill for client-only apps, no SSR awareness
- **Key Insight:** PouchDB's sync model is out of scope for v1, but its conflict resolution patterns are worth studying for future cloud sync.

### 5. **SignalDB** — The Reactive Newcomer

- **Stars:** ~500 | **Downloads:** Low | **Size:** ~10KB
- **Strengths:** Signal-based reactivity with framework adapters (Svelte, React, Vue, Angular, Solid), in-memory collections with persistence adapters
- **Weaknesses:** Less mature, requires two packages (`@signaldb/core` + adapter), the Svelte adapter is for generic signals not deep IndexedDB integration
- **Key Insight:** SignalDB's adapter pattern (pluggable reactivity) is interesting but adds weight. We can go deeper by being Svelte-only.

### 6. **idb-keyval** — The One-Liner

- **Stars:** 3.1K+ | **Downloads:** High | **Size:** ~250 bytes brotli
- **Strengths:** Dead simple `get(key)` / `set(key, value)` API, smallest possible bundle
- **Weaknesses:** Key-value only, no schema, no queries, no indexes
- **Key Insight:** For users who only need key-value storage, `svelte-idb` should offer a similar simple API alongside the full-featured one.

---

## Feature Matrix

| Feature                |    Dexie     |   idb    | localForage |   PouchDB    | SignalDB | idb-keyval | **svelte-idb**  |
| ---------------------- | :----------: | :------: | :---------: | :----------: | :------: | :--------: | :-------------: |
| **Bundle Size**        |    ~25KB     |  ~1.2KB  |    ~8KB     |    ~46KB     |  ~10KB   |   ~250B    | **~4KB target** |
| **Zero Dependencies**  |      ✗       |    ✓     |      ✗      |      ✗       |    ✗     |     ✓      |      **✓**      |
| **TypeScript**         |   Partial    |    ✓     |      ✗      |      ✗       |    ✓     |     ✓      |      **✓**      |
| **Typed Schema**       | String-based | DBSchema |      ✗      |      ✗       |    ✗     |     ✗      |  **✓ Generic**  |
| **CRUD Operations**    |      ✓       |    ✓     |   Key-Val   |      ✓       |    ✓     |  Key-Val   |      **✓**      |
| **Query Builder**      |    ✓ Full    |    ✗     |      ✗      |  Map/Reduce  |  ✓ Find  |     ✗      | **✓ Chainable** |
| **Secondary Indexes**  |      ✓       |    ✓     |      ✗      |      ✗       |    ✗     |     ✗      |      **✓**      |
| **Compound Indexes**   |      ✓       |    ✓     |      ✗      |      ✗       |    ✗     |     ✗      |      **✓**      |
| **Transactions**       |      ✓       |    ✓     |      ✗      |      ✗       |    ✗     |     ✗      |      **✓**      |
| **Live Queries**       |      ✓       |    ✗     |      ✗      | Changes feed |    ✓     |     ✗      |   **✓ Runes**   |
| **Svelte 5 Native**    |      ✗       |    ✗     |      ✗      |      ✗       | Adapter  |     ✗      |      **✓**      |
| **SSR-Safe**           |      ✗       |    ✗     |      ✗      |      ✗       |    ✗     |     ✗      |      **✓**      |
| **Version Migrations** |      ✓       |    ✓     |      ✗      |      ✗       |    ✗     |     ✗      |      **✓**      |
| **Middleware/Hooks**   |      ✓       |    ✗     |      ✗      |      ✗       |    ✗     |     ✗      |      **✓**      |
| **Sync Support**       | Dexie Cloud  |    ✗     |      ✗      |   CouchDB    |    ✗     |     ✗      |   **Future**    |

---

## Downloads Comparison (Weekly)

```
idb          ████████████████████████████████████████  10.4M
localForage  ██████████████████████                    4.9M
dexie        ███████                                   757K
idb-keyval   ██████████████                            ~3M (est)
SignalDB     █                                         ~1K (est)
```

The download numbers tell a clear story: **simplicity wins**. `idb` and `localForage` dominate because they're simple. Dexie has far more features but 14x fewer downloads than `idb`.

---

## What Success Looks Like

The ideal `svelte-idb` library would combine:

| From                                                                                             | Feature                                                   |
| ------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| **idb**                                                                                          | Tiny size, TypeScript schema typing (`DBSchema` pattern)  |
| **Dexie**                                                                                        | Live queries concept (simplified for Svelte 5 runes)      |
| **localForage**                                                                                  | Dead-simple API for basic use cases                       |
| **idb-keyval**                                                                                   | One-liner get/set for key-value patterns                  |
| **Our [db.native.ts](https://github.com/Michael-Obele/tif/blob/master/src/lib/db/db.native.ts)** | SSR safety, autoIncrement handling, declarative schema    |
| **Novel**                                                                                        | Svelte 5 `$state`/`$derived`/`$effect` native integration |

---

## Positioning Statement

> **svelte-idb** is the IndexedDB library built _for_ SvelteKit.
> Zero dependencies. Svelte 5 runes-native reactivity. SSR-safe by default.
> The DX of `idb`'s types. The reactivity of Dexie's live queries. The simplicity of `localForage`. In ~4KB.

---

**← [01 Origin Analysis](./01-origin-analysis.md)** | **[Next → 03 Feature Spec](./03-feature-spec.md)**
