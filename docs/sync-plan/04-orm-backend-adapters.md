# 04 — ORM & Backend Adapters

> How we connect IndexedDB to Prisma, Drizzle, raw PostgreSQL, and raw SQLite.

**← [03 Conflict Resolution](./03-conflict-resolution.md)** | **[Next → 05 Sync Architecture](./05-sync-architecture.md)**

---

## The Adapter Pattern

The sync engine is **backend-agnostic**. It doesn't know or care whether the server uses Prisma, Drizzle, or raw SQL. Instead, it communicates through a standardized **adapter interface**:

```
┌──────────────────────────────────────────┐
│           Sync Engine (client)           │
│                                          │
│   push(operations) → HTTP/WS → server   │
│   pull(since) ← HTTP/WS ← server        │
└───────────────┬──────────────────────────┘
                │
                │ Standardized JSON protocol
                │
┌───────────────▼──────────────────────────┐
│         Server-Side Adapter              │
│                                          │
│   ┌──────────┐ ┌──────────┐ ┌─────────┐ │
│   │ Prisma   │ │ Drizzle  │ │ Raw SQL │ │
│   │ Adapter  │ │ Adapter  │ │ Adapter │ │
│   └──────────┘ └──────────┘ └─────────┘ │
│                                          │
│   Each adapter translates the sync       │
│   protocol into ORM/SQL operations       │
└──────────────────────────────────────────┘
```

### The Key Insight

The adapters run **on the server**, not in the browser. The client-side sync engine only speaks a simple JSON protocol. This means:

1. Adapters can use Node.js-only libraries (Prisma, Drizzle, `pg`, `better-sqlite3`)
2. No ORM code ships to the browser
3. The client bundle stays tiny
4. Users can swap adapters without changing client code

---

## Adapter Interface

Every adapter must implement this interface:

```typescript
// This runs on the server (SvelteKit server route, Express, etc.)
interface SyncAdapter {
  /**
   * Apply a batch of client operations to the server database.
   * Returns results for each operation (success, conflict, error).
   */
  push(operations: SyncOperation[]): Promise<PushResult[]>;

  /**
   * Fetch changes from the server since a given cursor/timestamp.
   * Returns changed records and a new cursor for the next pull.
   */
  pull(request: PullRequest): Promise<PullResponse>;

  /**
   * Optional: Get the current server version for a specific record.
   * Used during conflict detection.
   */
  getVersion?(storeName: string, key: IDBValidKey): Promise<number>;
}

// ─── Types ─────────────────────────────────────────

interface SyncOperation {
  id: string;                          // Client-generated UUID
  storeName: string;                   // 'users', 'invoices', etc.
  type: 'create' | 'update' | 'delete';
  key: IDBValidKey;
  value?: Record<string, unknown>;     // Record data (for create/update)
  timestamp: string;                   // HLC timestamp
  clientVersion: number;               // Last-known server version
}

interface PushResult {
  operationId: string;
  status: 'applied' | 'conflict' | 'error';
  serverRecord?: Record<string, unknown>;  // For conflict resolution
  serverVersion?: number;
  error?: string;
}

interface PullRequest {
  cursor: string | null;               // null = first pull
  stores: string[];                    // Which stores to pull
  limit?: number;                      // Max records per pull
}

interface PullResponse {
  changes: ServerChange[];
  cursor: string;                      // Cursor for next pull
  hasMore: boolean;                    // Pagination indicator
}

interface ServerChange {
  storeName: string;
  type: 'upsert' | 'delete';
  key: IDBValidKey;
  value?: Record<string, unknown>;
  version: number;
  timestamp: string;
}
```

---

## Adapter 1: Prisma

### Server-Side Setup

```typescript
// src/lib/server/sync-adapter.ts
import { createPrismaAdapter } from 'svelte-idb-sync/adapters/prisma';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const syncAdapter = createPrismaAdapter(prisma, {
  // Map svelte-idb store names → Prisma model names
  storeMapping: {
    users: 'user',              // db.users → prisma.user
    invoices: 'invoice',        // db.invoices → prisma.invoice
    settings: 'appSettings',    // db.settings → prisma.appSettings
  },

  // Which field tracks the version (default: '__version')
  versionField: '__version',

  // Which field tracks last update (default: 'updatedAt')
  timestampField: 'updatedAt',

  // Authorization: filter operations by user
  authorize: (operation, userId) => {
    if (operation.storeName === 'invoices') {
      return { where: { userId } }; // Only sync user's own invoices
    }
    return true; // Allow all
  },
});
```

### SvelteKit Route Handler

```typescript
// src/routes/api/sync/+server.ts
import { syncAdapter } from '$lib/server/sync-adapter';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
  const { action, payload } = await request.json();
  const userId = locals.user?.id;

  if (action === 'push') {
    const results = await syncAdapter.push(payload, { userId });
    return json({ results });
  }

  if (action === 'pull') {
    const response = await syncAdapter.pull(payload, { userId });
    return json(response);
  }

  return json({ error: 'Unknown action' }, { status: 400 });
};
```

### What `createPrismaAdapter` Does Internally

```typescript
// Simplified — actual implementation would be more robust

function createPrismaAdapter(prisma: PrismaClient, config: PrismaAdapterConfig): SyncAdapter {
  return {
    async push(operations) {
      return Promise.all(operations.map(async (op) => {
        const model = config.storeMapping[op.storeName] || op.storeName;
        const prismaModel = (prisma as any)[model];

        try {
          if (op.type === 'create') {
            const record = await prismaModel.create({
              data: { ...op.value, [config.versionField]: 1 },
            });
            return { operationId: op.id, status: 'applied', serverRecord: record, serverVersion: 1 };
          }

          if (op.type === 'update') {
            // Check version for conflict detection
            const current = await prismaModel.findUnique({ where: { id: op.key } });

            if (current && current[config.versionField] > op.clientVersion) {
              // Conflict!
              return {
                operationId: op.id,
                status: 'conflict',
                serverRecord: current,
                serverVersion: current[config.versionField],
              };
            }

            const record = await prismaModel.update({
              where: { id: op.key },
              data: {
                ...op.value,
                [config.versionField]: { increment: 1 },
              },
            });
            return { operationId: op.id, status: 'applied', serverRecord: record, serverVersion: record[config.versionField] };
          }

          if (op.type === 'delete') {
            await prismaModel.delete({ where: { id: op.key } });
            return { operationId: op.id, status: 'applied' };
          }
        } catch (error) {
          return { operationId: op.id, status: 'error', error: String(error) };
        }
      }));
    },

    async pull(request) {
      // ... fetch changes since cursor using Prisma queries
    },
  };
}
```

### Required Prisma Schema Additions

Users need to add sync metadata fields to their Prisma models:

```prisma
model User {
  id        Int      @id @default(autoincrement())
  name      String
  email     String   @unique

  // ─── Sync metadata (required for svelte-idb-sync) ─────
  __version  Int      @default(1)
  updatedAt  DateTime @updatedAt
  deletedAt  DateTime?  // Soft deletes for sync
}
```

---

## Adapter 2: Drizzle

### Server-Side Setup

```typescript
// src/lib/server/sync-adapter.ts
import { createDrizzleAdapter } from 'svelte-idb-sync/adapters/drizzle';
import { db } from '$lib/server/db'; // Your Drizzle instance
import { users, invoices } from '$lib/server/schema';

export const syncAdapter = createDrizzleAdapter(db, {
  storeMapping: {
    users: users,              // Map to Drizzle table reference
    invoices: invoices,
  },
  versionField: '__version',
  timestampField: 'updatedAt',
});
```

### Drizzle Schema Requirements

```typescript
// src/lib/server/schema.ts
import { pgTable, serial, text, integer, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),

  // ─── Sync metadata ─────
  __version: integer('__version').default(1).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});
```

### What `createDrizzleAdapter` Does Internally

```typescript
import { eq, gt, and, sql } from 'drizzle-orm';

function createDrizzleAdapter(db: DrizzleDB, config: DrizzleAdapterConfig): SyncAdapter {
  return {
    async push(operations) {
      return Promise.all(operations.map(async (op) => {
        const table = config.storeMapping[op.storeName];
        const vf = config.versionField;

        if (op.type === 'update') {
          // Optimistic concurrency check
          const [current] = await db.select().from(table)
            .where(eq(table.id, op.key));

          if (current && current[vf] > op.clientVersion) {
            return { operationId: op.id, status: 'conflict', serverRecord: current };
          }

          const [updated] = await db.update(table)
            .set({ ...op.value, [vf]: sql`${table[vf]} + 1` })
            .where(eq(table.id, op.key))
            .returning();

          return { operationId: op.id, status: 'applied', serverRecord: updated };
        }
        // ... create, delete cases
      }));
    },

    async pull(request) {
      const changes = [];
      for (const storeName of request.stores) {
        const table = config.storeMapping[storeName];
        const rows = await db.select().from(table)
          .where(gt(table.updatedAt, new Date(request.cursor || 0)))
          .limit(request.limit || 100);

        changes.push(...rows.map(row => ({
          storeName,
          type: row.deletedAt ? 'delete' : 'upsert',
          key: row.id,
          value: row.deletedAt ? undefined : row,
          version: row[config.versionField],
          timestamp: row.updatedAt.toISOString(),
        })));
      }

      return {
        changes,
        cursor: new Date().toISOString(),
        hasMore: false, // Simplified
      };
    }
  };
}
```

---

## Adapter 3: Raw PostgreSQL

For users who prefer raw SQL without an ORM.

### Server-Side Setup

```typescript
// src/lib/server/sync-adapter.ts
import { createRawPgAdapter } from 'svelte-idb-sync/adapters/raw-pg';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

export const syncAdapter = createRawPgAdapter(pool, {
  storeMapping: {
    users: 'users',           // Map to table name
    invoices: 'invoices',
  },
  primaryKey: 'id',           // Default PK column
  versionField: '__version',
  timestampField: 'updated_at',
});
```

### What `createRawPgAdapter` Does

```typescript
function createRawPgAdapter(pool: pg.Pool, config: RawPgConfig): SyncAdapter {
  return {
    async push(operations) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const results = await Promise.all(operations.map(async (op) => {
          const table = config.storeMapping[op.storeName] || op.storeName;
          const pk = config.primaryKey;

          if (op.type === 'update') {
            // Atomic check-and-update with RETURNING
            const { rows } = await client.query(
              `UPDATE ${table}
               SET ${Object.keys(op.value!).map((k, i) => `"${k}" = $${i + 3}`).join(', ')},
                   "${config.versionField}" = "${config.versionField}" + 1
               WHERE "${pk}" = $1 AND "${config.versionField}" <= $2
               RETURNING *`,
              [op.key, op.clientVersion, ...Object.values(op.value!)]
            );

            if (rows.length === 0) {
              // Conflict — version was higher
              const { rows: [current] } = await client.query(
                `SELECT * FROM ${table} WHERE "${pk}" = $1`,
                [op.key]
              );
              return { operationId: op.id, status: 'conflict', serverRecord: current };
            }

            return { operationId: op.id, status: 'applied', serverRecord: rows[0] };
          }
          // ... create, delete
        }));

        await client.query('COMMIT');
        return results;
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    },

    async pull(request) {
      // ... SELECT * FROM table WHERE updated_at > cursor
    },
  };
}
```

### Implementation Complexity

| Adapter            | Complexity | Notes                                                       |
| ------------------ | ---------- | ----------------------------------------------------------- |
| **Prisma**         | 🟢 Low      | Prisma's API is high-level and handles most edge cases      |
| **Drizzle**        | 🟢 Low      | Similar to Prisma but with SQL-builder syntax               |
| **Raw PostgreSQL** | 🟡 Medium   | Need to handle SQL injection prevention, connection pooling |
| **Raw SQLite**     | 🟡 Medium   | Different SQL dialect, no `RETURNING` in older versions     |

---

## Adapter 4: Raw SQLite

For users running SQLite (e.g., with `better-sqlite3` or Turso/LibSQL).

### Server-Side Setup

```typescript
// src/lib/server/sync-adapter.ts
import { createRawSqliteAdapter } from 'svelte-idb-sync/adapters/raw-sqlite';
import Database from 'better-sqlite3';

const sqliteDb = new Database('./data.db');

export const syncAdapter = createRawSqliteAdapter(sqliteDb, {
  storeMapping: {
    users: 'users',
    settings: 'app_settings',
  },
  versionField: '__version',
  timestampField: 'updated_at',
});
```

### SQLite-Specific Considerations

| Consideration                 | Approach                                         |
| ----------------------------- | ------------------------------------------------ |
| No `RETURNING` (older SQLite) | Use `SELECT` after `INSERT`/`UPDATE`             |
| No concurrent writes          | Single-writer, batch operations in a transaction |
| Timestamp format              | Store as ISO 8601 text, compare as strings       |
| JSON columns                  | Use `json_extract()` for field-merge strategy    |

---

## Adapter Priority and Release Plan

| Priority     | Adapter            | Why                                                 | Effort  |
| ------------ | ------------------ | --------------------------------------------------- | ------- |
| 🥇 **P0**     | **Prisma**         | Most popular Node.js ORM, huge ecosystem            | 2 weeks |
| 🥇 **P0**     | **Drizzle**        | Rising fast, TypeScript-native, lighter than Prisma | 2 weeks |
| 🥈 **P1**     | **Raw PostgreSQL** | For users who don't want an ORM                     | 1 week  |
| 🥉 **P2**     | **Raw SQLite**     | For lightweight/embedded use cases                  | 1 week  |
| 🏅 **Future** | **Turso/LibSQL**   | Edge SQLite, growing ecosystem                      | 1 week  |
| 🏅 **Future** | **MySQL**          | Enterprise demand                                   | 1 week  |
| 🏅 **Future** | **MongoDB**        | NoSQL use case                                      | 2 weeks |

---

## Schema Bridging: Client ↔ Server

One of the trickiest parts is mapping between the IndexedDB schema (defined in `createDB()`) and the server-side schema (Prisma schema, Drizzle tables, raw SQL).

### Approach: Explicit Mapping

Rather than trying to auto-infer or share schemas, we use explicit mapping:

```typescript
// Client-side
const db = createDB({
  name: 'myapp',
  version: 1,
  stores: {
    users: { keyPath: 'id', autoIncrement: true },
  }
});

// Sync configuration — bridge between client and server
const sync = createSync(db, {
  stores: {
    users: {
      // Sync this store
      sync: true,
      // Fields to exclude from sync (client-only)
      localOnly: ['_tempFlag', '_uiState'],
      // Fields that come from the server but are read-only on client
      serverOnly: ['createdAt', 'emailVerified'],
      // Field mapping (client name → server name)
      fieldMap: {
        id: 'id',        // Same name — can be omitted
        name: 'name',
        email: 'email',
      },
    },
    settings: {
      sync: false,  // This store stays local-only
    },
  },
  adapter: prismaAdapter({ ... }),
});
```

### Why Explicit Over Auto-Inference?

| Factor                                    | Explicit Mapping               | Auto-Inference              |
| ----------------------------------------- | ------------------------------ | --------------------------- |
| **Client ↔ server field name mismatches** | ✅ Handled via `fieldMap`       | ❌ Breaks                    |
| **Local-only fields**                     | ✅ Excluded via `localOnly`     | ❌ Tries to sync them        |
| **Server-only fields**                    | ✅ Marked read-only             | ❌ Client tries to overwrite |
| **Partial sync**                          | ✅ Per-store `sync: true/false` | ❌ All-or-nothing            |
| **Complexity for user**                   | 🟡 More config upfront          | 🟢 Zero config               |
| **Reliability**                           | ✅ Predictable                  | 🔴 Magic = footguns          |

---

**← [03 Conflict Resolution](./03-conflict-resolution.md)** | **[Next → 05 Sync Architecture](./05-sync-architecture.md)**
