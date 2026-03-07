# 05 — Sync Protocol & Data Flow

> Change log format, push/pull mechanics, sync cursor, offline support, and the complete data flow for svelte-idb-sync.

---

## Overview

The sync protocol is built on these concepts:

1. **Change Log** — Every local mutation is recorded in an internal IndexedDB store
2. **Sync Cursor** — A bookmark tracking what has been synced so far
3. **Outbox** — A queue of unsynced changes waiting to be pushed
4. **Push** — Send local changes to the server
5. **Pull** — Fetch remote changes from the server
6. **Merge** — Apply remote changes locally, resolving conflicts

---

## 1. Change Log

### Storage

The change log is stored in a **separate IndexedDB database** named `${dbName}__sync_meta`. This avoids modifying the user's database schema or triggering version upgrades.

```
User's database: "myapp" (version 1)
├── todos (user store)
├── users (user store)

Sync metadata database: "myapp__sync_meta" (managed by sync layer)
├── __changelog     (pending changes)
├── __cursor        (sync cursor per store)
├── __client_info   (client ID, registration)
```

### Change Entry Schema

```typescript
interface ChangeEntry {
	/** Unique change ID — ULID for sortability + uniqueness */
	id: string;

	/** Which svelte-idb store was modified */
	storeName: string;

	/** Primary key of the affected record */
	key: string; // Serialized IDBValidKey (JSON.stringify)

	/** What operation was performed */
	operation: 'add' | 'put' | 'delete';

	/** The record value (null for 'delete') */
	value: unknown | null;

	/** Client-side timestamp (Date.now()) */
	timestamp: number;

	/** Unique identifier for this client */
	clientId: string;

	/** Push status */
	status: 'pending' | 'pushing' | 'synced' | 'failed';

	/** Number of push attempts (for retry logic) */
	attempts: number;

	/** Last error message (if failed) */
	lastError?: string;
}
```

### IDB Schema for Change Log

```typescript
// Internal store definition (managed by sync layer)
const changelogStore = {
	keyPath: 'id',
	indexes: [
		{ name: 'by-status', keyPath: 'status' },
		{ name: 'by-store', keyPath: 'storeName' },
		{ name: 'by-timestamp', keyPath: 'timestamp' }
	]
};
```

### Change Coalescing

Multiple changes to the same record between syncs can be **coalesced** to reduce payload:

```
add(key=1, {title:"A"}) + put(key=1, {title:"B"}) → add(key=1, {title:"B"})
put(key=1, {title:"A"}) + put(key=1, {title:"B"}) → put(key=1, {title:"B"})
add(key=1, {title:"A"}) + delete(key=1)            → (removed — never existed on server)
put(key=1, {title:"A"}) + delete(key=1)            → delete(key=1)
```

This reduces network traffic and server-side processing.

---

## 2. Client Identity

Each client (browser tab / device) gets a unique identifier:

```typescript
interface ClientInfo {
	/** Unique client ID — generated once, persisted */
	clientId: string; // crypto.randomUUID()

	/** When this client was first created */
	createdAt: number;

	/** Last successful sync timestamp */
	lastSyncAt: number | null;
}
```

The client ID is generated on first use and stored in the `__client_info` store. It persists across page reloads but is unique per device/browser profile.

---

## 3. Sync Cursor

The sync cursor tracks what the client has already received from the server.

```typescript
interface SyncCursorEntry {
	/** Store name (or '__global' for a single cursor) */
	storeName: string;

	/** Server-side sequence number — points to the last change the client received */
	position: number;

	/** When this cursor was last updated */
	updatedAt: number;
}
```

### Per-Store vs. Global Cursor

- **Global cursor:** Single cursor for all stores. Simpler but can't sync stores independently.
- **Per-store cursors:** Each store has its own cursor. Allows granular sync (e.g., sync "todos" but not "settings").

**Recommendation:** Per-store cursors for flexibility, with a convenience method for syncing all.

---

## 4. Data Flow — Complete Lifecycle

### 4.1 Initial Setup

```
User calls createSync(db, config)
         │
         ▼
   ┌─────────────────────────┐
   │ Create sync meta DB     │
   │ "myapp__sync_meta"      │
   │ ├── __changelog         │
   │ ├── __cursor            │
   │ └── __client_info       │
   └─────────────┬───────────┘
                 │
                 ▼
   ┌─────────────────────────┐
   │ Generate client ID      │
   │ (or load existing)      │
   └─────────────┬───────────┘
                 │
                 ▼
   ┌─────────────────────────┐
   │ Register store hooks    │
   │ on svelte-idb Store<T>  │
   │ (afterAdd, afterPut,    │
   │  afterDelete)           │
   └─────────────┬───────────┘
                 │
                 ▼
   ┌─────────────────────────┐
   │ Return SyncEngine       │
   │ instance                │
   └─────────────────────────┘
```

### 4.2 Local Write (User Mutation)

```
User: syncedDB.todos.add({ title: "Buy milk" })
         │
         ▼
   ┌─────────────────────────┐
   │ svelte-idb Store.add()  │  ← Normal IndexedDB write
   │ Writes to "myapp" DB    │
   └─────────────┬───────────┘
                 │
                 ▼
   ┌─────────────────────────┐
   │ afterAdd hook fires     │  ← Sync layer intercepts
   └─────────────┬───────────┘
                 │
                 ▼
   ┌─────────────────────────┐
   │ Create ChangeEntry      │
   │ {                       │
   │   id: ULID(),           │
   │   storeName: "todos",   │
   │   key: "1",             │
   │   operation: "add",     │
   │   value: {title:"..."},│
   │   clientId: "abc-123",  │
   │   status: "pending",    │
   │ }                       │
   └─────────────┬───────────┘
                 │
                 ▼
   ┌─────────────────────────┐
   │ Write to __changelog    │  ← Persisted in sync meta DB
   │ in "myapp__sync_meta"   │
   └─────────────┬───────────┘
                 │
                 ▼
   ┌─────────────────────────┐
   │ Schedule push           │  ← If online, push soon
   │ (debounced / immediate  │     (batched via microtask)
   │  based on config)       │
   └─────────────────────────┘
```

### 4.3 Push (Client → Server)

```
Push triggered (timer / immediate / manual)
         │
         ▼
   ┌─────────────────────────┐
   │ Read pending changes    │  ← Query __changelog where status = 'pending'
   │ from __changelog        │
   └─────────────┬───────────┘
                 │
                 ▼
   ┌─────────────────────────┐
   │ Coalesce changes        │  ← Merge multiple changes to same key
   │ (optional optimization) │
   └─────────────┬───────────┘
                 │
                 ▼
   ┌─────────────────────────┐
   │ Mark status = 'pushing' │  ← Prevent duplicate sends
   └─────────────┬───────────┘
                 │
                 ▼
   ┌─────────────────────────┐
   │ Transport.send({        │  ← HTTP POST / WebSocket message
   │   type: 'push',         │
   │   changes: [...]        │
   │ })                      │
   └─────────────┬───────────┘
                 │
         ┌───────┴───────┐
         ▼               ▼
   ┌──────────┐    ┌──────────┐
   │ Success  │    │ Failure  │
   └────┬─────┘    └────┬─────┘
        │               │
        ▼               ▼
   Mark status      Mark status = 'pending'
   = 'synced'       Increment attempts
   Remove from      Schedule retry with
   changelog        exponential backoff
```

### 4.4 Pull (Server → Client)

```
Pull triggered (timer / WebSocket push / manual)
         │
         ▼
   ┌─────────────────────────┐
   │ Read sync cursor        │  ← Last known server position
   │ from __cursor store     │
   └─────────────┬───────────┘
                 │
                 ▼
   ┌─────────────────────────┐
   │ Transport.send({        │  ← Request changes since cursor
   │   type: 'pull',         │
   │   cursor: { pos: 42 }   │
   │ })                      │
   └─────────────┬───────────┘
                 │
                 ▼
   ┌─────────────────────────┐
   │ Receive server changes  │
   │ [change1, change2, ...] │
   └─────────────┬───────────┘
                 │
                 ▼
   For each change:
         │
         ▼
   ┌─────────────────────────┐
   │ Is change from THIS     │──── Yes ──▶ Skip (we already have it)
   │ client? (clientId match)│
   └─────────────┬───────────┘
                 │ No
                 ▼
   ┌─────────────────────────┐
   │ Does local have         │──── No ──▶ Apply directly
   │ unsynced changes for    │           (write to svelte-idb Store)
   │ this key?               │
   └─────────────┬───────────┘
                 │ Yes (CONFLICT)
                 ▼
   ┌─────────────────────────┐
   │ Run conflict resolver   │  ← lww() / serverWins() / custom
   │ resolve(local, remote)  │
   └─────────────┬───────────┘
                 │
                 ▼
   ┌─────────────────────────┐
   │ Write resolved value    │  ← Direct IDB write (bypassing hooks
   │ to svelte-idb Store     │     to avoid re-logging for sync)
   └─────────────┬───────────┘
                 │
                 ▼
   ┌─────────────────────────┐
   │ Manual ChangeNotifier   │  ← Triggers LiveQuery $state updates
   │ .manualNotify(store)    │
   └─────────────┬───────────┘
                 │
                 ▼
   ┌─────────────────────────┐
   │ Update sync cursor      │  ← Store new position from server
   │ in __cursor store       │
   └─────────────────────────┘
```

### 4.5 Bidirectional Sync (Optimized)

Combines push + pull in a single network round trip:

```
   ┌─────────────────────────┐
   │ Transport.send({        │
   │   type: 'sync',         │
   │   push: [...changes],   │  ← Local unsynced changes
   │   pullCursor: {pos: 42} │  ← Request changes since cursor
   │ })                      │
   └─────────────┬───────────┘
                 │
                 ▼
   Server processes both:
   1. Applies push changes
   2. Collects pull changes (excluding what client just pushed)
                 │
                 ▼
   ┌─────────────────────────┐
   │ Response: {             │
   │   pushResult: {...},    │
   │   pullResult: {...}     │
   │ }                       │
   └─────────────┬───────────┘
                 │
                 ▼
   Process push results (mark synced/failed)
   Process pull results (apply changes with conflict resolution)
   Update cursor
```

---

## 5. Offline Support

### Online/Offline Detection

```typescript
class ConnectivityMonitor {
	isOnline = $state(navigator.onLine);

	constructor() {
		window.addEventListener('online', () => {
			this.isOnline = true;
			this.onReconnect();
		});
		window.addEventListener('offline', () => {
			this.isOnline = false;
		});
	}

	private onReconnect() {
		// Trigger immediate sync when coming back online
		syncEngine.pushPending();
		syncEngine.pullLatest();
	}
}
```

### Offline Write Behavior

1. User writes to synced store while offline
2. Change is logged in `__changelog` with `status: 'pending'`
3. Push attempt fails (no network) → keeps `status: 'pending'`
4. When `online` event fires → push all pending changes
5. Pull latest server state → resolve any conflicts

### Retry Strategy (Outbox Pattern)

```typescript
interface RetryConfig {
	/** Maximum number of retry attempts before marking as 'failed' */
	maxRetries: number; // default: 10

	/** Initial delay between retries (milliseconds) */
	baseDelay: number; // default: 1000 (1 second)

	/** Maximum delay between retries */
	maxDelay: number; // default: 300_000 (5 minutes)

	/** Multiplier for exponential backoff */
	backoffMultiplier: number; // default: 2

	/** Add random jitter to prevent thundering herd */
	jitter: boolean; // default: true
}

// Retry delay calculation:
// delay = min(baseDelay * backoffMultiplier^attempt, maxDelay) + random_jitter
// Attempt 1: 1s + jitter
// Attempt 2: 2s + jitter
// Attempt 3: 4s + jitter
// Attempt 4: 8s + jitter
// ...
// Attempt 10: 300s (capped at maxDelay)
```

---

## 6. Sync Modes

### Manual Sync

User explicitly triggers sync:

```typescript
const sync = createSync(db, {
	mode: 'manual'
	// ...
});

// User triggers sync
await sync.push(); // Push pending changes
await sync.pull(); // Pull latest from server
await sync.sync(); // Bidirectional (push + pull)
```

### Automatic Sync (Periodic Polling)

Sync runs on a timer:

```typescript
const sync = createSync(db, {
	mode: 'auto',
	interval: 30_000, // Poll every 30 seconds
	pushImmediate: true // Push immediately on write (don't wait for timer)
	// ...
});
```

### Real-Time Sync (WebSocket / SSE)

Server pushes changes as they happen:

```typescript
const sync = createSync(db, {
	mode: 'realtime',
	transport: websocketTransport({ url: 'wss://...' })
	// Pull is driven by server push
	// Push is still immediate on write
});
```

---

## 7. Cross-Tab Coordination

When multiple browser tabs are open, they should coordinate sync:

### Problem

- Tab A and Tab B are both syncing
- Tab A pushes change → server accepts
- Tab B pushes same change → duplicate!
- Both tabs pull independently → wasted bandwidth

### Solution: Leader Election via BroadcastChannel

Only ONE tab performs network sync. Other tabs communicate changes via `BroadcastChannel`.

```typescript
class TabCoordinator {
	private channel = new BroadcastChannel('svelte-idb-sync');
	private isLeader = false;

	constructor() {
		// Simple leader election: first tab to broadcast "claim" wins
		// On leader tab close, a new election happens
		this.electLeader();
	}

	electLeader() {
		// Use BroadcastChannel to coordinate
		// The leader tab handles all network communication
		// Other tabs send their local changes to the leader via BroadcastChannel
		// Leader pushes changes and broadcasts pull results to all tabs
	}
}
```

**Note:** This integrates with svelte-idb's existing `BroadcastChannel` plans for cross-tab reactivity (as mentioned in the core library's roadmap).

---

## 8. Initial Sync (First Connection)

When a client connects for the first time (no sync cursor exists):

### Option A: Full Download

Pull all records from all synced stores:

```typescript
// Server returns everything
getChangesSince({ position: 0 }); // position 0 = "from the beginning"
```

Pros: Simple. Cons: Slow for large datasets.

### Option B: Snapshot + Incremental

Server provides a compressed snapshot of current state, then incremental changes going forward:

```typescript
interface InitialSyncResponse {
	snapshot: Record<string, unknown[]>; // { todos: [...], users: [...] }
	cursor: SyncCursor; // Cursor pointing to "now"
}
```

Pros: Efficient for large datasets. Cons: Server needs snapshot capability.

### Option C: Selective Initial Sync

Client specifies which stores and filters to sync:

```typescript
const sync = createSync(db, {
	stores: {
		todos: {
			// Only sync todos for current user
			filter: { userId: currentUserId }
		},
		settings: true // Sync all settings
		// 'logs' not listed → won't be synced
	}
});
```

**Recommendation:** Start with Option A (full download), add Option C (selective) in a later phase.

---

## 9. Sync Metadata Cleanup

Over time, the `__changelog` store accumulates synced entries. Cleanup strategies:

### Automatic Cleanup

Remove synced changelog entries older than a threshold:

```typescript
const sync = createSync(db, {
	cleanup: {
		enabled: true,
		maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
		maxEntries: 10_000, // Keep at most 10k entries
		runInterval: 60 * 60 * 1000 // Check every hour
	}
});
```

### Manual Cleanup

```typescript
await sync.cleanup(); // Remove all synced entries
await sync.cleanup({ maxAge: 86400000 }); // Remove synced entries older than 1 day
```

---

**[← 04 Adapter Architecture](./04-adapter-architecture.md)** | **[Next → 06 API Design](./06-api-design.md)**
