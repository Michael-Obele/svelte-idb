# 06 — API Design

> Developer-facing API surface for `svelte-idb-sync` with TypeScript signatures and usage examples.

**← [05 Sync Architecture](./05-sync-architecture.md)** | **[Next → 07 Implementation Roadmap](./07-implementation-roadmap.md)**

---

## Entry Points

```typescript
// Core sync engine (pure TypeScript — any framework)
import { createSync, httpTransport, wsTransport } from 'svelte-idb-sync';

// ORM adapters (server-side only — SvelteKit server routes)
import { createPrismaAdapter } from 'svelte-idb-sync/adapters/prisma';
import { createDrizzleAdapter } from 'svelte-idb-sync/adapters/drizzle';
import { createRawPgAdapter } from 'svelte-idb-sync/adapters/raw-pg';
import { createRawSqliteAdapter } from 'svelte-idb-sync/adapters/raw-sqlite';

// Svelte reactive bindings
import { syncStatus, useSyncedQuery } from 'svelte-idb-sync/svelte';

// Conflict strategies (optional, for advanced use)
import { fieldMerge, crdtConflict } from 'svelte-idb-sync/conflict';
```

---

## `createSync()` — Sync Factory

The primary entry point. Connects a `svelte-idb` database to a sync engine.

### Signature

```typescript
function createSync<TSchema extends DBSchema>(
  db: Database<TSchema>,
  config: SyncConfig
): SyncInstance;
```

### `SyncConfig`

```typescript
interface SyncConfig {
  /**
   * Transport layer for server communication.
   * Default: httpTransport with sensible defaults.
   */
  transport: SyncTransport;

  /**
   * Which stores to sync and their configuration.
   * Stores not listed here remain local-only.
   */
  stores: Record<string, StoreSync>;

  /**
   * Global conflict resolution strategy.
   * Default: 'server-wins'
   */
  conflict?: ConflictStrategy;

  /**
   * Debounce interval for batching push operations (ms).
   * Default: 1000
   */
  pushDebounce?: number;

  /**
   * Maximum operations per push batch.
   * Default: 50
   */
  pushBatchSize?: number;

  /**
   * Automatically start syncing on creation.
   * Default: true
   */
  autoStart?: boolean;

  /**
   * Enable debug logging.
   * Default: false (inherits from db.debug if set)
   */
  debug?: boolean;

  /**
   * Callback when the sync status changes.
   */
  onStatusChange?: (status: SyncStatus) => void;

  /**
   * Callback when a conflict is detected and resolved.
   */
  onConflict?: (event: ConflictEvent) => void;

  /**
   * Callback when a sync error occurs that couldn't be auto-resolved.
   */
  onError?: (error: SyncError) => void;
}
```

### `StoreSync`

```typescript
interface StoreSync {
  /**
   * Enable sync for this store.
   * Default: true (if the store is listed at all)
   */
  sync?: boolean;

  /**
   * Fields that exist only on the client (excluded from push).
   */
  localOnly?: string[];

  /**
   * Fields that come from the server and are read-only on the client.
   */
  serverOnly?: string[];

  /**
   * Field name mapping: { clientFieldName: serverFieldName }
   * Only needed if names differ between client and server.
   */
  fieldMap?: Record<string, string>;

  /**
   * Per-store conflict resolution (overrides global).
   */
  conflict?: ConflictStrategy;
}
```

### `ConflictStrategy`

```typescript
type ConflictStrategy =
  | 'server-wins'          // Server version always wins (default)
  | 'client-wins'          // Client version always wins
  | 'last-write-wins'      // Most recent timestamp wins (HLC)
  | 'field-merge'          // Per-field LWW merge
  | ConflictResolver;      // Custom function

type ConflictResolver = (
  local: Record<string, unknown>,
  server: Record<string, unknown>,
  meta: ConflictMeta
) => Record<string, unknown> | Promise<Record<string, unknown>>;

interface ConflictMeta {
  storeName: string;
  key: IDBValidKey;
  localTimestamp: string;
  serverTimestamp: string;
  serverVersion: number;
  operationType: 'create' | 'update' | 'delete';
}
```

---

## `SyncInstance` — Return Type

```typescript
interface SyncInstance {
  /** Start syncing (if autoStart was false) */
  start(): void;

  /** Stop syncing (pauses push/pull) */
  stop(): void;

  /** Force an immediate push of pending operations */
  pushNow(): Promise<PushResult[]>;

  /** Force an immediate pull from server */
  pullNow(): Promise<PullResponse>;

  /** Get the current sync status */
  readonly status: SyncStatus;

  /** Number of pending (unsynced) operations */
  readonly pendingCount: number;

  /** Timestamp of last successful sync */
  readonly lastSyncedAt: Date | null;

  /** Retry failed operations */
  retry(): Promise<void>;

  /** Clear all sync state (oplog, cursors) — destructive */
  reset(): Promise<void>;

  /** Dispose the sync engine and clean up resources */
  dispose(): void;
}

type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';
```

---

## Full Example: Client + Server

### Client-Side (SvelteKit)

```typescript
// src/lib/db.ts
import { createDB } from 'svelte-idb';
import { createReactiveDB } from 'svelte-idb/svelte';
import { createSync, httpTransport } from 'svelte-idb-sync';

// 1. Create the database (same as before — svelte-idb is unchanged)
const coreDb = createDB({
  name: 'invoice-app',
  version: 2,
  stores: {
    clients: { keyPath: 'id', autoIncrement: true },
    invoices: {
      keyPath: 'id',
      autoIncrement: true,
      indexes: {
        byClient: { keyPath: 'clientId' },
        byStatus: { keyPath: 'status' },
      },
    },
    settings: { keyPath: 'key' },
  },
});

// 2. Wrap with reactivity (same as before)
export const db = createReactiveDB(coreDb);

// 3. Create sync engine (NEW — from svelte-idb-sync)
export const sync = createSync(db, {
  transport: httpTransport({
    endpoint: '/api/sync',
    pollInterval: 30_000,
    headers: () => ({
      Authorization: `Bearer ${localStorage.getItem('token')}`,
    }),
  }),

  stores: {
    clients: {
      sync: true,
      localOnly: ['_selected'],  // UI-only flag
    },
    invoices: {
      sync: true,
      serverOnly: ['pdfUrl'],   // Generated on server
      conflict: 'server-wins',
    },
    settings: {
      sync: false,  // Keep settings local-only
    },
  },

  conflict: 'server-wins',  // Global default
  pushDebounce: 1000,

  onConflict: (event) => {
    console.warn(`Conflict on ${event.storeName}:`, event);
  },
});
```

### Server-Side (SvelteKit Route)

```typescript
// src/routes/api/sync/+server.ts
import { createPrismaAdapter } from 'svelte-idb-sync/adapters/prisma';
import { PrismaClient } from '@prisma/client';
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const prisma = new PrismaClient();

const adapter = createPrismaAdapter(prisma, {
  storeMapping: {
    clients: 'client',
    invoices: 'invoice',
  },
  versionField: '__version',
  timestampField: 'updatedAt',
  authorize: async (op, userId) => {
    // Only sync data owned by the authenticated user
    return { where: { userId } };
  },
});

export const POST: RequestHandler = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) return error(401, 'Unauthorized');

  const { action, payload } = await request.json();

  try {
    switch (action) {
      case 'push': {
        const results = await adapter.push(payload, { userId: user.id });
        return json({ results });
      }
      case 'pull': {
        const response = await adapter.pull(payload, { userId: user.id });
        return json(response);
      }
      default:
        return error(400, 'Invalid sync action');
    }
  } catch (e) {
    console.error('Sync error:', e);
    return error(500, 'Sync failed');
  }
};
```

---

## Svelte Reactive Bindings

### `syncStatus()` — Reactive Status

```svelte
<script lang="ts">
  import { syncStatus } from 'svelte-idb-sync/svelte';
  import { sync } from '$lib/db';

  const status = syncStatus(sync);
</script>

<!-- Sync indicator -->
<div class="sync-indicator">
  {#if status.current === 'syncing'}
    <Spinner /> Syncing...
  {:else if status.current === 'synced'}
    ✅ All changes synced
  {:else if status.current === 'offline'}
    ⚠️ Offline — {status.pendingCount} pending
  {:else if status.current === 'error'}
    ❌ Sync error
    <button onclick={() => sync.retry()}>Retry</button>
  {/if}
</div>

{#if status.lastSyncedAt}
  <small>Last synced: {status.lastSyncedAt.toLocaleTimeString()}</small>
{/if}
```

### `SyncStatusValue`

```typescript
interface SyncStatusValue {
  /** Current sync state */
  readonly current: SyncStatus;

  /** Number of operations waiting to be pushed */
  readonly pendingCount: number;

  /** When the last successful sync completed */
  readonly lastSyncedAt: Date | null;

  /** Whether the browser is online */
  readonly isOnline: boolean;

  /** The last error, if status is 'error' */
  readonly error: SyncError | null;
}
```

---

## Transport Configuration

### `httpTransport()`

```typescript
function httpTransport(config: HttpTransportConfig): SyncTransport;

interface HttpTransportConfig {
  /** Server endpoint URL */
  endpoint: string;

  /** Polling interval for pull (ms). Default: 30000 */
  pollInterval?: number;

  /** Custom headers (or async function returning headers) */
  headers?: Record<string, string> | (() => Record<string, string> | Promise<Record<string, string>>);

  /** Request timeout (ms). Default: 10000 */
  timeout?: number;

  /** Retry configuration */
  retry?: {
    maxAttempts?: number;       // Default: 5
    backoff?: 'linear' | 'exponential';  // Default: 'exponential'
    initialDelay?: number;      // Default: 1000
    maxDelay?: number;          // Default: 30000
  };

  /** Custom fetch implementation (for testing or polyfills) */
  fetch?: typeof fetch;
}
```

### `wsTransport()`

```typescript
function wsTransport(config: WsTransportConfig): SyncTransport;

interface WsTransportConfig {
  /** WebSocket server URL */
  url: string;

  /** Auto-reconnect on disconnect */
  reconnect?: boolean;       // Default: true

  /** Max reconnection attempts. Default: Infinity */
  maxReconnectAttempts?: number;

  /** Push mutations via WebSocket instead of HTTP */
  pushViaWs?: boolean;       // Default: false

  /** Auth token getter */
  getToken?: () => string | Promise<string>;

  /** Heartbeat interval (ms). Default: 30000 */
  heartbeat?: number;
}
```

---

## Error Types

```typescript
import {
  SyncError,
  SyncNetworkError,
  SyncConflictError,
  SyncAuthError,
  SyncTimeoutError
} from 'svelte-idb-sync';

// Error hierarchy
class SyncError extends Error {
  readonly code: string;
  readonly retryable: boolean;
}

class SyncNetworkError extends SyncError {
  // Network failures (offline, DNS, etc.)
  readonly retryable = true;
}

class SyncConflictError extends SyncError {
  // Unresolvable conflict
  readonly localRecord: unknown;
  readonly serverRecord: unknown;
  readonly retryable = false;
}

class SyncAuthError extends SyncError {
  // 401/403 from server
  readonly retryable = false;
}

class SyncTimeoutError extends SyncError {
  // Request timeout
  readonly retryable = true;
}
```

---

## Usage with Drizzle (Alternative Adapter)

```typescript
// src/routes/api/sync/+server.ts
import { createDrizzleAdapter } from 'svelte-idb-sync/adapters/drizzle';
import { db } from '$lib/server/db';
import { clients, invoices } from '$lib/server/schema';

const adapter = createDrizzleAdapter(db, {
  storeMapping: {
    clients,
    invoices,
  },
  versionField: '__version',
  timestampField: 'updatedAt',
});

// ... same POST handler as Prisma example
```

---

## Usage with Raw PostgreSQL

```typescript
// src/routes/api/sync/+server.ts
import { createRawPgAdapter } from 'svelte-idb-sync/adapters/raw-pg';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const adapter = createRawPgAdapter(pool, {
  storeMapping: {
    clients: 'clients',
    invoices: 'invoices',
  },
  primaryKey: 'id',
  versionField: '__version',
  timestampField: 'updated_at',
});

// ... same POST handler
```

---

**← [05 Sync Architecture](./05-sync-architecture.md)** | **[Next → 07 Implementation Roadmap](./07-implementation-roadmap.md)**
