# 03 — Conflict Resolution

> When the client and server disagree, who wins? Strategy analysis and our approach.

**← [02 Packaging Decision](./02-packaging-decision.md)** | **[Next → 04 ORM & Backend Adapters](./04-orm-backend-adapters.md)**

---

## The Conflict Problem

In any sync system, conflicts occur when:

1. Client A modifies record X offline
2. Server (or Client B) also modifies record X
3. Client A comes online and pushes its change
4. **The system must decide which version to keep**

This is the hardest problem in distributed systems. There is no universally correct answer — only trade-offs.

---

## Strategy Overview

### Strategy 1: Last-Write-Wins (LWW)

**How it works:** Every record gets a timestamp (`updatedAt`). When a conflict is detected, the record with the most recent timestamp wins.

```
Client:  { id: 1, name: "Alice Updated", updatedAt: "2024-03-15T10:00:05Z" }
Server:  { id: 1, name: "Alice Renamed", updatedAt: "2024-03-15T10:00:03Z" }
                                                              ↑ older
Result:  Client wins (more recent timestamp)
```

| Aspect               | Assessment                                              |
| -------------------- | ------------------------------------------------------- |
| **Simplicity**       | ✅ Trivial to implement                                  |
| **Data loss risk**   | 🔴 High — older writes silently disappear                |
| **Clock dependency** | 🔴 Requires synchronized clocks (unreliable in browsers) |
| **Use case**         | Settings, preferences, non-critical data                |
| **Used by**          | Cassandra, DynamoDB, many simple sync systems           |

**Our Implementation:**
```typescript
const sync = createSync(db, {
  conflict: 'last-write-wins',
  // Uses a hybrid logical clock (HLC) instead of wall-clock
  // to avoid drift issues
});
```

---

### Strategy 2: Server-Wins (Server Authority)

**How it works:** The server's version is always authoritative. Client changes are treated as "proposals" — they're applied optimistically but can be overwritten by the server.

```
Client:  { id: 1, name: "Alice Updated" }     ← optimistic
Server:  { id: 1, name: "Alice Renamed" }      ← authoritative
                                                        ↓
Result:  Server wins. Client reverts to "Alice Renamed"
```

| Aspect             | Assessment                                                         |
| ------------------ | ------------------------------------------------------------------ |
| **Simplicity**     | ✅ Simple — server is always right                                  |
| **Data loss risk** | 🟡 Medium — client edits may be discarded, but user sees the revert |
| **Consistency**    | ✅ Strong — all clients converge to the same state                  |
| **Use case**       | Business logic-driven data (invoices, orders, financial records)   |
| **Used by**        | Zero, PowerSync                                                    |

**Our Implementation (Default Strategy):**
```typescript
const sync = createSync(db, {
  conflict: 'server-wins',  // ← default
  onRevert: (record, serverVersion) => {
    // Optional: notify user their change was overridden
    toast.warning(`Your edit to "${record.name}" was overridden by the server.`);
  }
});
```

---

### Strategy 3: Client-Wins

**How it works:** The client's version always wins. The server accepts whatever the client sends.

```
Client:  { id: 1, name: "Alice Updated" }     ← always wins
Server:  { id: 1, name: "Alice Renamed" }     ← overwritten
                                                        ↓
Result:  Client wins. Server updates to "Alice Updated"
```

| Aspect             | Assessment                               |
| ------------------ | ---------------------------------------- |
| **Simplicity**     | ✅ Simple                                 |
| **Data loss risk** | 🔴 High — server data can be overwritten  |
| **Use case**       | User-owned data (personal notes, drafts) |
| **Security risk**  | 🔴 High — clients can overwrite anything  |

**Our Implementation:**
```typescript
const sync = createSync(db, {
  conflict: 'client-wins',
  // WARNING: Only use for user-owned data with proper authorization
});
```

---

### Strategy 4: Field-Level Merge

**How it works:** Instead of choosing the entire record, merge at the field level. Each field independently follows LWW.

```
Client:  { id: 1, name: "Alice Updated", age: 31 }
Server:  { id: 1, name: "Alice Renamed", age: 30 }

Merged:  { id: 1, name: "Alice Updated",  age: 31 }
                         ↑ client newer    ↑ client newer
```

| Aspect               | Assessment                                              |
| -------------------- | ------------------------------------------------------- |
| **Simplicity**       | 🟡 Medium — requires per-field timestamps                |
| **Data loss risk**   | 🟢 Low — preserves most changes                          |
| **Storage overhead** | 🟡 Medium — need timestamps per field                    |
| **Use case**         | Collaborative editing (user profiles, shared documents) |
| **Used by**          | CouchDB (sort of), custom implementations               |

**Our Implementation:**
```typescript
const sync = createSync(db, {
  conflict: 'field-merge',
  // Tracks updatedAt per field internally
  // Requires a __meta column in the server-side schema
});
```

---

### Strategy 5: CRDT (Conflict-free Replicated Data Types)

**How it works:** Data structures that are mathematically guaranteed to converge without coordination. Operations are commutative and idempotent.

```
           Client A: counter.increment(1)  →  value: 11
Counter                                       
start: 10                                     Merge: 12
           Client B: counter.increment(1)  →  value: 11
```

| Aspect               | Assessment                                       |
| -------------------- | ------------------------------------------------ |
| **Simplicity**       | 🔴 Complex — requires specialized data structures |
| **Data loss risk**   | ✅ None — all operations preserved                |
| **Storage overhead** | 🔴 High — CRDT state can grow large               |
| **Use case**         | Real-time collaboration, counters, shared sets   |
| **Used by**          | Yjs, Automerge, old ElectricSQL                  |

**Our Implementation (Future / Plugin):**
```typescript
import { crdtConflict } from 'svelte-idb-sync/crdt';

const sync = createSync(db, {
  conflict: crdtConflict({
    // Per-store CRDT type configuration
    counters: 'g-counter',        // Grow-only counter
    sharedDocs: 'lww-register',   // LWW register per field
    tags: 'or-set',               // Observed-Remove Set
  })
});
```

---

### Strategy 6: Custom / Manual Resolution

**How it works:** The developer provides a function that receives both versions and returns the resolved version.

```typescript
const sync = createSync(db, {
  conflict: async (local, server, meta) => {
    // Full control — show a UI, merge manually, etc.
    if (meta.storeName === 'invoices') {
      // Business rule: never overwrite finalized invoices
      if (server.status === 'finalized') return server;
      return local;
    }
    // Default to server for everything else
    return server;
  }
});
```

| Aspect          | Assessment                     |
| --------------- | ------------------------------ |
| **Simplicity**  | 🟡 Depends on implementation    |
| **Flexibility** | ✅ Maximum — any business logic |
| **Use case**    | Domain-specific conflict rules |

---

## Our Approach: Layered Conflict Resolution

We implement a **layered system** that starts simple and allows progressive sophistication:

```
┌─────────────────────────────────────────────────────┐
│                   Layer 3: CRDT                      │
│           (Future plugin — Yjs/Automerge)            │
├─────────────────────────────────────────────────────┤
│                   Layer 2: Custom                    │
│        (Per-store conflict resolution function)      │
├─────────────────────────────────────────────────────┤
│                Layer 1: Built-in Strategies          │
│   'server-wins' (default) | 'client-wins' | 'lww'   │
│                    | 'field-merge'                    │
└─────────────────────────────────────────────────────┘
```

### Default: `server-wins`

**Why server-wins is the right default:**

1. **Safety** — Server has validated data, applied business rules, checked permissions
2. **Predictability** — All clients converge to the same state
3. **Simplicity** — No clock sync issues, no special data structures
4. **Aligns with Zero's model** — Server-authoritative is the modern standard
5. **User expectation** — "If I refresh, I see the truth"

### Per-Store Override

Different stores can use different strategies:

```typescript
const sync = createSync(db, {
  conflict: {
    default: 'server-wins',            // Global default
    stores: {
      drafts: 'client-wins',           // User-owned drafts
      settings: 'lww',                 // Last edit wins for preferences
      invoices: async (local, server) => {
        // Custom: merge line items, keep server totals
        return {
          ...server,
          lineItems: mergeLineItems(local.lineItems, server.lineItems),
        };
      },
    }
  }
});
```

---

## Change Tracking: How We Detect Conflicts

### Client-Side: Operation Log (Oplog)

Every mutation in `svelte-idb` generates a `ChangeEvent` via the `ChangeNotifier`. We extend this into a persistent oplog:

```typescript
interface SyncOperation {
  id: string;                    // UUID
  storeName: string;             // 'users', 'invoices', etc.
  type: 'add' | 'put' | 'delete';
  key: IDBValidKey;              // Record primary key
  value?: unknown;               // The record data (for add/put)
  timestamp: string;             // Hybrid Logical Clock value
  status: 'pending' | 'synced' | 'conflicted' | 'failed';
}
```

The oplog is stored in a special `__sync_oplog` IndexedDB store, managed by the sync engine.

### Server-Side: Version Vectors

Each synced record carries a `__version` field (monotonically incrementing). When the client pushes changes, it includes its last-known version. The server compares:

```
Client push:  { id: 1, name: "Updated", __version: 5 }
Server state: { id: 1, name: "Different", __version: 7 }
                                                  ↑ server is ahead
→ Conflict detected! Apply resolution strategy.
```

---

## Hybrid Logical Clock (HLC)

For LWW and field-merge strategies, we use a Hybrid Logical Clock instead of wall-clock timestamps:

```typescript
interface HLC {
  wallTime: number;  // Date.now()
  logical: number;   // Monotonic counter for same-millisecond ordering
  nodeId: string;    // Unique client ID (persisted in IDB)
}

// Comparison: first by wallTime, then logical, then nodeId (tiebreaker)
```

**Why HLC over wall-clock:**
- Tolerates clock drift between devices
- Preserves causal ordering even with NTP skew
- nodeId as tiebreaker ensures deterministic ordering

---

## Summary: Strategy Selection Guide

| Scenario                         | Recommended Strategy    | Why                             |
| -------------------------------- | ----------------------- | ------------------------------- |
| Business data (invoices, orders) | `server-wins`           | Server validates business rules |
| User preferences / settings      | `lww`                   | Latest user action should stick |
| Personal offline notes / drafts  | `client-wins`           | User's edits are sacred         |
| Collaborative editing            | `field-merge` or `crdt` | Preserve all contributions      |
| Complex domain logic             | `custom`                | Full control over resolution    |

---

**← [02 Packaging Decision](./02-packaging-decision.md)** | **[Next → 04 ORM & Backend Adapters](./04-orm-backend-adapters.md)**
