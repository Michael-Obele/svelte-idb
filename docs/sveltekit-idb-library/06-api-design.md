# 06 — API Design

> Full API reference with TypeScript signatures and usage examples.

**← [05 SvelteKit Packaging](./05-sveltekit-packaging.md)** | **[Next → 07 Architecture](./07-architecture.md)**

---

## Entry Points

```typescript
// Core — works in any JS/TS environment
import { createDB, type DBSchema, type Store } from 'svelte-idb';

// Svelte — requires Svelte 5 (runes)
import { liveQuery, liveGet, liveCount } from 'svelte-idb/svelte';
```

---

## `createDB()` — Database Factory

The primary entry point. Creates a typed database instance.

### Signature

```typescript
function createDB<TSchema extends DBSchema>(config: DatabaseConfig<TSchema>): Database<TSchema>;
```

### `DatabaseConfig<TSchema>`

```typescript
interface DatabaseConfig<TSchema extends DBSchema> {
	/** Database name (must be unique per origin) */
	name: string;

	/** Schema version — increment on every schema change */
	version: number;

	/** Store definitions */
	stores: TSchema;

	/** SSR behavior: 'noop' (default), 'throw', or custom handler */
	ssr?: 'noop' | 'throw' | ((operation: string) => void);

	/** Enable cross-tab reactivity via BroadcastChannel */
	crossTab?: boolean;

	/** Migration function called during version upgrades */
	onUpgrade?: (
		db: IDBDatabase,
		oldVersion: number,
		newVersion: number,
		transaction: IDBTransaction
	) => void;

	/** Called when another tab requests a version upgrade */
	onBlocked?: () => void;

	/** Debug mode — logs all operations to console */
	debug?: boolean;
}
```

### `DBSchema` — Store Definitions

```typescript
type DBSchema = Record<string, StoreConfig>;

interface StoreConfig {
	/** Property name used as the primary key */
	keyPath: string;

	/** Auto-generate numeric keys for new records */
	autoIncrement?: boolean;

	/** Secondary indexes for querying */
	indexes?: Record<string, IndexConfig>;
}

interface IndexConfig {
	/** Property path(s) to index */
	keyPath: string | string[];

	/** Enforce unique values */
	unique?: boolean;

	/** Index arrays of values (multiEntry) */
	multiEntry?: boolean;
}
```

### Example

```typescript
import { createDB } from 'svelte-idb';

interface User {
	id?: number;
	name: string;
	email: string;
	age: number;
}

interface Settings {
	id: string;
	theme: 'light' | 'dark';
	language: string;
}

const db = createDB({
	name: 'my-app',
	version: 1,
	stores: {
		users: {
			keyPath: 'id',
			autoIncrement: true,
			indexes: {
				byEmail: { keyPath: 'email', unique: true },
				byAge: { keyPath: 'age' }
			}
		},
		settings: {
			keyPath: 'id',
			autoIncrement: false
		}
	}
});

// db.users is Store<User>
// db.settings is Store<Settings>
```

---

## `Store<T>` — CRUD Operations

Every store on the database instance exposes these methods.

### `add(value: T): Promise<IDBValidKey>`

Insert a new record. Fails if the key already exists.

```typescript
const id = await db.users.add({ name: 'Alice', email: 'alice@mail.com', age: 30 });
// id === 1 (auto-generated)
```

### `put(value: T): Promise<IDBValidKey>`

Insert or update a record (upsert).

```typescript
// Insert new
await db.users.put({ name: 'Bob', email: 'bob@mail.com', age: 25 });

// Update existing (include the key)
await db.users.put({ id: 1, name: 'Alice Updated', email: 'alice@mail.com', age: 31 });
```

### `get(key: IDBValidKey): Promise<T | undefined>`

Retrieve a single record by primary key.

```typescript
const user = await db.users.get(1);
// user === { id: 1, name: 'Alice', email: 'alice@mail.com', age: 30 }
```

### `getAll(): Promise<T[]>`

Retrieve all records in the store.

```typescript
const allUsers = await db.users.getAll();
```

### `getAllFromIndex(indexName: string, query?: IDBValidKey | IDBKeyRange, count?: number): Promise<T[]>`

Query records via a secondary index.

```typescript
// Get all users with a specific email
const users = await db.users.getAllFromIndex('byEmail', 'alice@mail.com');

// Get all users aged 25-35
const young = await db.users.getAllFromIndex('byAge', IDBKeyRange.bound(25, 35));

// Get first 10 users by age
const page = await db.users.getAllFromIndex('byAge', undefined, 10);
```

### `delete(key: IDBValidKey): Promise<void>`

Remove a record by primary key.

```typescript
await db.users.delete(1);
```

### `clear(): Promise<void>`

Remove all records from the store.

```typescript
await db.users.clear();
```

### `count(): Promise<number>`

Count records in the store.

```typescript
const total = await db.users.count();
```

---

## Reactive API (`svelte-idb/svelte`)

These functions return `LiveQuery` objects with reactive `.current`, `.loading`, and `.error` properties backed by `$state`.

### `store.liveAll(): LiveQuery<T[]>`

Reactively observe all records in a store.

```svelte
<script lang="ts">
	const users = db.users.liveAll();
</script>

{#if users.loading}
	<p>Loading...</p>
{:else if users.error}
	<p>Error: {users.error.message}</p>
{:else}
	{#each users.current as user}
		<p>{user.name}</p>
	{/each}
{/if}
```

### `store.liveGet(key: IDBValidKey): LiveQuery<T | undefined>`

Reactively observe a single record.

```svelte
<script lang="ts">
	let { id } = $props();
	const user = db.users.liveGet(id);
</script>

{#if user.current}
	<h1>{user.current.name}</h1>
{/if}
```

### `store.liveCount(): LiveQuery<number>`

Reactively observe the record count.

```svelte
<script lang="ts">
	const count = db.users.liveCount();
</script>

<span>{count.current} users</span>
```

### `db.liveQuery(queryFn, storeNames): LiveQuery<T>`

Custom reactive query with full control.

```svelte
<script lang="ts">
	// Watch multiple stores
	const summary = db.liveQuery(async () => {
		const users = await db.users.getAll();
		const settings = await db.settings.get('app');
		return {
			totalUsers: users.length,
			theme: settings?.theme ?? 'light'
		};
	}, ['users', 'settings']);
</script>

<p>{summary.current.totalUsers} users, theme: {summary.current.theme}</p>
```

---

## `LiveQuery<T>` — Return Type

```typescript
interface LiveQuery<T> {
	/** The current query result (reactive via $state) */
	readonly current: T;

	/** Whether the query is currently executing */
	readonly loading: boolean;

	/** The last error, if any */
	readonly error: Error | null;

	/** Manually trigger a re-query */
	refresh(): Promise<void>;

	/** Stop observing changes (cleanup) */
	destroy(): void;
}
```

---

## Transaction API (Tier 3)

For atomic multi-store operations.

```typescript
await db.transaction(['users', 'settings'], async (tx) => {
	const user = await tx.users.get(1);
	if (user) {
		user.age += 1;
		await tx.users.put(user);
		await tx.settings.put({
			id: 'lastUpdated',
			value: new Date().toISOString()
		});
	}
	// Automatically commits on success, rolls back on error
});
```

---

## Query Builder API (Tier 3)

Chainable queries for more complex filtering.

```typescript
// Equals
const alice = await db.users.where('email').equals('alice@mail.com').first();

// Range
const youngUsers = await db.users.where('age').between(18, 30).toArray();

// Compound
const recent = await db.invoices
	.where(['isDraft', 'createdAt'])
	.between([0, new Date('2024-01-01')], [0, new Date()])
	.toArray();

// Count with filter
const paidCount = await db.invoices.where('status').equals('paid').count();
```

---

## Bulk Operations (Tier 4)

```typescript
// Add many records in a single transaction
const ids = await db.users.addMany([
	{ name: 'Alice', email: 'alice@mail.com', age: 30 },
	{ name: 'Bob', email: 'bob@mail.com', age: 25 },
	{ name: 'Charlie', email: 'charlie@mail.com', age: 35 }
]);

// Delete many by keys
await db.users.deleteMany([1, 2, 3]);

// Put many (upsert)
await db.users.putMany(updatedUsers);
```

---

## Key-Value Mode (Tier 3)

Simplified API for settings-like stores.

```typescript
const db = createDB({
	name: 'my-app',
	version: 1,
	stores: {
		kv: { keyPath: 'key', autoIncrement: false }
	}
});

// Simple get/set (like localStorage but async)
await db.kv.set('theme', 'dark');
const theme = await db.kv.val('theme'); // 'dark'

// Reactive
const themeVal = db.kv.liveVal('theme');
// themeVal.current === 'dark'
```

---

## Export / Import (Tier 4)

```typescript
// Export entire database to JSON
const backup = await db.export();
// { version: 1, stores: { users: [...], settings: [...] } }

// Import from JSON (replaces all data)
await db.import(backup);

// Export a single store
const usersBackup = await db.users.export();
```

---

## Error Types

```typescript
import { IDBError, IDBNotFoundError, IDBConstraintError } from 'svelte-idb';

try {
	await db.users.add({ id: 1, name: 'Duplicate' });
} catch (e) {
	if (e instanceof IDBConstraintError) {
		console.error('Duplicate key:', e.key);
	}
}
```

| Error Class          | When Thrown                     |
| -------------------- | ------------------------------- |
| `IDBError`           | Base class for all errors       |
| `IDBNotFoundError`   | Store or index doesn't exist    |
| `IDBConstraintError` | Unique constraint violation     |
| `IDBVersionError`    | Version mismatch during upgrade |
| `IDBAbortError`      | Transaction was aborted         |
| `IDBTimeoutError`    | Operation timed out             |

---

## Utility Types

```typescript
/** Record with a guaranteed key (after insert) */
type WithId<T, K extends keyof T = 'id'> = T & Required<Pick<T, K>>;

/** Record without the key field (before insert) */
type WithoutId<T, K extends keyof T = 'id'> = Omit<T, K>;

// Usage:
type NewUser = WithoutId<User>; // { name: string; email: string; age: number }
type SavedUser = WithId<User>; // { id: number; name: string; email: string; age: number }
```

---

**← [05 SvelteKit Packaging](./05-sveltekit-packaging.md)** | **[Next → 07 Architecture](./07-architecture.md)**
