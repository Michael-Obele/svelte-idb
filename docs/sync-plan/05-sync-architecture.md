# 05 — Sync Architecture

> Data-flow diagrams, change tracking, transport protocols, and the complete sync lifecycle.

**← [04 ORM & Backend Adapters](./04-orm-backend-adapters.md)** | **[Next → 06 API Design](./06-api-design.md)**

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Browser                                 │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌────────────────┐ │
│  │  Svelte App  │───►│ svelte-idb   │───►│   IndexedDB    │ │
│  │  (UI Layer)  │◄───│ (Core)       │◄───│   (Browser)    │ │
│  └──────────────┘    └───────┬──────┘    └────────────────┘ │
│                              │                               │
│                      ┌───────▼──────┐    ┌────────────────┐ │
│                      │ svelte-idb-  │───►│  __sync_oplog  │ │
│                      │ sync         │◄───│  __sync_meta   │ │
│                      │ (Sync Engine)│    │  (IDB stores)  │ │
│                      └───────┬──────┘    └────────────────┘ │
│                              │                               │
└──────────────────────────────┼───────────────────────────────┘
                               │
                    HTTP / WebSocket
                               │
┌──────────────────────────────┼───────────────────────────────┐
│                      Server  │                                │
│                              │                                │
│                      ┌───────▼──────┐                        │
│                      │  Sync Route  │  /api/sync             │
│                      │  (SvelteKit) │                        │
│                      └───────┬──────┘                        │
│                              │                                │
│                      ┌───────▼──────┐                        │
│                      │   Adapter    │  Prisma / Drizzle / PG │
│                      └───────┬──────┘                        │
│                              │                                │
│                      ┌───────▼──────┐                        │
│                      │  Database    │  PostgreSQL / SQLite    │
│                      └──────────────┘                        │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

---

## Sync Engine Components

```
svelte-idb-sync/
├── core/
│   ├── sync-engine.ts          ← Orchestrator — coordinates push/pull cycles
│   ├── oplog.ts                ← Persistent operation log in IndexedDB
│   ├── sync-state.ts           ← Tracks cursor, last sync, connection status
│   ├── conflict-resolver.ts    ← Applies conflict resolution strategies
│   ├── change-tracker.ts       ← Intercepts svelte-idb mutations
│   ├── transport/
│   │   ├── types.ts            ← Transport interface
│   │   ├── http.ts             ← HTTP polling transport
│   │   └── websocket.ts        ← WebSocket real-time transport
│   └── types.ts                ← All type definitions
│
├── adapters/                   ← Server-side (not bundled for browser)
│   ├── prisma.ts
│   ├── drizzle.ts
│   ├── raw-pg.ts
│   └── raw-sqlite.ts
│
└── svelte/
    ├── index.ts                ← Re-exports Svelte-specific API
    ├── sync-status.svelte.ts   ← Reactive sync status ($state)
    └── use-sync.svelte.ts      ← Svelte hook for sync lifecycle
```

---

## Data Flow: Write Path (Optimistic)

```
User clicks "Save"
    │
    ▼
db.users.put({ id: 1, name: "Alice Updated" })
    │
    ├──────────────────── svelte-idb handles this:
    │                     1. Write to IndexedDB
    │                     2. Notify ChangeNotifier
    │                     3. LiveQueries update (UI re-renders)
    │
    ▼
ChangeTracker intercepts mutation
    │
    ├── 1. Create SyncOperation:
    │       {
    │         id: "uuid-123",
    │         storeName: "users",
    │         type: "update",
    │         key: 1,
    │         value: { id: 1, name: "Alice Updated" },
    │         timestamp: hlc.now(),
    │         status: "pending"
    │       }
    │
    ├── 2. Write to __sync_oplog store in IndexedDB
    │
    └── 3. Schedule push (debounced, batched)

... debounce timer fires (default: 1 second) ...

SyncEngine.push()
    │
    ├── 1. Read all "pending" operations from __sync_oplog
    │
    ├── 2. Batch into a single HTTP request
    │       POST /api/sync { action: "push", payload: [...operations] }
    │
    ├── 3. Server adapter processes each operation
    │       ├── No conflict → applied
    │       └── Conflict → returns serverRecord
    │
    ├── 4. Handle results:
    │       ├── applied → mark oplog entry as "synced"
    │       ├── conflict → run ConflictResolver
    │       │     ├── server-wins → update IDB with server version
    │       │     ├── client-wins → re-push with force flag
    │       │     ├── lww → compare timestamps, apply winner
    │       │     └── custom → call user's resolver function
    │       └── error → mark as "failed", retry later
    │
    └── 5. Update __sync_meta with latest server cursor
```

---

## Data Flow: Read Path (Pull)

```
SyncEngine.pull() — triggered by:
  • Timer (polling interval)
  • WebSocket notification
  • User action (manual refresh)
  • App coming online (visibilitychange / online event)
    │
    ▼
POST /api/sync { action: "pull", payload: { cursor: "2024-03-15T...", stores: ["users", "invoices"] } }
    │
    ▼
Server adapter queries database
    │
    ├── Prisma:  prisma.user.findMany({ where: { updatedAt: { gt: cursor } } })
    ├── Drizzle: db.select().from(users).where(gt(users.updatedAt, cursor))
    └── Raw PG:  SELECT * FROM users WHERE updated_at > $1
    │
    ▼
Returns PullResponse: { changes: [...], cursor: "2024-03-15T10:05:00Z", hasMore: false }
    │
    ▼
SyncEngine processes changes:
    │
    ├── For each upsert:
    │     ├── Check if local record exists
    │     │     ├── No → db.store.add(serverRecord)
    │     │     └── Yes → check for pending local changes
    │     │           ├── No pending changes → db.store.put(serverRecord)
    │     │           └── Has pending changes → CONFLICT
    │     │                 └── Run ConflictResolver (same as push path)
    │     └── LiveQueries auto-update via ChangeNotifier
    │
    ├── For each delete:
    │     └── db.store.delete(key)
    │
    └── Update __sync_meta cursor
```

---

## Internal IndexedDB Stores

The sync engine creates additional IDB stores to manage sync state:

```
__sync_oplog
┌─────────┬───────────┬────────┬─────┬────────────────────────┬──────────┐
│  id      │ storeName │ type   │ key │ value                  │ status   │
├─────────┼───────────┼────────┼─────┼────────────────────────┼──────────┤
│ uuid-1  │ users     │ update │  1  │ { name: "Alice ..." }  │ pending  │
│ uuid-2  │ invoices  │ create │  5  │ { total: 100 }         │ synced   │
│ uuid-3  │ users     │ delete │  3  │ null                   │ failed   │
└─────────┴───────────┴────────┴─────┴────────────────────────┴──────────┘

__sync_meta
┌───────────┬─────────────────────────────┬──────────────────┐
│ key       │ value                        │ updatedAt        │
├───────────┼─────────────────────────────┼──────────────────┤
│ cursor    │ "2024-03-15T10:05:00Z"      │ 2024-03-15T...   │
│ clientId  │ "node-abc123"               │ 2024-03-14T...   │
│ lastSync  │ "2024-03-15T10:05:00Z"      │ 2024-03-15T...   │
│ lastPush  │ "2024-03-15T10:04:55Z"      │ 2024-03-15T...   │
└───────────┴─────────────────────────────┴──────────────────┘
```

---

## Transport Layer

The sync engine communicates with the server through a pluggable transport:

### Transport Interface

```typescript
interface SyncTransport {
  /** Push operations to the server */
  push(operations: SyncOperation[]): Promise<PushResult[]>;

  /** Pull changes from the server */
  pull(request: PullRequest): Promise<PullResponse>;

  /** Subscribe to real-time server changes (optional) */
  subscribe?(callback: (changes: ServerChange[]) => void): () => void;

  /** Connection status */
  readonly connected: boolean;

  /** Disconnect and cleanup */
  dispose(): void;
}
```

### HTTP Transport (Default)

```typescript
import { httpTransport } from 'svelte-idb-sync';

const sync = createSync(db, {
  transport: httpTransport({
    endpoint: '/api/sync',
    // Polling interval for pull (default: 30 seconds)
    pollInterval: 30_000,
    // Retry configuration
    retry: {
      maxAttempts: 5,
      backoff: 'exponential', // 1s, 2s, 4s, 8s, 16s
    },
    // Authentication header
    headers: () => ({
      Authorization: `Bearer ${getToken()}`,
    }),
  }),
  // ...
});
```

### WebSocket Transport (Real-Time)

```typescript
import { wsTransport } from 'svelte-idb-sync';

const sync = createSync(db, {
  transport: wsTransport({
    url: 'wss://myapp.com/sync',
    // Auto-reconnect with backoff
    reconnect: true,
    // Also push via WebSocket (default: use HTTP for push)
    pushViaWs: false,
    // Authentication
    getToken: () => getToken(),
  }),
  // ...
});
```

### Transport Priority

| Transport        | Best For                                | Latency                  | Complexity |
| ---------------- | --------------------------------------- | ------------------------ | ---------- |
| **HTTP Polling** | Simple apps, low-frequency changes      | 🟡 Medium (poll interval) | 🟢 Low      |
| **WebSocket**    | Real-time apps, collaborative editing   | 🟢 Low (instant push)     | 🟡 Medium   |
| **HTTP + SSE**   | Read-heavy apps needing real-time reads | 🟢 Low (server→client)    | 🟡 Medium   |

> **Default:** HTTP polling. It's the simplest, most reliable, and works with every hosting platform. WebSocket is opt-in for apps that need real-time updates.

---

## Sync Lifecycle

```
┌────────────────────────────────────────────────────────────────┐
│                    Sync Engine Lifecycle                         │
│                                                                  │
│  App Start                                                       │
│    │                                                             │
│    ├── 1. Initialize sync engine                                 │
│    ├── 2. Read __sync_meta (last cursor, clientId)               │
│    ├── 3. Check for pending ops in __sync_oplog                  │
│    │     └── If found → schedule immediate push                  │
│    ├── 4. Start pull (catch up with server)                     │
│    └── 5. Start transport (polling / WebSocket)                  │
│                                                                  │
│  Running                                                         │
│    │                                                             │
│    ├── On mutation → ChangeTracker → oplog → schedule push      │
│    ├── On poll timer → pull changes                              │
│    ├── On WS message → apply server changes                     │
│    ├── On online event → flush pending ops                      │
│    └── On visibility change → resume/pause sync                 │
│                                                                  │
│  App Close / Tab Close                                           │
│    │                                                             │
│    ├── 1. Flush any pending push (best-effort via beforeunload)  │
│    ├── 2. Persist oplog state                                    │
│    └── 3. Close transport connection                             │
│                                                                  │
│  App Re-Open                                                     │
│    │                                                             │
│    └── 1. Resume from __sync_oplog (pending ops survive restart) │
│                                                                  │
└────────────────────────────────────────────────────────────────┘
```

---

## Offline Behavior

### Queue and Retry Pattern

```
Online:
  User edits → IDB write → oplog → push → server ✅

Offline:
  User edits → IDB write → oplog → push → FAILS → retry later
                                    ↑ status: "pending"

Back Online:
  visibilitychange / online event → flush pending ops:
    oplog[status="pending"].forEach(op => push(op))
```

### What the User Sees

```svelte
<script lang="ts">
  import { syncStatus } from 'svelte-idb-sync/svelte';

  const status = syncStatus(sync);
  // status.current = 'synced' | 'syncing' | 'offline' | 'error'
  // status.pendingCount = number of unsynced operations
  // status.lastSyncedAt = Date
</script>

{#if status.current === 'offline'}
  <Banner type="warning">
    You're offline. Changes saved locally.
    {status.pendingCount} changes waiting to sync.
  </Banner>
{:else if status.current === 'error'}
  <Banner type="error">
    Sync error. <button onclick={sync.retry}>Retry</button>
  </Banner>
{/if}
```

---

## Batching & Debouncing Strategy

To avoid overwhelming the server with individual operations:

```
User types → update field → 50ms → update field → 50ms → update field
                                                              │
                                                              ▼
                                                    1 second debounce
                                                              │
                                                              ▼
                                                    Batch: 3 updates
                                                    collapsed into 1
                                                    POST /api/sync
```

### Collapsing Rules

| Sequence                  | Result                           |
| ------------------------- | -------------------------------- |
| `add(X)` → `update(X)`    | Single `create` with final value |
| `update(X)` → `update(X)` | Single `update` with final value |
| `add(X)` → `delete(X)`    | **No operation** (cancel out)    |
| `update(X)` → `delete(X)` | Single `delete`                  |

---

## Size Budget

| Module                 | Target Size (min+gz) | Notes                        |
| ---------------------- | -------------------- | ---------------------------- |
| Sync engine core       | ~3KB                 | Oplog, state, change tracker |
| Conflict resolver      | ~1KB                 | Strategy implementation      |
| HTTP transport         | ~1KB                 | Fetch + retry logic          |
| WebSocket transport    | ~1KB                 | WS + reconnect               |
| **Total (client)**     | **~6KB**             | Without adapters             |
| Svelte hooks           | ~500B                | Reactive status              |
| **Full client bundle** | **~6.5KB**           |                              |

Adapters are server-only and don't affect client bundle size.

---

**← [04 ORM & Backend Adapters](./04-orm-backend-adapters.md)** | **[Next → 06 API Design](./06-api-design.md)**
