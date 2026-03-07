# 01 — Research & Competitive Landscape

> Analysis of existing sync solutions and prior art for IndexedDB-to-backend synchronization.

---

## 1. Zero by Rocicorp

**URL:** [zero.rocicorp.dev](https://zero.rocicorp.dev/)  
**Architecture:** PostgreSQL → zero-cache server → SQLite client replica → WebSocket

### How It Works

1. **Server side:** `zero-cache` service connects to PostgreSQL via **logical replication** (WAL streaming). It materializes a SQLite-based replica of relevant data.
2. **Transport:** WebSocket connection between `zero-cache` and each client.
3. **Client side:** Full SQLite replica in the browser. Queries run **locally** against SQLite for instant results.
4. **Mutations:** Optimistic, fire-and-forget. Client writes locally, sends mutation to server. Server decides final state and streams reconciled state back.
5. **Query Language:** ZQL — their own query language that runs against the local SQLite replica.
6. **Custom Mutators:** Server-authoritative mutation functions where business logic lives.

### Relevance to svelte-idb-sync

| Aspect          | Zero                          | Our Approach                 |
| --------------- | ----------------------------- | ---------------------------- |
| Client storage  | SQLite (WASM)                 | IndexedDB (via svelte-idb)   |
| Server database | PostgreSQL only               | Any (Prisma/Drizzle/raw SQL) |
| Infrastructure  | Dedicated zero-cache process  | No extra infrastructure      |
| Query language  | ZQL (proprietary)             | Native svelte-idb API        |
| Pricing         | ~$25/mo cloud, self-host free | Free / open source           |
| Maturity        | Production-ready              | Planned                      |

**Key takeaway:** Zero's architecture is excellent but tightly coupled to PostgreSQL and requires running their `zero-cache` infrastructure. We can offer backend flexibility without this constraint.

---

## 2. Triplit

**URL:** [triplit.dev](https://triplit.dev/)  
**Architecture:** Full-stack syncing database with pluggable storage

### How It Works

1. **Client:** Triplit database with pluggable storage (IndexedDB, SQLite, in-memory).
2. **Server:** Triplit server with pluggable storage (SQLite, Durable Objects).
3. **Sync:** WebSocket-based real-time sync between client and server databases.
4. **Query:** Their own query builder (`client.query('todos').where('completed', '=', false)`).
5. **Framework bindings:** Has Svelte, React, Vue, Angular bindings.
6. **Schema:** Defined in Triplit's own schema format — not your existing DB schema.

### Relevance to svelte-idb-sync

| Aspect          | Triplit                 | Our Approach             |
| --------------- | ----------------------- | ------------------------ |
| Client storage  | Their database          | svelte-idb (IndexedDB)   |
| Server storage  | Their database          | YOUR existing database   |
| ORM integration | None — replaces your DB | Prisma, Drizzle, raw SQL |
| Schema          | Triplit schema format   | svelte-idb DBSchema      |
| Vendor lock-in  | High                    | None                     |

**Key takeaway:** Triplit is a full replacement for your backend database. We complement existing backends instead of replacing them. A Reddit user specifically noted: _"I so wish Triplit was compatible with another ORM like Drizzle"_ — validating our approach.

---

## 3. sveltekit-sync (mudiageo)

**URL:** [github.com/mudiageo/sveltekit-sync](https://github.com/mudiageo/sveltekit-sync)  
**Stars:** ~6 ★ | **Status:** Experimental  
**Architecture:** Local-first sync engine for SvelteKit with adapter pattern

### How It Works

1. **Client adapters:** `IndexedDBAdapter` (currently), planned: SQLite, PGlite.
2. **Server adapters:** `DrizzleAdapter` (currently), planned: Prisma, raw Postgres, MongoDB.
3. **Transport:** SvelteKit's **Remote Functions API** (server functions called from client).
4. **Sync model:** Adapter pattern — client adapter reads/writes local store, server adapter reads/writes backend DB.
5. **SvelteKit-specific:** Deeply tied to SvelteKit server infrastructure.

### API Example

```typescript
// Client-side setup
import { SyncEngine, IndexedDBAdapter } from 'sveltekit-sync/client';

const syncEngine = new SyncEngine({
	clientAdapter: new IndexedDBAdapter({ dbName: 'myapp' })
	// Transport is SvelteKit Remote Functions
});

// Server-side setup
import { DrizzleAdapter } from 'sveltekit-sync/server';

const serverAdapter = new DrizzleAdapter({
	db: drizzleInstance,
	tables: { todos: todosTable }
});
```

### Relevance to svelte-idb-sync

| Aspect         | sveltekit-sync             | Our Approach                             |
| -------------- | -------------------------- | ---------------------------------------- |
| Framework      | SvelteKit only             | Any Svelte app                           |
| Transport      | SvelteKit Remote Functions | Pluggable (HTTP, WS, SSE, SK functions)  |
| Client storage | Generic IndexedDB          | svelte-idb (reactive)                    |
| Reactivity     | Manual                     | Automatic via LiveQuery integration      |
| Maturity       | Experimental (6 ★)         | Planned (backed by svelte-idb community) |

**Key takeaway:** Closest existing solution to what we want. However, it's locked to SvelteKit's server runtime. We should be transport-agnostic and work with any Svelte app (not just SvelteKit). We can support SvelteKit server functions as ONE transport option.

---

## 4. prisma-idb / idb-client-generator

**URL:** [github.com/nicksulkers/prisma-idb](https://github.com/nicksulkers/prisma-idb)  
**Stars:** ~8 ★ | **Version:** v0.31.0 | **License:** AGPL-3.0  
**Architecture:** Prisma generator → IndexedDB client with sync

### How It Works

1. **Code generation:** A Prisma generator that reads your `schema.prisma` file and generates a full IndexedDB client with Prisma-like API.
2. **API surface:** Generated code provides `.create()`, `.findMany()`, `.update()`, `.delete()` matching Prisma's query API — but running against IndexedDB.
3. **Bidirectional sync:**
   - **Push:** Outbox pattern — queued local changes sent to server with retry.
   - **Pull:** Changelog materialization — server sends incremental changes.
4. **Conflict resolution:** DAG-based resolution — the server builds a directed acyclic graph of changes and determines the authoritative merge.
5. **Authorization:** Row-level ownership and access control.

### Relevance to svelte-idb-sync

| Aspect              | prisma-idb                             | Our Approach                        |
| ------------------- | -------------------------------------- | ----------------------------------- |
| Integration         | Prisma only (code generation)          | Prisma, Drizzle, raw SQL (adapters) |
| Client API          | Prisma-like API on IndexedDB           | svelte-idb native API               |
| Code gen required   | Yes (schema.prisma → IndexedDB client) | No — uses existing svelte-idb       |
| Reactivity          | None (vanilla JS)                      | Svelte 5 reactive (LiveQuery)       |
| Conflict resolution | DAG-based (sophisticated)              | Pluggable (LWW default)             |
| License             | AGPL-3.0 (restrictive)                 | MIT                                 |

**Key takeaway:** prisma-idb is impressive but tightly coupled to Prisma's code-generation paradigm. The AGPL license is also restrictive for many commercial uses. Our approach is runtime-based (no code gen needed) and adapter-based (not locked to one ORM).

---

## 5. synceddb

**URL:** [github.com/nicksulkers/synceddb](https://github.com/nicksulkers/synceddb)  
**Stars:** ~57 ★  
**Architecture:** Fork of `idb` library adding REST API sync

### How It Works

1. **Client:** Fork of Jake Archibald's `idb` library (the gold-standard IndexedDB wrapper).
2. **Sync:** Adds a REST API sync layer on top of `idb` operations.
3. **Pull strategy:** Periodically fetches changes from a REST endpoint.
4. **Push strategy:** Sends local changes to a REST endpoint on write.
5. **Simple model:** No CRDT, no complex conflict resolution — basic REST sync.

### Relevance to svelte-idb-sync

| Aspect              | synceddb         | Our Approach                   |
| ------------------- | ---------------- | ------------------------------ |
| Base library        | idb (vanilla JS) | svelte-idb (Svelte 5 reactive) |
| Sync protocol       | REST-only        | Pluggable transport            |
| Conflict resolution | Basic            | Pluggable (LWW, custom)        |
| Framework           | None             | Svelte 5                       |
| Type safety         | Basic            | Full TypeScript generics       |

**Key takeaway:** Validates the "extension library adds sync" pattern, but synceddb is minimal and doesn't provide ORM adapters or conflict resolution.

---

## 6. Other Notable Projects

### sync-engine-web

- **Stack:** Dexie (IndexedDB) + **Loro CRDT** + Drizzle ORM + PostgreSQL + Web Workers + Effect
- **Relevance:** Shows Drizzle + IndexedDB + CRDT is a viable architecture. Uses Web Workers for sync processing.

### SQLocal

- **Stack:** SQLite in browser via OPFS + WASM, compatible with **Drizzle** and **Kysely**
- **Relevance:** Alternative client storage (SQLite instead of IndexedDB). Could be a future client adapter.

### PGlite

- **Stack:** PostgreSQL in browser via WASM
- **Relevance:** Another alternative client storage. Enables running Drizzle on the client side too.

### ElectricSQL

- **Stack:** PostgreSQL → Electric service → SQLite client (local-first)
- **Relevance:** Similar to Zero but with a different sync protocol. Also PostgreSQL-only.

---

## 7. Landscape Summary

```
                    ┌─────────────────────────────────────────────┐
                    │         Sync Solution Landscape             │
                    ├─────────────────────────────────────────────┤
                    │                                             │
   Full Replacement │  Zero ◆    Triplit ◆    ElectricSQL ◆      │
   (new DB + server)│  (Postgres) (own DB)    (Postgres)         │
                    │                                             │
                    ├─────────────────────────────────────────────┤
                    │                                             │
   Code Generation  │  prisma-idb ◆                              │
                    │  (Prisma → IDB client)                     │
                    │                                             │
                    ├─────────────────────────────────────────────┤
                    │                                             │
   Adapter/Plugin   │  sveltekit-sync ◆   synceddb ◆            │
   (your DB + ORM)  │  (SK-only)          (REST-only)           │
                    │                                             │
                    │  ┌─────────────────────────────┐           │
                    │  │  svelte-idb-sync ★ (OURS)   │           │
                    │  │  • Any backend DB/ORM       │           │
                    │  │  • Svelte 5 reactive        │           │
                    │  │  • Pluggable everything      │           │
                    │  │  • No infrastructure         │           │
                    │  └─────────────────────────────┘           │
                    │                                             │
                    └─────────────────────────────────────────────┘
```

## 8. Key Insights from Research

1. **No existing solution offers backend flexibility WITH Svelte reactivity.** This is our gap to fill.
2. **The adapter pattern is the dominant architecture** for flexible sync engines.
3. **LWW is sufficient for 80%+ of use cases.** CRDTs add complexity most apps don't need.
4. **HTTP transport is the universal starting point.** WebSocket/SSE for real-time can come later.
5. **SvelteKit server functions are compelling** but shouldn't be the ONLY transport.
6. **Code generation (prisma-idb) vs. runtime adapters** — runtime adapters are more flexible and don't require build steps.
7. **The biggest validation:** A Reddit user in the Svelte community explicitly wished Triplit worked with Drizzle. Our approach directly addresses this need.

---

**[← 00 README](./00-README.md)** | **[Next → 02 Architecture Options](./02-architecture-options.md)**
