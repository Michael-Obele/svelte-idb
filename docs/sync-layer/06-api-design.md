# 06 — API Design

> Full TypeScript API surface for `svelte-idb-sync` — the sync layer addon for svelte-idb.

---

## Entry Points

```typescript
// Core sync engine
import { createSync, type SyncEngine } from 'svelte-idb-sync';

// Server adapters
import { drizzleAdapter } from 'svelte-idb-sync/adapters/drizzle';
import { prismaAdapter } from 'svelte-idb-sync/adapters/prisma';
import { pgAdapter } from 'svelte-idb-sync/adapters/pg';
import { sqliteAdapter } from 'svelte-idb-sync/adapters/sqlite';

// Transport layers
import { httpTransport } from 'svelte-idb-sync/transports/http';
import { websocketTransport } from 'svelte-idb-sync/transports/websocket';
import { sveltekitTransport } from 'svelte-idb-sync/transports/sveltekit';

// Conflict resolvers
import { lww, serverWins, clientWins, fieldLevelLWW } from 'svelte-idb-sync/resolvers';

// Svelte reactive bindings
import { useSyncStatus } from 'svelte-idb-sync/svelte';

// Server-side handler (for building sync API endpoints)
import { createSyncHandler } from 'svelte-idb-sync/server';
```

---

## 1. `createSync()` — Primary API

### Signature

```typescript
function createSync<TSchema extends DBSchema>(
	db: Database<TSchema>,
	config: SyncConfig<TSchema>
): SyncEngine<TSchema>;
```

### Config

```typescript
interface SyncConfig<TSchema extends DBSchema> {
	/**
	 * Transport layer for client-server communication.
	 * Determines HOW data is sent/received.
	 */
	transport: Transport;

	/**
	 * Sync mode.
	 * - 'manual': User calls sync.push() / sync.pull() explicitly
	 * - 'auto': Periodic polling + immediate push on write
	 * - 'realtime': Server-push via WebSocket/SSE + immediate push
	 * @default 'auto'
	 */
	mode?: 'manual' | 'auto' | 'realtime';

	/**
	 * Polling interval for 'auto' mode (milliseconds).
	 * Ignored in 'manual' and 'realtime' modes.
	 * @default 30_000
	 */
	pullInterval?: number;

	/**
	 * Push local changes immediately on write (don't wait for timer/manual trigger).
	 * @default true
	 */
	pushImmediate?: boolean;

	/**
	 * Default conflict resolution strategy for all stores.
	 * @default lww()
	 */
	conflictResolution?: ConflictResolver;

	/**
	 * Per-store sync configuration.
	 * If a store is not listed, it is NOT synced.
	 * Use `true` for default settings, or an object for overrides.
	 */
	stores: {
		[K in keyof TSchema]?: true | StoreSync<TSchema[K]>;
	};

	/**
	 * Retry configuration for failed pushes.
	 */
	retry?: RetryConfig;

	/**
	 * Changelog cleanup configuration.
	 */
	cleanup?: CleanupConfig;

	/**
	 * Whether to expose sync metadata fields (_syncVersion, _updatedAt, etc.)
	 * when reading records through svelte-idb.
	 * @default false
	 */
	exposeMetadata?: boolean;

	/**
	 * Enable debug logging for sync operations.
	 * @default false
	 */
	debug?: boolean;

	/**
	 * Authentication token or header provider.
	 * Called before each network request.
	 */
	auth?: () => string | Promise<string> | Record<string, string> | Promise<Record<string, string>>;

	/**
	 * Callback when sync errors occur.
	 */
	onError?: (error: SyncError) => void;

	/**
	 * Callback when sync state changes.
	 */
	onStateChange?: (state: SyncState) => void;
}
```

### Per-Store Config

```typescript
interface StoreSync<T> {
	/**
	 * Conflict resolution strategy for this store.
	 * Overrides the global default.
	 */
	conflictResolution?: ConflictResolver<T>;

	/**
	 * Filter which records to sync.
	 * Only records matching this filter are pushed/pulled.
	 * Useful for multi-tenant apps (sync only current user's data).
	 */
	filter?: Partial<T> | ((record: T) => boolean);

	/**
	 * Transform record before pushing to server.
	 * Useful for stripping client-only fields.
	 */
	beforePush?: (record: T) => Partial<T>;

	/**
	 * Transform record after pulling from server.
	 * Useful for adding client-only defaults.
	 */
	afterPull?: (record: T) => T;
}
```

---

## 2. `SyncEngine` — Returned Instance

```typescript
interface SyncEngine<TSchema extends DBSchema> {
	// ─── Sync Operations ────────────────────────────────

	/**
	 * Push all pending local changes to the server.
	 * @returns Push result with applied/rejected changes.
	 */
	push(): Promise<PushResult>;

	/**
	 * Pull latest changes from the server.
	 * @param stores Optional: pull specific stores only.
	 * @returns Pull result with applied changes and new cursor.
	 */
	pull(stores?: (keyof TSchema)[]): Promise<PullResult>;

	/**
	 * Bidirectional sync: push local changes + pull remote changes.
	 * Most efficient — single network round trip.
	 */
	sync(): Promise<SyncResult>;

	// ─── Lifecycle ──────────────────────────────────────

	/**
	 * Start automatic syncing (for 'auto' and 'realtime' modes).
	 * No-op in 'manual' mode.
	 */
	start(): void;

	/**
	 * Stop automatic syncing.
	 * Pending pushes are NOT cancelled — they complete but no new syncs are scheduled.
	 */
	stop(): void;

	/**
	 * Clean up all resources: stop syncing, close connections, remove hooks.
	 */
	destroy(): void;

	// ─── State ──────────────────────────────────────────

	/**
	 * Current sync state.
	 */
	readonly state: SyncState;

	/**
	 * Whether the sync engine is currently performing a sync operation.
	 */
	readonly isSyncing: boolean;

	/**
	 * Whether the transport is connected / online.
	 */
	readonly isOnline: boolean;

	/**
	 * Number of pending (unsynced) changes.
	 */
	readonly pendingCount: number;

	/**
	 * Last successful sync timestamp.
	 */
	readonly lastSyncAt: number | null;

	// ─── Change Log ─────────────────────────────────────

	/**
	 * Get all pending (unsynced) changes.
	 */
	getPendingChanges(): Promise<ChangeEntry[]>;

	/**
	 * Get pending changes for a specific store.
	 */
	getPendingChangesForStore(storeName: keyof TSchema): Promise<ChangeEntry[]>;

	/**
	 * Clear all pending changes (DANGEROUS — unsynced data will be lost).
	 */
	clearPending(): Promise<void>;

	// ─── Cleanup ────────────────────────────────────────

	/**
	 * Remove synced changelog entries older than maxAge.
	 */
	cleanup(options?: { maxAge?: number; maxEntries?: number }): Promise<number>;

	// ─── Events ─────────────────────────────────────────

	/**
	 * Register a callback for sync events.
	 */
	on(event: SyncEvent, callback: SyncEventCallback): Unsubscribe;
}
```

### Sync State

```typescript
type SyncState =
	| 'idle' // Not syncing, no pending changes
	| 'pending' // Has unsynced local changes
	| 'pushing' // Currently pushing changes to server
	| 'pulling' // Currently pulling changes from server
	| 'syncing' // Currently doing bidirectional sync
	| 'error' // Last sync failed
	| 'offline'; // Transport reports offline

interface SyncStateDetails {
	state: SyncState;
	pendingCount: number;
	lastSyncAt: number | null;
	lastError: SyncError | null;
	isOnline: boolean;
}
```

### Sync Events

```typescript
type SyncEvent =
	| 'push:start'
	| 'push:success'
	| 'push:error'
	| 'pull:start'
	| 'pull:success'
	| 'pull:error'
	| 'conflict'
	| 'state:change'
	| 'online'
	| 'offline';

type SyncEventCallback = (detail: SyncEventDetail) => void;

interface SyncEventDetail {
	event: SyncEvent;
	timestamp: number;
	data?: unknown; // Event-specific data
}
```

---

## 3. Server Adapter APIs

### Drizzle Adapter

```typescript
function drizzleAdapter<TSchema extends DBSchema>(config: {
	/** Drizzle database instance */
	db: DrizzleDatabase;

	/** Mapping from svelte-idb store names to Drizzle table definitions */
	tables: { [K in keyof TSchema]?: DrizzleTable };

	/**
	 * Name for the auto-created change tracking table.
	 * @default '_sync_changes'
	 */
	changeTrackingTable?: string;

	/**
	 * Custom primary key accessor per store.
	 * By default, uses 'id' column.
	 */
	primaryKeys?: { [K in keyof TSchema]?: string };
}): ServerAdapter;
```

### Prisma Adapter

```typescript
function prismaAdapter<TSchema extends DBSchema>(config: {
	/** PrismaClient instance */
	prisma: PrismaClient;

	/** Mapping from svelte-idb store names to Prisma model names */
	models: { [K in keyof TSchema]?: string };

	/**
	 * Whether to auto-create the SyncChange model via raw SQL.
	 * If false, user must add it to schema.prisma manually.
	 * @default true
	 */
	autoCreateChangeTable?: boolean;
}): ServerAdapter;
```

### Raw PostgreSQL Adapter

```typescript
function pgAdapter<TSchema extends DBSchema>(config: {
	/** postgres.js or pg client instance */
	sql: PostgresClient;

	/** Table mapping configuration per store */
	tables: {
		[K in keyof TSchema]?: {
			tableName: string;
			primaryKey: string;
			/** Column name mapping: IDB field name → DB column name */
			columns?: Record<string, string>;
		};
	};
}): ServerAdapter;
```

### Raw SQLite Adapter

```typescript
function sqliteAdapter<TSchema extends DBSchema>(config: {
	/** better-sqlite3 or @libsql/client instance */
	db: SQLiteDatabase;

	/** SQLite dialect for syntax differences */
	dialect?: 'better-sqlite3' | 'libsql';

	/** Table mapping configuration per store */
	tables: {
		[K in keyof TSchema]?: {
			tableName: string;
			primaryKey: string;
			columns?: Record<string, string>;
		};
	};
}): ServerAdapter;
```

---

## 4. Transport APIs

### HTTP Transport

```typescript
function httpTransport(config: {
	/** URL of the sync API endpoint */
	endpoint: string;

	/** Additional headers for requests */
	headers?:
		| Record<string, string>
		| (() => Record<string, string> | Promise<Record<string, string>>);

	/** Fetch options (credentials, mode, etc.) */
	fetchOptions?: RequestInit;

	/** Request timeout in milliseconds. @default 30_000 */
	timeout?: number;

	/** Polling interval for pull in 'auto' mode. @default 30_000 */
	pullInterval?: number;

	/** Retry configuration */
	retry?: RetryConfig;
}): Transport;
```

### WebSocket Transport

```typescript
function websocketTransport(config: {
	/** WebSocket URL */
	url: string;

	/** Subprotocols */
	protocols?: string | string[];

	/** Auto-reconnect on disconnect. @default true */
	reconnect?: boolean;

	/** Initial reconnect delay. @default 1_000 */
	reconnectDelay?: number;

	/** Maximum reconnect delay. @default 30_000 */
	maxReconnectDelay?: number;

	/** Heartbeat interval to detect stale connections. @default 30_000 */
	heartbeatInterval?: number;
}): Transport;
```

### SvelteKit Transport

```typescript
function sveltekitTransport(config: {
	/** SvelteKit API route path for sync */
	endpoint: string;

	/** Additional fetch options */
	fetchOptions?: RequestInit;
}): Transport;
```

---

## 5. Conflict Resolver APIs

### Built-in Resolvers

```typescript
/** Last-Write-Wins — most recent timestamp wins */
function lww(): ConflictResolver;

/** Server always wins */
function serverWins(): ConflictResolver;

/** Client always wins */
function clientWins(): ConflictResolver;

/** Field-level LWW — merge non-conflicting fields */
function fieldLevelLWW(): ConflictResolver;
```

### Custom Resolver Interface

```typescript
interface ConflictResolver<T = unknown> {
	/** Name for debug logging */
	readonly name: string;

	/**
	 * Resolve a conflict between local and remote versions.
	 * Return the version that should be kept.
	 */
	resolve(local: T, remote: T, meta: ConflictMeta): T | Promise<T>;
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

---

## 6. Server-Side Handler

For building the sync API endpoint on your server:

```typescript
/**
 * Create a framework-agnostic sync request handler.
 * Wraps a ServerAdapter to handle incoming sync requests.
 */
function createSyncHandler(adapter: ServerAdapter): SyncHandler;

type SyncHandler = (request: SyncRequest) => Promise<SyncResponse>;
```

### SvelteKit Integration

```typescript
// src/routes/api/sync/+server.ts
import { json } from '@sveltejs/kit';
import { createSyncHandler } from 'svelte-idb-sync/server';
import { drizzleAdapter } from 'svelte-idb-sync/adapters/drizzle';
import { db, todos, users } from '$lib/server/db';

const adapter = drizzleAdapter({
	db,
	tables: { todos, users }
});

const handler = createSyncHandler(adapter);

export async function POST({ request }) {
	const body = await request.json();
	const result = await handler(body);
	return json(result);
}
```

### Express Integration

```typescript
// server.js
import express from 'express';
import { createSyncHandler } from 'svelte-idb-sync/server';
import { pgAdapter } from 'svelte-idb-sync/adapters/pg';

const adapter = pgAdapter({
	/* ... */
});
const handler = createSyncHandler(adapter);

const app = express();
app.use(express.json());

app.post('/api/sync', async (req, res) => {
	const result = await handler(req.body);
	res.json(result);
});
```

### Hono Integration

```typescript
// server.ts
import { Hono } from 'hono';
import { createSyncHandler } from 'svelte-idb-sync/server';
import { drizzleAdapter } from 'svelte-idb-sync/adapters/drizzle';

const adapter = drizzleAdapter({
	/* ... */
});
const handler = createSyncHandler(adapter);

const app = new Hono();

app.post('/api/sync', async (c) => {
	const body = await c.req.json();
	const result = await handler(body);
	return c.json(result);
});
```

---

## 7. Svelte Reactive Bindings

### `useSyncStatus()` — Reactive Sync State

```typescript
// In a .svelte.ts file
import { useSyncStatus } from 'svelte-idb-sync/svelte';

// Returns a reactive object with $state properties
const status = useSyncStatus(syncEngine);

// status.state      → 'idle' | 'pending' | 'syncing' | ...
// status.isOnline   → boolean
// status.isSyncing  → boolean
// status.pendingCount → number
// status.lastSyncAt → number | null
// status.lastError  → SyncError | null
```

### Usage in Svelte Component

```svelte
<script>
	import { useSyncStatus } from 'svelte-idb-sync/svelte';
	import { sync } from '$lib/sync';

	const status = useSyncStatus(sync);
</script>

{#if status.isSyncing}
	<span class="sync-indicator">Syncing...</span>
{:else if status.pendingCount > 0}
	<span class="sync-indicator">
		{status.pendingCount} changes pending
	</span>
{:else if !status.isOnline}
	<span class="sync-indicator offline">Offline</span>
{:else}
	<span class="sync-indicator synced">Synced</span>
{/if}
```

---

## 8. Complete Example — Full Setup

### Client: `src/lib/db.ts`

```typescript
import { createDB, type DBSchema } from 'svelte-idb';

interface MySchema extends DBSchema {
	todos: {
		key: number;
		value: {
			id: number;
			title: string;
			completed: boolean;
			userId: string;
		};
		indexes: {
			'by-user': string;
			'by-completed': number; // 0 or 1
		};
	};
	settings: {
		key: string;
		value: {
			key: string;
			value: unknown;
		};
	};
}

export const db = createDB<MySchema>({
	name: 'myapp',
	version: 1,
	schema: {
		todos: {
			keyPath: 'id',
			autoIncrement: true,
			indexes: {
				'by-user': { keyPath: 'userId' },
				'by-completed': { keyPath: 'completed' }
			}
		},
		settings: {
			keyPath: 'key'
		}
	}
});
```

### Client: `src/lib/sync.ts`

```typescript
import { createSync } from 'svelte-idb-sync';
import { httpTransport } from 'svelte-idb-sync/transports/http';
import { lww, clientWins } from 'svelte-idb-sync/resolvers';
import { db } from './db';

export const sync = createSync(db, {
	transport: httpTransport({
		endpoint: '/api/sync',
		headers: () => ({
			Authorization: `Bearer ${getAuthToken()}`
		})
	}),

	mode: 'auto',
	pullInterval: 30_000,
	pushImmediate: true,

	conflictResolution: lww(),

	stores: {
		todos: {
			filter: { userId: getCurrentUserId() },
			conflictResolution: lww()
		},
		settings: {
			conflictResolution: clientWins()
		}
	},

	debug: import.meta.env.DEV,

	onError(error) {
		console.error('[Sync Error]', error);
	}
});

// Start syncing
sync.start();
```

### Server: `src/routes/api/sync/+server.ts`

```typescript
import { json } from '@sveltejs/kit';
import { createSyncHandler } from 'svelte-idb-sync/server';
import { drizzleAdapter } from 'svelte-idb-sync/adapters/drizzle';
import { db } from '$lib/server/drizzle';
import { todos, settings } from '$lib/server/schema';

const adapter = drizzleAdapter({
	db,
	tables: { todos, settings }
});

const handler = createSyncHandler(adapter);

export async function POST({ request, locals }) {
	// Optional: verify auth
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const body = await request.json();
	const result = await handler(body);
	return json(result);
}
```

### Component: `src/routes/+page.svelte`

```svelte
<script>
	import { db } from '$lib/db';
	import { sync } from '$lib/sync';
	import { useSyncStatus } from 'svelte-idb-sync/svelte';
	import { createReactiveDB } from 'svelte-idb/svelte';

	const reactiveDB = createReactiveDB(db);
	const allTodos = reactiveDB.todos.liveAll();
	const status = useSyncStatus(sync);

	let title = $state('');

	async function addTodo() {
		// This writes to IndexedDB AND gets logged for sync automatically
		await db.todos.add({ title, completed: false, userId: 'user-1' });
		title = '';
	}
</script>

<header>
	{#if status.isSyncing}
		<span>🔄 Syncing...</span>
	{:else if status.pendingCount > 0}
		<span>📤 {status.pendingCount} pending</span>
	{:else if !status.isOnline}
		<span>📵 Offline</span>
	{:else}
		<span>✅ Synced</span>
	{/if}
</header>

<form onsubmit={addTodo}>
	<input bind:value={title} placeholder="New todo..." />
	<button type="submit">Add</button>
</form>

<ul>
	{#each allTodos.value as todo (todo.id)}
		<li>{todo.title}</li>
	{/each}
</ul>
```

---

**[← 05 Sync Protocol](./05-sync-protocol.md)** | **[Next → 07 Implementation Roadmap](./07-implementation-roadmap.md)**
