# 01 — Landscape & Inspiration

> A deep analysis of existing sync solutions, what they do well, what they don't, and what we can steal.

**[← README](./README.md)** | **[Next → 02 Packaging Decision](./02-packaging-decision.md)**

---

## The Problem Space

Users of `svelte-idb` store data locally in IndexedDB. Many of them also have a server-side database (PostgreSQL, SQLite, MySQL) accessed through an ORM (Prisma, Drizzle) or raw queries. Today, bridging these two worlds requires:

1. Manual fetch/push logic in every `+page.server.ts`
2. Custom conflict resolution when offline edits clash with server state
3. No reactive awareness — the UI doesn't know when server data changes

**We want to eliminate this friction entirely.**

---

## Existing Solutions

### 1. Zero (Rocicorp)

**What it is:** A general-purpose sync engine. Two parts: `zero-client` (browser) and `zero-cache` (server-side PostgreSQL replica).

**Architecture:**
```
┌──────────────┐       WebSocket       ┌──────────────┐
│ zero-client  │◄─────────────────────►│ zero-cache   │
│ (browser)    │                        │ (server)     │
│              │                        │              │
│ Local store  │                        │ PG replica   │
│ (IDB/Memory) │                        │ (read-only)  │
└──────────────┘                        └──────┬───────┘
                                               │
                                        ┌──────▼───────┐
                                        │  PostgreSQL  │
                                        │  (primary)   │
                                        └──────────────┘
```

**Key Patterns We Admire:**
- ✅ Client-first reads — queries hit local store instantly
- ✅ Optimistic writes — mutations apply locally, push to server
- ✅ Reactive queries — UI auto-updates when server pushes changes
- ✅ Server authority — custom mutators on the server for validation
- ✅ ZQL — shared query language across client and server

**What Doesn't Fit:**
- ❌ Requires `zero-cache` server infrastructure (we want to be infra-agnostic)
- ❌ React-first SDK (no Svelte adapter)
- ❌ PostgreSQL-only (we want multi-DB support)
- ❌ Proprietary managed service for scaling

**What We Take:**
> The *mental model* — client-first reads, optimistic writes, server-authoritative reconciliation. But we replace Zero's proprietary infrastructure with an adapter pattern.

---

### 2. ElectricSQL

**What it is:** An open-source sync layer for PostgreSQL using CRDTs and logical replication.

**Architecture (Electric Next / 2024+):**
```
┌──────────────┐       HTTP Shapes      ┌──────────────┐
│ PGlite/      │◄──────────────────────►│ Electric     │
│ Client SQLite│                         │ Service      │
└──────────────┘                         └──────┬───────┘
                                                │ WAL
                                         ┌──────▼───────┐
                                         │  PostgreSQL  │
                                         └──────────────┘
```

**Key Patterns:**
- ✅ Uses PostgreSQL logical replication (WAL) for change detection
- ✅ "Shape" subscriptions — sync only the data you need
- ✅ Open-source

**What Doesn't Fit:**
- ❌ Requires a separate Electric service
- ❌ Tightly coupled to PostgreSQL
- ❌ Electric Next dropped built-in CRDT support
- ❌ Not yet production-ready (as of early 2025)

**What We Take:**
> The "shape" concept — defining which subset of server data to sync, rather than replicating everything. Also: the idea of decoupling the write path from the read path.

---

### 3. PowerSync

**What it is:** A server-authoritative sync engine for PostgreSQL (and MongoDB) → client SQLite.

**Architecture:**
```
┌──────────────┐       Sync Rules       ┌──────────────┐
│ Client       │◄──────────────────────►│ PowerSync    │
│ SQLite       │       (Buckets)        │ Service      │
└──────────────┘                         └──────┬───────┘
                                                │ WAL / Streams
                                         ┌──────▼───────┐
                                         │  PostgreSQL  │
                                         │  / MongoDB   │
                                         └──────────────┘
```

**Key Patterns:**
- ✅ Server-authoritative conflict resolution
- ✅ Non-invasive — works with any Postgres DB via logical replication
- ✅ Drizzle ORM integration via `@powersync/drizzle-driver`
- ✅ Battle-tested in production (10+ years of evolution)

**What Doesn't Fit:**
- ❌ Requires PowerSync hosted service
- ❌ Client uses SQLite, not IndexedDB (misaligned with our stack)
- ❌ Sync Rules are a proprietary DSL

**What We Take:**
> The adapter pattern for ORM integration (`@powersync/drizzle-driver`). Also: the "Sync Rules / Buckets" concept for scoping what gets synced. And the server-authoritative model as our default conflict strategy.

---

### 4. prisma-idb (`@prisma-idb/idb-client-generator`)

**What it is:** A Prisma generator that creates a type-safe IndexedDB client from your Prisma schema.

**Architecture:**
```
┌──────────────┐       Optional Sync     ┌──────────────┐
│ Generated    │◄───────────────────────►│ Your Server  │
│ IDB Client   │       (Outbox/Pull)     │              │
│ (Prisma-API) │                         │ Prisma +     │
└──────────────┘                         │ PostgreSQL   │
                                         └──────────────┘
```

**Key Patterns:**
- ✅ Single schema (Prisma) defines both client IDB and server DB
- ✅ Prisma-compatible API on the client (familiar DX)
- ✅ Optional bidirectional sync engine
- ✅ DAG-based conflict resolution
- ✅ Outbox pattern for reliable push

**What Doesn't Fit:**
- ❌ Requires Prisma as the ORM (no Drizzle, no raw SQL)
- ❌ Generates a completely separate client (doesn't integrate with an existing IDB library)
- ❌ Tightly couples schema to Prisma schema language

**What We Take:**
> The outbox pattern for reliable pushes. The DAG-based conflict resolution as an advanced option. And the idea that a shared schema can be the bridge between client and server.

---

### 5. Other Notable Projects

| Project         | Approach                                                  | Relevance                                                            |
| --------------- | --------------------------------------------------------- | -------------------------------------------------------------------- |
| **Dexie Cloud** | Sync layer built into Dexie, requires their cloud service | Shows the value of integrated sync, but we don't want vendor lock-in |
| **RxDB**        | Reactive DB with CouchDB-compatible sync                  | Heavier than we want, but great conflict resolution patterns         |
| **PGlite**      | WASM Postgres in the browser, backed by IDB               | We could use this as an alternative local store in the future        |
| **IDBSideSync** | CRDT-based IDB sync, experimental                         | Interesting CRDT-for-IDB approach, but abandoned                     |
| **SyncedDB**    | Lightweight IDB + WebSocket sync with diff tracking       | Closest to what we want architecturally, but unmaintained            |
| **Replicache**  | Predecessor to Zero — generic object sync with IDB        | Many of Zero's ideas came from here                                  |

---

## Competitive Matrix

| Feature                   | Zero           | ElectricSQL | PowerSync   | prisma-idb | **svelte-idb-sync (ours)** |
| ------------------------- | -------------- | ----------- | ----------- | ---------- | -------------------------- |
| Client-first reads        | ✅              | ✅           | ✅           | ✅          | ✅                          |
| Optimistic writes         | ✅              | ⚠️ Tentative | ✅           | ✅          | ✅                          |
| Reactive queries          | ✅              | ❌           | ❌           | ❌          | ✅ (via svelte-idb)         |
| Server authority          | ✅              | ❌ (CRDT)    | ✅           | ✅          | ✅ (default)                |
| Multi-ORM support         | ❌ (PG only)    | ❌ (PG only) | ⚠️ (Drizzle) | ❌ (Prisma) | ✅ (Prisma + Drizzle + raw) |
| No infra requirement      | ❌              | ❌           | ❌           | ✅          | ✅                          |
| IndexedDB native          | ⚠️ (IDB/SQLite) | ❌ (PGlite)  | ❌ (SQLite)  | ✅          | ✅                          |
| Svelte-first              | ❌              | ❌           | ❌           | ❌          | ✅                          |
| Zero-dependency core      | ❌              | ❌           | ❌           | ❌          | ✅                          |
| Framework-agnostic engine | ✅              | ✅           | ✅           | ❌          | ✅                          |
| Open-source               | ✅              | ✅           | Partial     | ✅          | ✅                          |
| Bundle size               | ~50KB+         | ~40KB+      | ~30KB+      | ~15KB+     | **Target: <10KB**          |

---

## Our Unique Value Proposition

1. **Built on top of `svelte-idb`** — reactive queries come free. Zero and PowerSync have to build their own reactivity. We already have it.

2. **No infrastructure requirement** — Zero needs `zero-cache`, PowerSync needs their service, ElectricSQL needs their proxy. We work with any HTTP endpoint or WebSocket you already have.

3. **Multi-ORM + raw SQL** — Nobody else lets you choose between Prisma, Drizzle, or raw queries as your server-side backend adapter.

4. **Tiny bundle** — <10KB for the full sync engine. Every competitor is 30KB+.

5. **Svelte-first** — Deep integration with Svelte 5 runes and SvelteKit conventions.

---

**[Next → 02 Packaging Decision](./02-packaging-decision.md)**
