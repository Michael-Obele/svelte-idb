# 04 — Adapter Architecture

> Design of server adapters (Drizzle, Prisma, raw SQL) and the transport layer for svelte-idb-sync.

---

## Overview

svelte-idb-sync uses a **dual-adapter architecture:**

1. **Client side:** Hooks into svelte-idb's `Store<T>` to detect local changes and apply remote changes.
2. **Server side:** Pluggable adapters translate sync operations into database-specific queries (Drizzle, Prisma, raw SQL).
3. **Transport:** Pluggable layer connecting client ↔ server (HTTP, WebSocket, SSE, SvelteKit server functions).

```
┌─────────────────────────────────────────────────────────────────┐
│  CLIENT (Browser)                                               │
│                                                                 │
│  ┌──────────┐    ┌──────────────┐    ┌───────────────────────┐ │
│  │ svelte-  │───▶│ Sync Engine  │───▶│ Transport (Client)    │ │
│  │ idb      │◀───│ (change log, │◀───│ (HTTP fetch / WS /    │ │
│  │ Store<T> │    │  resolver)   │    │  SvelteKit functions)  │ │
│  └──────────┘    └──────────────┘    └───────────┬───────────┘ │
│                                                   │             │
└───────────────────────────────────────────────────┼─────────────┘
                                                    │ Network
┌───────────────────────────────────────────────────┼─────────────┐
│  SERVER                                           │             │
│                                                   ▼             │
│  ┌───────────────────────┐    ┌──────────────────────────────┐ │
│  │ Transport (Server)    │───▶│ Server Adapter               │ │
│  │ (Express / SvelteKit  │◀───│ (Drizzle / Prisma / raw SQL) │ │
│  │  route / Hono)        │    │                              │ │
│  └───────────────────────┘    └──────────┬───────────────────┘ │
│                                          │                      │
│                                          ▼                      │
│                               ┌──────────────────┐             │
│                               │ Database          │             │
│                               │ (PostgreSQL /     │             │
│                               │  SQLite / MySQL)  │             │
│                               └──────────────────┘             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Part 1: Client-Side Integration with svelte-idb

### How the Sync Layer Hooks into svelte-idb

The sync engine needs to:

1. **Intercept local writes** to log them for push
2. **Apply remote changes** without re-triggering sync (avoiding infinite loops)
3. **Trigger UI updates** after applying remote changes (via ChangeNotifier)

### Approach: Middleware Wrapping

The sync layer wraps the `Database` object returned by `createDB()`, intercepting Store operations:

```typescript
// createSync returns a "synced" database with the same API
const db = createDB({
	name: 'myapp',
	schema: {
		/* ... */
	}
});
const syncedDB = createSync(db, {
	/* sync config */
});

// Same API — but operations are now tracked
await syncedDB.todos.add({ title: 'Buy milk' });
// ↑ This:
// 1. Calls db.todos.add() (native svelte-idb)
// 2. Logs change to __sync_changelog
// 3. Optionally triggers immediate push
```

### Required svelte-idb Core Changes

These are **non-breaking additions** to the svelte-idb core library:

#### 1. Store Lifecycle Hooks

```typescript
// src/lib/core/types.ts — addition
interface StoreHooks<T> {
	afterAdd?(key: IDBValidKey, value: T): void | Promise<void>;
	afterPut?(key: IDBValidKey, value: T): void | Promise<void>;
	afterDelete?(key: IDBValidKey): void | Promise<void>;
	afterClear?(): void | Promise<void>;
}
```

The sync layer registers hooks to log changes:

```typescript
// Inside svelte-idb-sync
db.todos.hooks.afterAdd = (key, value) => {
	syncEngine.logChange({
		storeName: 'todos',
		operation: 'add',
		key,
		value
	});
};
```

#### 2. Raw Database Access

```typescript
// src/lib/core/database.ts — addition
interface Database<TSchema> {
	// ... existing API ...

	/** Raw IDBDatabase reference (for advanced use and sync layer) */
	readonly rawDatabase: IDBDatabase;
}
```

The sync layer uses this for:

- Creating internal stores (`__sync_changelog`, `__sync_cursor`)
- Writing remote changes directly (bypassing hooks to avoid sync loops)

#### 3. Manual ChangeNotifier Trigger

```typescript
// src/lib/core/change-notifier.ts — addition
interface ChangeNotifier {
	// ... existing API ...

	/** Manually trigger a change notification (used by sync layer after silent writes) */
	manualNotify(storeName: string): void;
}
```

When the sync layer writes remote changes directly (bypassing hooks), it calls `manualNotify()` so `LiveQuery` updates the UI.

---

## Part 2: Server Adapter Interface

### Core Interface

Every server adapter implements this interface:

```typescript
interface ServerAdapter {
	/**
	 * Apply local changes to the server database.
	 * Called during "push" — client sends its unsynced changes.
	 *
	 * The adapter translates ChangeEntry[] into DB operations.
	 * Returns the server's accepted state for each change
	 * (which may differ from what the client sent if server-side
	 * business logic modified the data).
	 */
	applyChanges(changes: ChangeEntry[]): Promise<ApplyResult>;

	/**
	 * Fetch changes from the server since the given cursor.
	 * Called during "pull" — client asks for what changed on the server.
	 *
	 * The adapter queries the server's change tracking table/mechanism.
	 */
	getChangesSince(cursor: SyncCursor): Promise<PullResult>;

	/**
	 * Bidirectional sync in a single call.
	 * Combines push + pull for efficiency.
	 * Optional — falls back to applyChanges + getChangesSince if not implemented.
	 */
	sync?(params: SyncParams): Promise<SyncResult>;

	/**
	 * Initialize server-side sync infrastructure.
	 * Creates change tracking tables, triggers, etc.
	 * Called once on first sync or when schema changes.
	 */
	initialize?(storeNames: string[]): Promise<void>;
}
```

### Supporting Types

```typescript
interface ChangeEntry<T = unknown> {
	id: string; // Unique change ID (ULID or UUID)
	storeName: string; // svelte-idb store name
	key: IDBValidKey; // Record primary key
	operation: 'add' | 'put' | 'delete';
	value?: T; // Record value (undefined for delete)
	timestamp: number; // Client-side timestamp
	clientId: string; // Unique client identifier
}

interface SyncCursor {
	/** Server-side sequence number or timestamp */
	position: string | number;
	/** Per-store cursors for granular tracking */
	stores?: Record<string, string | number>;
}

interface ApplyResult {
	/** Successfully applied changes */
	applied: Array<{ changeId: string; serverTimestamp: number }>;
	/** Rejected changes (conflict, validation, authorization) */
	rejected: Array<{ changeId: string; reason: string; serverVersion?: unknown }>;
}

interface PullResult {
	/** Changes from server */
	changes: ChangeEntry[];
	/** Updated cursor (client stores this for next pull) */
	newCursor: SyncCursor;
	/** Whether there are more changes (pagination) */
	hasMore: boolean;
}

interface SyncParams {
	/** Local changes to push */
	push: ChangeEntry[];
	/** Cursor for pulling server changes */
	pullCursor: SyncCursor;
}

interface SyncResult {
	pushResult: ApplyResult;
	pullResult: PullResult;
}
```

---

## Part 3: Server Adapter — Drizzle ORM

### Overview

The Drizzle adapter translates sync operations into Drizzle ORM queries. It requires:

- A Drizzle database instance
- A mapping from svelte-idb store names to Drizzle table schemas
- A change tracking table (auto-created by the adapter)

### Setup

```typescript
import { drizzleAdapter } from 'svelte-idb-sync/adapters/drizzle';
import { db } from './drizzle-instance'; // Your existing Drizzle db
import { todos, users } from './schema'; // Your Drizzle table schemas

const adapter = drizzleAdapter({
	db,
	tables: {
		todos: todos, // svelte-idb store "todos" → Drizzle "todos" table
		users: users // svelte-idb store "users" → Drizzle "users" table
	},
	// Optional: customize the change tracking table name
	changeTrackingTable: '_sync_changes'
});
```

### Change Tracking Table (Auto-Created)

The adapter creates and manages a change tracking table in the user's database:

```sql
CREATE TABLE IF NOT EXISTS _sync_changes (
  id          TEXT PRIMARY KEY,           -- ULID/UUID
  store_name  TEXT NOT NULL,              -- svelte-idb store name
  record_key  TEXT NOT NULL,              -- Serialized primary key
  operation   TEXT NOT NULL,              -- 'add' | 'put' | 'delete'
  value       JSONB,                      -- Record value (null for delete)
  timestamp   BIGINT NOT NULL,            -- Server timestamp
  client_id   TEXT NOT NULL,              -- Source client ID
  sequence    BIGSERIAL                   -- Auto-incrementing for cursor
);

CREATE INDEX idx_sync_changes_sequence ON _sync_changes(sequence);
CREATE INDEX idx_sync_changes_store ON _sync_changes(store_name);
```

### Drizzle Schema for Change Tracking

```typescript
import { pgTable, text, bigint, jsonb, bigserial } from 'drizzle-orm/pg-core';

export const syncChanges = pgTable('_sync_changes', {
	id: text('id').primaryKey(),
	storeName: text('store_name').notNull(),
	recordKey: text('record_key').notNull(),
	operation: text('operation').notNull(),
	value: jsonb('value'),
	timestamp: bigint('timestamp', { mode: 'number' }).notNull(),
	clientId: text('client_id').notNull(),
	sequence: bigserial('sequence', { mode: 'number' })
});
```

### How applyChanges Works (Drizzle)

```typescript
async applyChanges(changes: ChangeEntry[]): Promise<ApplyResult> {
  const applied: ApplyResult['applied'] = [];
  const rejected: ApplyResult['rejected'] = [];

  await db.transaction(async (tx) => {
    for (const change of changes) {
      const table = this.tables[change.storeName];
      if (!table) {
        rejected.push({ changeId: change.id, reason: 'Unknown store' });
        continue;
      }

      try {
        const serverTimestamp = Date.now();

        switch (change.operation) {
          case 'add':
            await tx.insert(table).values(change.value);
            break;
          case 'put':
            await tx.insert(table)
              .values(change.value)
              .onConflictDoUpdate({
                target: table.id, // assumes 'id' primary key
                set: change.value,
              });
            break;
          case 'delete':
            await tx.delete(table)
              .where(eq(table.id, change.key));
            break;
        }

        // Log in change tracking table
        await tx.insert(syncChanges).values({
          id: change.id,
          storeName: change.storeName,
          recordKey: String(change.key),
          operation: change.operation,
          value: change.value,
          timestamp: serverTimestamp,
          clientId: change.clientId,
        });

        applied.push({ changeId: change.id, serverTimestamp });
      } catch (err) {
        rejected.push({ changeId: change.id, reason: String(err) });
      }
    }
  });

  return { applied, rejected };
}
```

### How getChangesSince Works (Drizzle)

```typescript
async getChangesSince(cursor: SyncCursor): Promise<PullResult> {
  const PAGE_SIZE = 100;

  const changes = await db
    .select()
    .from(syncChanges)
    .where(gt(syncChanges.sequence, cursor.position))
    .orderBy(asc(syncChanges.sequence))
    .limit(PAGE_SIZE + 1);

  const hasMore = changes.length > PAGE_SIZE;
  const pageChanges = hasMore ? changes.slice(0, PAGE_SIZE) : changes;

  return {
    changes: pageChanges.map(c => ({
      id: c.id,
      storeName: c.storeName,
      key: c.recordKey,
      operation: c.operation as ChangeEntry['operation'],
      value: c.value,
      timestamp: c.timestamp,
      clientId: c.clientId,
    })),
    newCursor: {
      position: pageChanges.at(-1)?.sequence ?? cursor.position,
    },
    hasMore,
  };
}
```

---

## Part 4: Server Adapter — Prisma

### Setup

```typescript
import { prismaAdapter } from 'svelte-idb-sync/adapters/prisma';
import { prisma } from './prisma-client'; // Your existing PrismaClient

const adapter = prismaAdapter({
	prisma,
	models: {
		todos: 'Todo', // svelte-idb store "todos" → Prisma model "Todo"
		users: 'User' // svelte-idb store "users" → Prisma model "User"
	}
});
```

### Change Tracking

The Prisma adapter uses a Prisma model for change tracking. Users must add this to their `schema.prisma`:

```prisma
model SyncChange {
  id        String @id
  storeName String @map("store_name")
  recordKey String @map("record_key")
  operation String
  value     Json?
  timestamp BigInt
  clientId  String @map("client_id")
  sequence  Int    @id @default(autoincrement())

  @@map("_sync_changes")
  @@index([sequence])
  @@index([storeName])
}
```

Alternatively, the adapter can auto-create this using `prisma.$executeRaw()`:

```typescript
async initialize() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "_sync_changes" (
      "id" TEXT PRIMARY KEY,
      "store_name" TEXT NOT NULL,
      ...
    )
  `;
}
```

### How applyChanges Works (Prisma)

```typescript
async applyChanges(changes: ChangeEntry[]): Promise<ApplyResult> {
  const applied = [];
  const rejected = [];

  // Prisma interactive transaction
  await prisma.$transaction(async (tx) => {
    for (const change of changes) {
      const modelName = this.models[change.storeName];
      const model = (tx as any)[modelName.toLowerCase()];

      try {
        const serverTimestamp = Date.now();

        switch (change.operation) {
          case 'add':
            await model.create({ data: change.value });
            break;
          case 'put':
            await model.upsert({
              where: { id: change.key },
              create: change.value,
              update: change.value,
            });
            break;
          case 'delete':
            await model.delete({ where: { id: change.key } });
            break;
        }

        // Log change
        await tx.syncChange.create({
          data: {
            id: change.id,
            storeName: change.storeName,
            recordKey: String(change.key),
            operation: change.operation,
            value: change.value,
            timestamp: BigInt(serverTimestamp),
            clientId: change.clientId,
          },
        });

        applied.push({ changeId: change.id, serverTimestamp });
      } catch (err) {
        rejected.push({ changeId: change.id, reason: String(err) });
      }
    }
  });

  return { applied, rejected };
}
```

---

## Part 5: Server Adapter — Raw PostgreSQL

### Setup

```typescript
import { pgAdapter } from 'svelte-idb-sync/adapters/pg';
import postgres from 'postgres'; // or pg

const sql = postgres('postgresql://...');

const adapter = pgAdapter({
	sql,
	tables: {
		todos: {
			tableName: 'todos',
			primaryKey: 'id',
			// Optional: column mappings if IDB field names differ from DB columns
			columns: {
				title: 'title',
				completed: 'is_completed' // IDB "completed" → DB "is_completed"
			}
		},
		users: {
			tableName: 'users',
			primaryKey: 'user_id'
		}
	}
});
```

### How applyChanges Works (Raw SQL)

```typescript
async applyChanges(changes: ChangeEntry[]): Promise<ApplyResult> {
  const applied = [];
  const rejected = [];

  await sql.begin(async (tx) => {
    for (const change of changes) {
      const tableConfig = this.tables[change.storeName];
      const { tableName, primaryKey, columns } = tableConfig;

      try {
        const serverTimestamp = Date.now();
        const mappedValue = this.mapColumns(change.value, columns);

        switch (change.operation) {
          case 'add':
            await tx`INSERT INTO ${sql(tableName)} ${sql(mappedValue)}`;
            break;
          case 'put':
            await tx`
              INSERT INTO ${sql(tableName)} ${sql(mappedValue)}
              ON CONFLICT (${sql(primaryKey)})
              DO UPDATE SET ${sql(mappedValue)}
            `;
            break;
          case 'delete':
            await tx`
              DELETE FROM ${sql(tableName)}
              WHERE ${sql(primaryKey)} = ${change.key}
            `;
            break;
        }

        // Log change in tracking table
        await tx`
          INSERT INTO _sync_changes (id, store_name, record_key, operation, value, timestamp, client_id)
          VALUES (${change.id}, ${change.storeName}, ${String(change.key)},
                  ${change.operation}, ${JSON.stringify(change.value)},
                  ${serverTimestamp}, ${change.clientId})
        `;

        applied.push({ changeId: change.id, serverTimestamp });
      } catch (err) {
        rejected.push({ changeId: change.id, reason: String(err) });
      }
    }
  });

  return { applied, rejected };
}
```

---

## Part 6: Server Adapter — Raw SQLite

### Setup

```typescript
import { sqliteAdapter } from 'svelte-idb-sync/adapters/sqlite';
import Database from 'better-sqlite3';
// Or: import { createClient } from '@libsql/client'; // Turso

const sqliteDb = new Database('./myapp.db');

const adapter = sqliteAdapter({
	db: sqliteDb,
	tables: {
		todos: { tableName: 'todos', primaryKey: 'id' },
		users: { tableName: 'users', primaryKey: 'user_id' }
	}
});
```

### Turso / LibSQL Support

```typescript
import { sqliteAdapter } from 'svelte-idb-sync/adapters/sqlite';
import { createClient } from '@libsql/client';

const turso = createClient({
	url: 'libsql://mydb-myorg.turso.io',
	authToken: '...'
});

const adapter = sqliteAdapter({
	db: turso,
	dialect: 'libsql', // Adjusts for LibSQL-specific syntax
	tables: {
		/* ... */
	}
});
```

---

## Part 7: Transport Layer

### Transport Interface

```typescript
interface Transport {
	/**
	 * Send changes to the server and receive response.
	 * Used for push, pull, and bidirectional sync.
	 */
	send(request: SyncRequest): Promise<SyncResponse>;

	/**
	 * Subscribe to server-initiated changes (real-time).
	 * Optional — not all transports support push.
	 */
	subscribe?(callback: (changes: ChangeEntry[]) => void): Unsubscribe;

	/**
	 * Check if transport is connected / available.
	 */
	isOnline(): boolean;

	/**
	 * Clean up resources.
	 */
	destroy(): void;
}

type SyncRequest =
	| { type: 'push'; changes: ChangeEntry[] }
	| { type: 'pull'; cursor: SyncCursor }
	| { type: 'sync'; push: ChangeEntry[]; pullCursor: SyncCursor };

type SyncResponse =
	| { type: 'push-result'; result: ApplyResult }
	| { type: 'pull-result'; result: PullResult }
	| { type: 'sync-result'; result: SyncResult };

type Unsubscribe = () => void;
```

### HTTP Transport (Default)

```typescript
import { httpTransport } from 'svelte-idb-sync/transports/http';

const transport = httpTransport({
	endpoint: '/api/sync',

	// Optional configuration
	headers: { Authorization: 'Bearer ...' },
	fetchOptions: { credentials: 'include' },
	timeout: 30_000,

	// Polling interval for pull (when not using WebSocket)
	pullInterval: 30_000, // 30 seconds

	// Retry configuration
	retry: {
		maxRetries: 5,
		baseDelay: 1000,
		maxDelay: 30_000,
		backoffMultiplier: 2
	}
});
```

**Server endpoint contract** (framework-agnostic):

```
POST /api/sync
Content-Type: application/json

// Push
{ "type": "push", "changes": [...] }
→ { "type": "push-result", "result": { "applied": [...], "rejected": [...] } }

// Pull
{ "type": "pull", "cursor": { "position": 42 } }
→ { "type": "pull-result", "result": { "changes": [...], "newCursor": {...}, "hasMore": false } }

// Bidirectional sync
{ "type": "sync", "push": [...], "pullCursor": { "position": 42 } }
→ { "type": "sync-result", "result": { "pushResult": {...}, "pullResult": {...} } }
```

### WebSocket Transport (Real-Time)

```typescript
import { websocketTransport } from 'svelte-idb-sync/transports/websocket';

const transport = websocketTransport({
	url: 'wss://myapp.com/sync',

	// Auto-reconnect on disconnect
	reconnect: true,
	reconnectDelay: 1000,
	maxReconnectDelay: 30_000,

	// Heartbeat to detect stale connections
	heartbeatInterval: 30_000
});
```

### SvelteKit Server Functions Transport

```typescript
import { sveltekitTransport } from 'svelte-idb-sync/transports/sveltekit';

const transport = sveltekitTransport({
	// Uses SvelteKit's built-in server function calls
	syncAction: '/api/sync' // Maps to a +server.ts endpoint
});
```

**SvelteKit server route:**

```typescript
// src/routes/api/sync/+server.ts
import { json } from '@sveltejs/kit';
import { createSyncHandler } from 'svelte-idb-sync/server';
import { adapter } from '$lib/server/sync-adapter';

const handler = createSyncHandler(adapter);

export async function POST({ request }) {
	const body = await request.json();
	const result = await handler(body);
	return json(result);
}
```

---

## Part 8: Adapter Selection Guide

| Backend                | Adapter          | When to Use                                  |
| ---------------------- | ---------------- | -------------------------------------------- |
| PostgreSQL via Drizzle | `drizzleAdapter` | You already use Drizzle ORM for your backend |
| PostgreSQL via Prisma  | `prismaAdapter`  | You already use Prisma for your backend      |
| PostgreSQL raw         | `pgAdapter`      | You use raw SQL or a custom query layer      |
| SQLite / Turso         | `sqliteAdapter`  | Lightweight backend, edge deployment         |

| Transport            | When to Use                                  |
| -------------------- | -------------------------------------------- |
| `httpTransport`      | Universal default; works everywhere          |
| `websocketTransport` | Need real-time sync (collaborative features) |
| `sveltekitTransport` | SvelteKit app wanting tight integration      |

| Conflict Strategy | When to Use                                          |
| ----------------- | ---------------------------------------------------- |
| `lww()`           | Default; personal apps, multi-device for single user |
| `serverWins()`    | Server has business rules / authorization logic      |
| `clientWins()`    | Offline-first; user edits are precious               |
| Custom resolver   | Advanced: CRDTs, field-level merge, manual UI        |

---

**[← 03 Conflict Resolution](./03-conflict-resolution.md)** | **[Next → 05 Sync Protocol](./05-sync-protocol.md)**
