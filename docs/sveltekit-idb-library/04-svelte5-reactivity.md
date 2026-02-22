# 04 — Svelte 5 Reactivity

> How to build live queries and reactive IndexedDB state with `$state`, `$derived`, and `$effect`.

**← [03 Feature Spec](./03-feature-spec.md)** | **[Next → 05 SvelteKit Packaging](./05-sveltekit-packaging.md)**

---

## The Problem

IndexedDB is **asynchronous and imperative**. Svelte 5 is **synchronous and declarative**. Bridging this gap is the library's core value proposition.

### Without `svelte-idb`

```svelte
<script lang="ts">
	import { db } from '$lib/db/db';

	let invoices = $state<Invoice[]>([]);

	// Manual fetch
	async function loadInvoices() {
		invoices = await db.invoices.getAll();
	}

	// Must remember to re-fetch after every mutation
	async function addInvoice(inv: Invoice) {
		await db.invoices.add(inv);
		await loadInvoices(); // Easy to forget!
	}

	$effect(() => {
		loadInvoices();
	});
</script>
```

### With `svelte-idb`

```svelte
<script lang="ts">
	import { db } from './db';

	// Auto-updates when data changes — anywhere in the app
	const invoices = db.invoices.liveAll();

	async function addInvoice(inv: Invoice) {
		await db.invoices.add(inv);
		// No manual re-fetch needed. `invoices` updates automatically.
	}
</script>

{#each invoices.current as invoice}
	<p>{invoice.number}</p>
{/each}
```

---

## Architecture: The Reactivity Bridge

```
┌──────────────────────────────────────────────────────┐
│                   Svelte Component                    │
│                                                      │
│  const items = db.store.liveAll()                    │
│                     │                                 │
│                     ▼                                 │
│  ┌─────────────────────────────────┐                 │
│  │  LiveQuery<T>                   │                 │
│  │  ├── .current  → $state(T[])   │  ← reads here   │
│  │  ├── .loading  → $state(bool)  │                 │
│  │  └── .error    → $state(Error) │                 │
│  └──────────────┬──────────────────┘                 │
│                 │ subscribes to                       │
│                 ▼                                     │
│  ┌─────────────────────────────────┐                 │
│  │  ChangeNotifier (per store)     │                 │
│  │  ├── subscribers: Set<callback> │                 │
│  │  └── notify()                   │  ← writes here  │
│  └──────────────┬──────────────────┘                 │
│                 │ triggered by                       │
│                 ▼                                     │
│  ┌─────────────────────────────────┐                 │
│  │  Store.add / put / delete / clr │                 │
│  │  (every mutation notifies)      │                 │
│  └─────────────────────────────────┘                 │
└──────────────────────────────────────────────────────┘
```

---

## Core Primitive: `LiveQuery<T>`

The central reactive container. Wraps an async query function and keeps its result up to date.

### Internal Implementation Sketch

```typescript
class LiveQuery<T> {
	current = $state<T>(initialValue);
	loading = $state(true);
	error = $state<Error | null>(null);

	private queryFn: () => Promise<T>;
	private stores: string[]; // Which stores to watch
	private unsubscribers: (() => void)[] = [];

	constructor(queryFn: () => Promise<T>, stores: string[], initialValue: T) {
		this.queryFn = queryFn;
		this.stores = stores;

		// Subscribe to change notifications for each store
		for (const storeName of this.stores) {
			const unsub = changeNotifier.subscribe(storeName, () => {
				this.requery();
			});
			this.unsubscribers.push(unsub);
		}

		// Initial query
		this.requery();
	}

	private async requery() {
		try {
			this.loading = true;
			this.current = await this.queryFn();
			this.error = null;
		} catch (e) {
			this.error = e instanceof Error ? e : new Error(String(e));
		} finally {
			this.loading = false;
		}
	}

	destroy() {
		for (const unsub of this.unsubscribers) unsub();
	}
}
```

### Key Design: `$state` Inside a Class

Svelte 5 supports `$state` inside class fields when compiled as a `.svelte.ts` file. This means the `LiveQuery` class must live in a `.svelte.ts` file to get runes compilation.

```
src/lib/
├── core/
│   ├── store.ts          ← Pure TypeScript (no runes)
│   └── change-notifier.ts
└── svelte/
    ├── live-query.svelte.ts  ← Runes-compiled
    ├── live-get.svelte.ts
    └── index.ts
```

---

## Change Notification System

### How Mutations Trigger Re-Queries

Every mutating operation on a `Store` emits a notification:

```typescript
class Store<T> {
	private notifier: ChangeNotifier;

	async add(value: T): Promise<IDBValidKey> {
		const key = await this._rawAdd(value);
		this.notifier.notify(this.storeName, { type: 'add', key });
		return key;
	}

	async put(value: T): Promise<IDBValidKey> {
		const key = await this._rawPut(value);
		this.notifier.notify(this.storeName, { type: 'put', key });
		return key;
	}

	async delete(key: IDBValidKey): Promise<void> {
		await this._rawDelete(key);
		this.notifier.notify(this.storeName, { type: 'delete', key });
	}

	async clear(): Promise<void> {
		await this._rawClear();
		this.notifier.notify(this.storeName, { type: 'clear' });
	}
}
```

### `ChangeNotifier` Implementation

```typescript
type ChangeEvent = {
	type: 'add' | 'put' | 'delete' | 'clear';
	key?: IDBValidKey;
};

type Subscriber = (event: ChangeEvent) => void;

class ChangeNotifier {
	private subscribers = new Map<string, Set<Subscriber>>();

	subscribe(storeName: string, callback: Subscriber): () => void {
		if (!this.subscribers.has(storeName)) {
			this.subscribers.set(storeName, new Set());
		}
		const subs = this.subscribers.get(storeName)!;
		subs.add(callback);

		// Return unsubscribe function
		return () => subs.delete(callback);
	}

	notify(storeName: string, event: ChangeEvent) {
		const subs = this.subscribers.get(storeName);
		if (subs) {
			for (const callback of subs) {
				callback(event);
			}
		}
	}
}
```

---

## Live Query API Surface

### `liveAll()` — Reactive Collection

```typescript
// Returns all records, reactively updated
const items = db.invoices.liveAll();

// In template:
// {#each items.current as item}
```

### `liveGet(key)` — Reactive Single Record

```typescript
// Returns a single record by key, reactively updated
const invoice = db.invoices.liveGet(invoiceId);

// In template:
// {#if invoice.current}
//   <h1>{invoice.current.number}</h1>
// {/if}
```

### `liveQuery(fn)` — Custom Reactive Query

```typescript
// Full control: any async function that reads from IndexedDB
const paidInvoices = db.liveQuery(
	() => db.invoices.getAllFromIndex('status', 'paid'),
	['invoices'] // Which stores to watch
);
```

### `liveCount()` — Reactive Count

```typescript
const totalInvoices = db.invoices.liveCount();

// In template:
// <span>{totalInvoices.current} invoices</span>
```

---

## Debouncing & Batching

### Problem: Rapid Mutations

If a user imports 100 records, we don't want 100 re-queries:

```typescript
await db.invoices.add(inv1); // triggers re-query
await db.invoices.add(inv2); // triggers re-query
await db.invoices.add(inv3); // triggers re-query
// ... 97 more re-queries
```

### Solution: Microtask Batching

Notifications are deferred to the next microtask, then deduplicated:

```typescript
class ChangeNotifier {
	private pendingStores = new Set<string>();
	private scheduled = false;

	notify(storeName: string, event: ChangeEvent) {
		this.pendingStores.add(storeName);

		if (!this.scheduled) {
			this.scheduled = true;
			queueMicrotask(() => {
				this.flush();
			});
		}
	}

	private flush() {
		const stores = new Set(this.pendingStores);
		this.pendingStores.clear();
		this.scheduled = false;

		for (const storeName of stores) {
			const subs = this.subscribers.get(storeName);
			if (subs) {
				for (const callback of subs) {
					callback({ type: 'batch' });
				}
			}
		}
	}
}
```

This ensures that even `addMany([...100 items])` triggers only **one** re-query.

---

## Cross-Tab Reactivity (Stretch Goal)

IndexedDB is shared across tabs. Dexie handles this via `BroadcastChannel`. We can too:

```typescript
// Optional: Enable cross-tab sync
const db = createDB({
	// ...
	crossTab: true // Uses BroadcastChannel API
});
```

When `crossTab` is enabled:

1. After any mutation, broadcast the change event via `BroadcastChannel`
2. Other tabs receive the event and re-query affected live queries

This is a Tier 3/4 feature but architecturally we should plan for it from the start by keeping the `ChangeNotifier` decoupled.

---

## SSR Behavior for Reactive Queries

On the server, `liveQuery()` and friends must return immediately with safe defaults:

```typescript
class LiveQuery<T> {
	constructor(/* ... */) {
		if (!browser) {
			// SSR: return initial value, never subscribe
			this.current = initialValue;
			this.loading = false;
			return;
		}
		// Browser: normal reactive behavior
	}
}
```

This ensures that SSR-rendered HTML shows a loading state or empty state, and hydration picks up the live query client-side.

---

## Comparison with Dexie's Approach

| Aspect          | Dexie `liveQuery()`                    | Our `liveQuery()`                 |
| --------------- | -------------------------------------- | --------------------------------- |
| **Reactivity**  | Returns an Observable                  | Returns `$state`-backed object    |
| **Framework**   | Framework-agnostic (needs adapter)     | Svelte 5 native                   |
| **Detection**   | Binary range tree intercepts IDB calls | Store-level pub/sub               |
| **Precision**   | Can detect if specific keys changed    | Re-queries entire store (simpler) |
| **Bundle cost** | ~25KB (entire Dexie)                   | ~1KB (reactive layer only)        |
| **Cross-tab**   | Via `Dexie.Observable` addon           | Via `BroadcastChannel` (optional) |

Our approach trades fine-grained precision for simplicity. For most apps (< 10K records per store), re-querying the entire store on change is fast enough. For larger datasets, the query builder (Tier 3) can optimize this.

---

**← [03 Feature Spec](./03-feature-spec.md)** | **[Next → 05 SvelteKit Packaging](./05-sveltekit-packaging.md)**
