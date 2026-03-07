# 07 — Implementation Roadmap

> Phased milestones from svelte-idb core prerequisites through sync layer v1.0.

---

## Phases Overview

| Phase | Name                  | Scope                                          | Depends On |
| ----- | --------------------- | ---------------------------------------------- | ---------- |
| **0** | Core Prerequisites    | Add hooks & internals to svelte-idb            | —          |
| **1** | Sync Engine MVP       | Change log, cursor, engine skeleton            | Phase 0    |
| **2** | HTTP Push/Pull        | Transport, push, pull, LWW conflict resolution | Phase 1    |
| **3** | Drizzle Adapter       | Server adapter for Drizzle ORM                 | Phase 2    |
| **4** | Prisma Adapter        | Server adapter for Prisma                      | Phase 2    |
| **5** | Raw SQL Adapters      | PostgreSQL & SQLite server adapters            | Phase 2    |
| **6** | Svelte Reactive Layer | `useSyncStatus`, reactive sync state           | Phase 2    |
| **7** | Real-Time & Advanced  | WebSocket, SSE, cross-tab, selective sync      | Phase 3+   |
| **8** | DX & Documentation    | Guides, demo app, debug tools                  | Phase 6+   |
| **9** | v1.0 Release          | Stabilize, npm publish, announcement           | Phase 8    |

---

## Phase 0: svelte-idb Core Prerequisites

> **Goal:** Add minimal hooks and internals to svelte-idb that the sync layer needs.  
> **Ship as:** svelte-idb minor version bump (non-breaking)  
> **Timeline:** ~1–2 days

### Tasks

- [ ] **0.1** Add `StoreHooks` type: `afterAdd`, `afterPut`, `afterDelete`, `afterClear`
- [ ] **0.2** Add hooks registration to `Store<T>` — each Store accepts optional hooks via config or a `.hooks` property
- [ ] **0.3** Fire hooks after each successful IDB transaction in `Store.add()`, `.put()`, `.delete()`, `.clear()`
- [ ] **0.4** Add `Database.rawDatabase` getter — expose the underlying `IDBDatabase` reference
- [ ] **0.5** Add `ChangeNotifier.manualNotify(storeName)` — allow external triggers for LiveQuery updates
- [ ] **0.6** Add tests for all new hooks (Vitest Browser Mode)
- [ ] **0.7** Add tests for `rawDatabase` access
- [ ] **0.8** Add tests for `manualNotify`
- [ ] **0.9** Update svelte-idb API docs to document new internals
- [ ] **0.10** Release svelte-idb with new features

### Acceptance Criteria

- Store hooks fire reliably after each mutation
- `rawDatabase` provides a valid `IDBDatabase` reference
- `manualNotify` triggers LiveQuery re-evaluation
- All existing tests still pass (no regressions)

---

## Phase 1: Sync Engine MVP — Local Change Tracking

> **Goal:** Create `svelte-idb-sync` package with reliable local change tracking.  
> **No network operations yet** — just logging changes and managing cursors.  
> **Timeline:** ~3–4 days

### Tasks

- [ ] **1.1** Scaffold `svelte-idb-sync` package (package.json, tsconfig, vitest config)
- [ ] **1.2** Implement `SyncMetaDB` — internal IndexedDB database (`${dbName}__sync_meta`) with stores: `__changelog`, `__cursor`, `__client_info`
- [ ] **1.3** Implement `ClientIdentity` — generate + persist unique client ID (`crypto.randomUUID()`)
- [ ] **1.4** Implement `ChangeLog` class:
  - `log(entry: ChangeEntry)` — write a change entry
  - `getPending()` — get all entries with `status: 'pending'`
  - `markSynced(ids: string[])` — update status to `'synced'`
  - `markFailed(id: string, error: string)` — update status + increment attempts
  - `coalesce()` — merge multiple changes to the same key
  - `cleanup(options)` — remove old synced entries
- [ ] **1.5** Implement `SyncCursor` class:
  - `get(storeName)` — get cursor position for a store
  - `set(storeName, position)` — update cursor position
  - `getAll()` — get all cursors
- [ ] **1.6** Implement `createSync()` factory function:
  - Accepts `Database` + `SyncConfig`
  - Opens sync meta DB
  - Registers hooks on each synced Store
  - Returns `SyncEngine` instance (with stub sync methods)
- [ ] **1.7** Implement hook integration:
  - `afterAdd` → log change entry with operation `'add'`
  - `afterPut` → log change entry with operation `'put'`
  - `afterDelete` → log change entry with operation `'delete'`
- [ ] **1.8** Write tests: ChangeLog CRUD operations
- [ ] **1.9** Write tests: SyncCursor persistence
- [ ] **1.10** Write tests: createSync creates hooks that log changes
- [ ] **1.11** Write tests: Change coalescing logic

### Acceptance Criteria

- `createSync(db, config)` returns a `SyncEngine`
- Every `add`/`put`/`delete` on a synced store creates a `ChangeEntry` in the changelog
- Changelog entries have correct `operation`, `key`, `value`, `clientId`, `timestamp`
- Cursor positions persist across page reloads
- Coalescing reduces multiple changes to the same key

---

## Phase 2: HTTP Push/Pull + Conflict Resolution

> **Goal:** Implement actual network sync via HTTP transport with LWW conflict resolution.  
> **Timeline:** ~4–5 days

### Tasks

- [ ] **2.1** Define `ServerAdapter` interface (TypeScript types)
- [ ] **2.2** Define `Transport` interface (TypeScript types)
- [ ] **2.3** Implement `httpTransport`:
  - `send(request: SyncRequest)` → fetch POST to endpoint
  - Error handling, timeout support
  - Auth header injection (via config function)
- [ ] **2.4** Implement `SyncEngine.push()`:
  - Read pending changes from changelog
  - Mark as `'pushing'`
  - Send via transport
  - On success: mark `'synced'`
  - On failure: mark `'pending'`, increment attempts, schedule retry
- [ ] **2.5** Implement `SyncEngine.pull()`:
  - Read cursor position
  - Request changes from server via transport
  - For each remote change:
    - Skip if from this client
    - Check for conflict (local pending change for same key)
    - Apply conflict resolution
    - Write to svelte-idb Store (direct IDB write, bypassing hooks)
    - Trigger `manualNotify()` for LiveQuery updates
  - Update cursor
- [ ] **2.6** Implement `SyncEngine.sync()` (bidirectional):
  - Combine push + pull in single transport call
  - Process results
- [ ] **2.7** Implement built-in conflict resolvers:
  - `lww()` — Last-Write-Wins based on timestamp
  - `serverWins()` — always take remote
  - `clientWins()` — always take local
- [ ] **2.8** Implement retry logic with exponential backoff:
  - Configurable: maxRetries, baseDelay, maxDelay, backoffMultiplier, jitter
  - Failed changes stay in changelog as `'pending'` for retry
- [ ] **2.9** Implement auto mode:
  - Pull on `pullInterval` timer
  - Push immediately on write (debounced via microtask)
  - Start/stop lifecycle
- [ ] **2.10** Implement online/offline detection:
  - `navigator.onLine` monitoring
  - Reconnect → trigger immediate sync
- [ ] **2.11** Implement `createSyncHandler()` (server-side):
  - Framework-agnostic request handler
  - Routes to adapter `applyChanges` / `getChangesSince`
  - Returns JSON responses
- [ ] **2.12** Write tests: HTTP transport (with mock server)
- [ ] **2.13** Write tests: Push flow (pending → pushing → synced)
- [ ] **2.14** Write tests: Pull flow (apply remote changes)
- [ ] **2.15** Write tests: Conflict resolution (LWW, server-wins, client-wins)
- [ ] **2.16** Write tests: Retry with exponential backoff
- [ ] **2.17** Write tests: Bidirectional sync
- [ ] **2.18** Write tests: Online/offline transitions

### Acceptance Criteria

- Client can push local changes to a sync endpoint
- Client can pull remote changes from a sync endpoint
- Bidirectional sync works in single round trip
- LWW correctly resolves conflicts based on timestamps
- Failed pushes retry with exponential backoff
- Auto mode polls on interval and pushes immediately
- Offline changes accumulate and sync on reconnect
- `createSyncHandler` provides a working server endpoint handler

---

## Phase 3: Drizzle Server Adapter

> **Goal:** First server adapter — Drizzle ORM (most popular in Svelte ecosystem).  
> **Timeline:** ~2–3 days

### Tasks

- [ ] **3.1** Implement `drizzleAdapter()` factory
- [ ] **3.2** Implement `applyChanges()`:
  - Map store names to Drizzle tables
  - Convert operations: add → insert, put → upsert, delete → delete
  - Log changes to `_sync_changes` tracking table
  - Run in Drizzle transaction
- [ ] **3.3** Implement `getChangesSince()`:
  - Query `_sync_changes` table for records after cursor position
  - Paginate with `LIMIT` + `hasMore` flag
  - Return new cursor position
- [ ] **3.4** Implement `initialize()`:
  - Auto-create `_sync_changes` table via Drizzle schema or raw SQL
  - Create necessary indexes
- [ ] **3.5** Write integration tests: Drizzle + SQLite (in-memory for CI)
- [ ] **3.6** Write integration tests: Full round trip (client → server → Drizzle → response)
- [ ] **3.7** Document: Drizzle adapter setup guide

### Acceptance Criteria

- Drizzle adapter correctly inserts/upserts/deletes records in user's tables
- Change tracking table records all server-side operations
- `getChangesSince` returns paginated changes with correct cursor
- Integration test demonstrates full sync loop

---

## Phase 4: Prisma Server Adapter

> **Goal:** Prisma adapter for teams using Prisma ORM.  
> **Timeline:** ~2–3 days

### Tasks

- [ ] **4.1** Implement `prismaAdapter()` factory
- [ ] **4.2** Implement `applyChanges()`:
  - Map store names to Prisma model names
  - Convert operations: add → create, put → upsert, delete → delete
  - Log to SyncChange model
  - Run in Prisma interactive transaction
- [ ] **4.3** Implement `getChangesSince()`:
  - Query SyncChange model
  - Paginate with cursor
- [ ] **4.4** Implement `initialize()`:
  - Auto-create `_sync_changes` table via `$executeRaw`
  - Or document manual schema.prisma addition
- [ ] **4.5** Write integration tests with Prisma + SQLite
- [ ] **4.6** Document: Prisma adapter setup guide

---

## Phase 5: Raw SQL Adapters

> **Goal:** Server adapters for raw PostgreSQL and SQLite.  
> **Timeline:** ~2–3 days

### Tasks

- [ ] **5.1** Implement `pgAdapter()` — raw PostgreSQL via `postgres.js` or `pg`
- [ ] **5.2** Implement `sqliteAdapter()` — raw SQLite via `better-sqlite3`
- [ ] **5.3** Support LibSQL/Turso dialect in sqlite adapter
- [ ] **5.4** Column mapping support (IDB field name → DB column name)
- [ ] **5.5** Write tests: raw PostgreSQL adapter
- [ ] **5.6** Write tests: raw SQLite adapter
- [ ] **5.7** Document: Raw SQL adapter setup guides

---

## Phase 6: Svelte Reactive Layer

> **Goal:** Svelte 5 reactive bindings for sync status.  
> **Timeline:** ~1–2 days

### Tasks

- [ ] **6.1** Implement `useSyncStatus()` in `.svelte.ts`:
  - Returns object with `$state` fields: `state`, `isOnline`, `isSyncing`, `pendingCount`, `lastSyncAt`, `lastError`
  - Subscribes to SyncEngine events
- [ ] **6.2** Create `SyncStatusBadge.svelte` example component
- [ ] **6.3** Write tests: reactive status updates when sync state changes
- [ ] **6.4** Document: reactive binding usage

---

## Phase 7: Real-Time & Advanced Features

> **Goal:** WebSocket/SSE transports, cross-tab coordination, selective sync.  
> **Timeline:** ~5–7 days

### Tasks

- [ ] **7.1** Implement `websocketTransport`:
  - Auto-reconnect with backoff
  - Heartbeat / keep-alive
  - `subscribe()` for server-initiated pushes
- [ ] **7.2** Implement SSE transport (server-sent events for pull, HTTP for push)
- [ ] **7.3** Implement `sveltekitTransport` (SvelteKit server functions)
- [ ] **7.4** Implement cross-tab coordination:
  - Leader election via BroadcastChannel
  - Leader tab handles network sync
  - Follower tabs send changes to leader via BroadcastChannel
  - Leader broadcasts pull results to all tabs
- [ ] **7.5** Implement selective sync:
  - Per-store filter functions
  - Initial sync with filters
- [ ] **7.6** Implement `fieldLevelLWW()` conflict resolver
- [ ] **7.7** Implement `SyncEngine.on()` event system
- [ ] **7.8** Write tests for WebSocket transport
- [ ] **7.9** Write tests for cross-tab coordination
- [ ] **7.10** Write tests for selective sync filters

---

## Phase 8: DX & Documentation

> **Goal:** Developer experience polish, guides, and demo app.  
> **Timeline:** ~3–5 days

### Tasks

- [ ] **8.1** Debug mode:
  - Log all sync operations to console
  - Show change log contents
  - Show conflict resolution decisions
- [ ] **8.2** Write guide: "Adding Sync to an Existing svelte-idb App"
- [ ] **8.3** Write guide: "SvelteKit + Drizzle + svelte-idb-sync"
- [ ] **8.4** Write guide: "SvelteKit + Prisma + svelte-idb-sync"
- [ ] **8.5** Write guide: "Raw PostgreSQL / SQLite sync setup"
- [ ] **8.6** Write guide: "Custom Conflict Resolution"
- [ ] **8.7** Write guide: "Offline-First with svelte-idb-sync"
- [ ] **8.8** Create demo app (showcase on svelte-idb docs site):
  - Multi-tab todo app with real-time sync
  - Shows sync status, offline mode, conflict resolution
- [ ] **8.9** Add API reference to docs site
- [ ] **8.10** README.md for svelte-idb-sync package

---

## Phase 9: v1.0 Release

> **Goal:** Stabilize, publish, and announce.  
> **Timeline:** ~2–3 days

### Tasks

- [ ] **9.1** API review: ensure all public types are well-named and documented
- [ ] **9.2** Confirm peer dependency compatibility with svelte-idb
- [ ] **9.3** Set up npm publish pipeline for `svelte-idb-sync`
- [ ] **9.4** Configure package.json exports (sub-path exports for adapters, transports, resolvers)
- [ ] **9.5** Write CHANGELOG.md
- [ ] **9.6** Publish v1.0.0 to npm
- [ ] **9.7** Announce on Svelte Discord, Reddit r/sveltejs, Twitter/X

---

## Dependency Graph

```
Phase 0 (svelte-idb hooks)
    │
    ▼
Phase 1 (Sync Engine MVP)
    │
    ▼
Phase 2 (HTTP Push/Pull + LWW)
    │
    ├──▶ Phase 3 (Drizzle Adapter)
    │
    ├──▶ Phase 4 (Prisma Adapter)
    │
    ├──▶ Phase 5 (Raw SQL Adapters)
    │
    └──▶ Phase 6 (Svelte Reactive)
              │
              ▼
         Phase 7 (Real-Time & Advanced)
              │
              ▼
         Phase 8 (DX & Docs)
              │
              ▼
         Phase 9 (v1.0 Release)
```

Phases 3, 4, 5, and 6 can run **in parallel** after Phase 2 is complete.

---

## Estimated Timeline

| Phase   | Duration | Cumulative        |
| ------- | -------- | ----------------- |
| Phase 0 | 1–2 days | 1–2 days          |
| Phase 1 | 3–4 days | 4–6 days          |
| Phase 2 | 4–5 days | 8–11 days         |
| Phase 3 | 2–3 days | 10–14 days        |
| Phase 4 | 2–3 days | (parallel with 3) |
| Phase 5 | 2–3 days | (parallel with 3) |
| Phase 6 | 1–2 days | (parallel with 3) |
| Phase 7 | 5–7 days | 15–21 days        |
| Phase 8 | 3–5 days | 18–26 days        |
| Phase 9 | 2–3 days | 20–29 days        |

**Estimated total: ~4–6 weeks** from start to v1.0 (with focused development).

**MVP (Phase 0–3) is usable in ~2 weeks:** Local change tracking + HTTP sync + Drizzle adapter. This is enough for early adopters and feedback.

---

## Risk Register

| Risk                                  | Likelihood | Impact | Mitigation                                                 |
| ------------------------------------- | ---------- | ------ | ---------------------------------------------------------- |
| Edge cases in conflict resolution     | High       | High   | Extensive testing, start with simplest strategy (LWW)      |
| svelte-idb hook API changes           | Low        | High   | Version pinning, peer dependency ranges                    |
| Type safety across IDB ↔ ORM boundary | Medium     | Medium | Key mapping layer with explicit column mapping config      |
| Changelog growth / storage pressure   | Medium     | Low    | Auto-cleanup with configurable retention                   |
| Cross-tab sync race conditions        | High       | Medium | Leader election, BroadcastChannel coordination             |
| Transport reconnection reliability    | Medium     | Medium | Battle-tested WebSocket reconnect libraries                |
| Clock skew in LWW                     | Low        | Medium | Hybrid Logical Clocks option, server timestamp calibration |

---

**[← 06 API Design](./06-api-design.md)** | **[Back to README →](./00-README.md)**
