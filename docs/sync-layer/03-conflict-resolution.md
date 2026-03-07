# 03 — Conflict Resolution

> Analysis of conflict resolution strategies for svelte-idb-sync, with recommendation for a pluggable hybrid approach.

---

## Decision Summary

| Strategy                  | Default?         | Use Case                                           |
| ------------------------- | ---------------- | -------------------------------------------------- |
| **Last-Write-Wins (LWW)** | ✅ Default       | Single-user, multi-device, simple CRUD             |
| **Server-Wins**           | Built-in option  | Apps with server-side business rules               |
| **Client-Wins**           | Built-in option  | Offline-first apps where local edits take priority |
| **Custom Resolver**       | Plugin interface | CRDT, domain-specific merge, manual conflict UI    |

**Recommendation:** Pluggable conflict resolution with **LWW as the default**. Ship three built-in strategies (LWW, server-wins, client-wins). Allow custom resolvers per store.

---

## What Is a Conflict?

A **sync conflict** occurs when:

1. Client A writes record `{ id: 1, title: "Buy milk" }` while offline
2. Client B writes record `{ id: 1, title: "Buy eggs" }` and syncs with the server
3. Client A comes back online and pushes its change → **Conflict:** same record, different values, both written since last sync

The conflict resolution strategy decides: what should `{ id: 1 }` look like after both clients reconcile?

---

## Strategy 1: Last-Write-Wins (LWW)

### How It Works

Every record gets a `_updatedAt` timestamp. When two versions conflict, the one with the most recent timestamp wins.

```typescript
// Conflict: server has { id: 1, title: "Buy eggs", _updatedAt: 1000 }
//           client has { id: 1, title: "Buy milk", _updatedAt: 1050 }
// Result: client wins because 1050 > 1000
```

### Implementation

```typescript
interface LWWRecord {
	_updatedAt: number; // High-resolution timestamp (Date.now() or performance.now())
	_clientId: string; // Tiebreaker when timestamps are equal
}

function lwwResolve<T>(local: T & LWWRecord, remote: T & LWWRecord): T {
	if (local._updatedAt > remote._updatedAt) return local;
	if (remote._updatedAt > local._updatedAt) return remote;
	// Tiebreaker: lexicographic comparison of clientId
	return local._clientId > remote._clientId ? local : remote;
}
```

### Metadata Requirements

Each synced record must include:

- `_updatedAt: number` — timestamp of last modification
- `_clientId: string` — unique client identifier (for tiebreaking)

These fields are managed automatically by the sync layer (injected on write, stripped on read if desired).

### Pros

| Advantage        | Detail                                                 |
| ---------------- | ------------------------------------------------------ |
| Simple           | ~20 lines of code to implement                         |
| Predictable      | Developer and user can reason about behavior           |
| Low overhead     | Only 2 extra fields per record                         |
| No external deps | No CRDT library needed                                 |
| Works offline    | No network needed to resolve — just compare timestamps |

### Cons

| Disadvantage          | Detail                                                                                                   |
| --------------------- | -------------------------------------------------------------------------------------------------------- |
| Silent data loss      | One concurrent edit is silently discarded                                                                |
| Clock skew            | Different devices may have different system clocks                                                       |
| Field-level blindness | If user A edits `title` and user B edits `description`, LWW picks ONE — losing the other change entirely |

### Mitigations

- **Clock skew:** Use server timestamp on push response to calibrate client clocks, or use hybrid logical clocks (HLC)
- **Data loss:** Warn users in docs that LWW is not suitable for collaborative editing
- **Field-level:** Offer a `field-level LWW` variant as an advanced option (merge non-conflicting fields)

### Best For

- Personal apps (todo lists, notes, settings)
- Multi-device sync for a single user
- Apps where the most recent edit is usually the correct one

---

## Strategy 2: Server-Authoritative (Server-Wins)

### How It Works

The server is always the source of truth. Client sends mutations; server decides final state. If client state diverges, server state overwrites.

```typescript
// Client mutation: { id: 1, title: "Buy milk" }
// Server already has: { id: 1, title: "Buy eggs" }
// Server applies business rules → decides { id: 1, title: "Buy eggs" }
// Client receives server state and overwrites local
```

### Implementation

```typescript
function serverWinsResolve<T>(local: T, remote: T): T {
	return remote; // Server always wins
}
```

### Pros

- **Simplest to reason about:** Server is truth, period
- **Business rules on server:** Authorization, validation, computed fields all handled server-side
- **No client-side merge logic:** Client just applies what server says

### Cons

- **Optimistic UI may flash:** User sees their edit, then it gets reverted by server
- **Offline limitations:** Client edits may feel "thrown away" when coming back online
- **Poor for offline-first:** If server is unreachable for extended periods, user loses confidence in local state

### Best For

- Apps with complex business rules (e-commerce, financial)
- Multi-tenant apps where server enforces authorization
- Systems where data integrity > user experience

---

## Strategy 3: Client-Wins

### How It Works

Local client state always takes priority. If there's a conflict, the client's version overwrites the server.

```typescript
function clientWinsResolve<T>(local: T, remote: T): T {
	return local; // Client always wins
}
```

### Pros

- **Great offline experience:** User's edits are never lost
- **Simple:** Mirror of server-wins

### Cons

- **Server data loss:** Other clients' edits get overwritten
- **No collaboration:** Useless for multi-user apps

### Best For

- Single-user apps with multiple devices
- Offline-first apps where local edits are precious
- Draft/notes apps where the user's latest edit is always preferred

---

## Strategy 4: CRDTs (Conflict-Free Replicated Data Types)

### How It Works

Data structures designed so that concurrent operations **always converge** to the same state, regardless of order. No conflicts by design.

**Common CRDT types:**

- **G-Counter / PN-Counter:** Incrementing counters
- **G-Set / OR-Set:** Sets with add/remove operations
- **LWW-Register:** Single value with LWW semantics (a CRDT version of LWW)
- **LWW-Map:** Key-value map with per-key LWW
- **RGA (Replicated Growable Array):** For ordered lists / text editing

**Libraries:** [Loro](https://loro.dev/) (~100KB WASM), [Automerge](https://automerge.org/) (~250KB), [Yjs](https://yjs.dev/) (~50KB)

### Implementation (using Loro as example)

```typescript
import { LoroDoc } from 'loro-crdt';

// Each record becomes a Loro document
const doc = new LoroDoc();
const map = doc.getMap('record');
map.set('title', 'Buy milk');

// Another client
const doc2 = LoroDoc.fromSnapshot(doc.exportSnapshot());
const map2 = doc2.getMap('record');
map2.set('title', 'Buy eggs');

// Merge — both operations are preserved in the CRDT
doc.import(doc2.exportUpdates());
// Result depends on CRDT semantics (LWW-Register → one wins, but no data corruption)
```

### Pros

| Advantage               | Detail                                        |
| ----------------------- | --------------------------------------------- |
| Zero data loss          | Concurrent operations merge deterministically |
| Real-time collaboration | Multiple users editing simultaneously         |
| Mathematically sound    | Proven convergence guarantees                 |
| Offline-friendly        | Merge works without network                   |

### Cons

| Disadvantage           | Detail                                                       |
| ---------------------- | ------------------------------------------------------------ |
| Heavy dependencies     | Loro ~100KB+ WASM, Automerge ~250KB                          |
| Data model change      | Users must model data as CRDT types, not plain objects       |
| Metadata overhead      | Version vectors, tombstones, operation logs per record       |
| Complexity             | Understanding CRDTs requires learning new concepts           |
| Not all data maps well | Relational data / transactions don't fit CRDT models cleanly |
| Storage overhead       | CRDT metadata can 2-10x the storage size of plain data       |

### Best For

- Collaborative editing (Google Docs-like)
- Real-time multiplayer features
- Apps where data loss is unacceptable

---

## Strategy 5: Field-Level Merge

### How It Works

Instead of replacing entire records, compare each field and merge non-conflicting changes.

```typescript
// Client A: { id: 1, title: "Buy milk", priority: "high" }  (changed title)
// Client B: { id: 1, title: "Buy eggs", priority: "low" }   (changed both)
// Server:   { id: 1, title: "Buy stuff", priority: "medium" } (original)

// Field-level merge (with LWW per field):
// title: Client B wins (later timestamp)
// priority: Client B wins (later timestamp)
// Result: { id: 1, title: "Buy eggs", priority: "low" }
```

### Pros

- **Less data loss than record-level LWW:** Non-conflicting field changes are preserved
- **Intuitive:** If I change `title` and you change `description`, both edits survive

### Cons

- **Requires field-level timestamps:** `{ _fieldTimestamps: { title: 1050, priority: 1050 } }`
- **More complex merge logic:** Must diff per-field
- **Still lossy for same-field conflicts:** If both edit `title`, one still loses

### Best For

- Forms with many independent fields
- Settings/preferences (each setting is independent)
- CMS content editing

---

## Recommended Approach: Pluggable Hybrid

### Design

The sync engine accepts a **conflict resolution configuration** that can be set globally or per store:

```typescript
import { createSync, lww, serverWins, clientWins } from 'svelte-idb-sync';

const sync = createSync(db, {
	serverAdapter: drizzleAdapter({
		/* ... */
	}),
	transport: httpTransport({ endpoint: '/api/sync' }),

	// Global default
	conflictResolution: lww(),

	// Per-store overrides
	stores: {
		todos: { conflictResolution: lww() },
		settings: { conflictResolution: clientWins() },
		orders: { conflictResolution: serverWins() },
		documents: { conflictResolution: customCRDTResolver() }
	}
});
```

### Conflict Resolver Interface

```typescript
interface ConflictResolver<T = unknown> {
	/**
	 * Resolve a conflict between local and remote versions of a record.
	 *
	 * @param local  - The local (client) version of the record
	 * @param remote - The remote (server) version of the record
	 * @param meta   - Metadata about the conflict (timestamps, client IDs, etc.)
	 * @returns The resolved version of the record
	 */
	resolve(local: T, remote: T, meta: ConflictMeta): T | Promise<T>;

	/**
	 * Name of the strategy (for debug logging).
	 */
	readonly name: string;
}

interface ConflictMeta {
	storeName: string;
	key: IDBValidKey;
	localTimestamp: number;
	remoteTimestamp: number;
	localClientId: string;
	remoteClientId: string;
}
```

### Built-in Resolvers

```typescript
// Last-Write-Wins (default)
export function lww(): ConflictResolver {
	return {
		name: 'lww',
		resolve(local, remote, meta) {
			if (meta.localTimestamp >= meta.remoteTimestamp) return local;
			return remote;
		}
	};
}

// Server always wins
export function serverWins(): ConflictResolver {
	return {
		name: 'server-wins',
		resolve(_local, remote) {
			return remote;
		}
	};
}

// Client always wins
export function clientWins(): ConflictResolver {
	return {
		name: 'client-wins',
		resolve(local) {
			return local;
		}
	};
}

// Field-level LWW (advanced built-in)
export function fieldLevelLWW(): ConflictResolver {
	return {
		name: 'field-level-lww',
		resolve(local, remote, meta) {
			// Merge non-conflicting fields, LWW for conflicting fields
			// Requires _fieldTimestamps metadata
			// Implementation details in sync-protocol.md
		}
	};
}
```

### Custom Resolver Example (CRDT via Loro)

```typescript
import { LoroDoc } from 'loro-crdt';

function loroCRDTResolver(): ConflictResolver {
	return {
		name: 'loro-crdt',
		resolve(local, remote, meta) {
			const doc = new LoroDoc();
			// Merge CRDT states...
			return mergedRecord;
		}
	};
}
```

### Custom Resolver Example (Manual / UI-Based)

```typescript
function manualResolver(
	showConflictUI: (local: any, remote: any) => Promise<any>
): ConflictResolver {
	return {
		name: 'manual',
		async resolve(local, remote, meta) {
			// Show UI for user to pick which version to keep
			return await showConflictUI(local, remote);
		}
	};
}
```

---

## Metadata Strategy

### Required Metadata Fields (Added by Sync Layer)

The sync layer automatically injects and manages these fields on synced records:

```typescript
interface SyncMetadata {
	_syncVersion: number; // Incrementing version counter per record
	_updatedAt: number; // Timestamp of last modification
	_clientId: string; // ID of the client that made the last change
	_syncedAt?: number; // When this version was last synced to server (null = unsynced)
}
```

### How Metadata Is Managed

1. **On local write (`add`/`put`):**
   - `_syncVersion` incremented
   - `_updatedAt` set to `Date.now()`
   - `_clientId` set to this client's unique ID
   - `_syncedAt` set to `null` (not yet synced)

2. **On successful push:**
   - `_syncedAt` updated to server response timestamp

3. **On incoming remote change:**
   - Metadata reflects the remote version's values
   - Conflict resolver compares `_updatedAt` / `_syncVersion` / `_clientId`

### User Data Transparency

Users should NOT need to add these fields to their schema. The sync layer manages them transparently:

```typescript
// User defines schema normally — no sync fields needed
const db = createDB({
	schema: {
		todos: {
			keyPath: 'id',
			autoIncrement: true
		}
	}
});

// Sync layer adds _sync* fields behind the scenes
// When user reads data via svelte-idb, sync fields are optionally stripped
```

Configuration option to control visibility:

```typescript
const sync = createSync(db, {
	// ...
	metadata: {
		expose: false // Strip _sync* fields from reads (default)
		// expose: true  → Include _sync* fields in reads (for debugging)
	}
});
```

---

## Comparison Summary

| Strategy        | Data Loss                 | Complexity | Dependencies   | Metadata Overhead    | Multi-User    |
| --------------- | ------------------------- | ---------- | -------------- | -------------------- | ------------- |
| LWW             | Some (record-level)       | Low        | None           | 2 fields             | Poor          |
| Server-Wins     | Client edits may revert   | Low        | None           | 1 field              | Good          |
| Client-Wins     | Server edits may revert   | Low        | None           | None                 | Poor          |
| Field-Level LWW | Minimal (same-field only) | Medium     | None           | Per-field timestamps | Moderate      |
| CRDT            | None                      | High       | Loro/Automerge | Significant          | Excellent     |
| Manual          | None                      | Medium     | None           | None                 | Depends on UI |

**MVP ships with:** LWW (default), server-wins, client-wins.  
**Phase 2 adds:** Field-level LWW, custom resolver interface.  
**Optional integration:** CRDT via Loro (documented example, not bundled).

---

**[← 02 Architecture Options](./02-architecture-options.md)** | **[Next → 04 Adapter Architecture](./04-adapter-architecture.md)**
