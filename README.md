<div align="center">
  <img src="./static/favicon-database.svg" width="128" height="128" alt="svelte-idb logo" />
  <h1>svelte-idb</h1>
  <p><strong>Zero-dependency, SSR-safe, Svelte 5 runes-native IndexedDB wrapper</strong></p>

  <p>
    <a href="https://www.npmjs.com/package/svelte-idb">
      <img src="https://img.shields.io/npm/v/svelte-idb?style=flat-square&color=ff3e00&label=npm" alt="npm version" />
    </a>
    <!-- <a href="https://bundlephobia.com/package/svelte-idb">
      <img src="https://img.shields.io/bundlephobia/minzip/svelte-idb?style=flat-square&color=33b5e5&label=minzipped" alt="bundle size" />
    </a> -->
    <a href="https://www.npmjs.com/package/svelte-idb">
      <img src="https://img.shields.io/npm/dm/svelte-idb?style=flat-square&color=cb3837&label=downloads" alt="downloads" />
    </a>
    <a href="https://github.com/Michael-Obele/svelte-idb">
      <img src="https://img.shields.io/github/stars/Michael-Obele/svelte-idb?style=flat-square&color=ffd700" alt="github stars" />
    </a>
    <a href="https://svelte.dev">
      <img src="https://img.shields.io/badge/svelte-%5E5.0.0-ff3e00?style=flat-square&logo=svelte" alt="svelte compatibility" />
    </a>
    <a href="https://github.com/Michael-Obele/svelte-idb/blob/master/LICENSE">
      <img src="https://img.shields.io/github/license/Michael-Obele/svelte-idb?style=flat-square&color=purple" alt="license" />
    </a>
  </p>
</div>

<br />

`svelte-idb` bridges the gap between the imperative, asynchronous nature of IndexedDB and the synchronous, declarative world of Svelte 5. It provides a frictionless developer experience with fully typed schemas and automatic UI updates powered by `$state` runes.

## ✨ Features

- **⚡️ Svelte 5 Runes Native:** Built from the ground up using `$state` and `$derived` for seamless, glitch-free reactivity.
- **🛡️ SSR Safe By Design:** Safely use it in SvelteKit SSR environments. Automatically no-ops or uses safe defaults on the server.
- **🎈 Tiny & Zero-Dependency:** Less than 2KB minzipped. No external libraries, just pure modern browser APIs.
- **🏷️ First-Class TypeScript:** Define your schema once and enjoy type-safe queries, stores, and autocomplete everywhere.
- **🔄 Automatic Live Queries:** Mutations (`add`, `put`, `delete`, `clear`) automatically trigger microtask-batched reactivity for optimal performance.
- **🗂️ Indexed Query Builder (MVP):** Query secondary indexes with `where(index).equals(value)` plus range operators like `between`, `above`, and `below`.
- **🧩 Dual Exports:** Clean Separation between core logic and Svelte-specific reactive hooks.

---

## 📦 Installation

```bash
bun add svelte-idb
# or
npm install svelte-idb
# or
pnpm add svelte-idb
```

## 🚀 Quick Start

For detailed step-by-step guides and examples, visit the [documentation site](https://idb.svelte-apps.me/docs/quick-start).

### 1. Define your Database

Use `createReactiveDB` to define your schema, stores, and configuration. Do this in a shared file like `src/lib/db.ts`.

```typescript
// src/lib/db.ts
import { createReactiveDB } from 'svelte-idb/svelte';

export interface Todo {
  id?: number;
  text: string;
  done: boolean;
  createdAt: number;
}

export const db = createReactiveDB({
  name: 'my-app-db',
  version: 1,
  stores: {
    todos: {
      keyPath: 'id',
      autoIncrement: true, // Auto-generates IDs for new records
    }
  }
});
```

### 2. Use Live Queries in your Components

Use the `.liveAll()`, `.liveGet()`, or `.liveCount()` methods. The `.current` property holds the reactive state and will automatically update whenever the underlying store changes.

```html
<!-- src/routes/+page.svelte -->
<script lang="ts">
	import { db } from '$lib/db';

	// 1. Create a live query
	// This automatically fetches data and reacts to any changes
	const todos = db.todos.liveAll();

	let text = $state('');

	async function addTodo() {
		// 2. Mutate the database
		// The `todos` query will automatically re-run and update the UI!
		await db.todos.add({ text, done: false, createdAt: Date.now() });
		text = '';
	}
</script>

<div>
	<input bind:value="{text}" placeholder="New todo..." />
	<button onclick="{addTodo}">Add</button>
</div>

<!-- 3. Consume the reactive state -->
{#if todos.loading}
<p>Loading...</p>
{:else if todos.error}
<p>Error: {todos.error.message}</p>
{:else}
<ul>
	{#each todos.current as todo (todo.id)}
	<li>{todo.text}</li>
	{/each}
</ul>
{/if}
```

---

## 📚 API Reference

For a complete interactive API reference, visit [idb.svelte-apps.me/docs](https://idb.svelte-apps.me/docs).

### `createReactiveDB(config)`

Creates and provisions an IndexedDB instance. Returns an object where each store is available as a property.

**Configuration Options:**

- `name` (string): The database name. Must be unique per origin.
- `version` (number): The schema version. Increment this whenever you change the `stores` object.
- `stores` (object): Map of store names to their definitions (`keyPath`, `autoIncrement`).
- `ssr` (string | function): How to handle SSR. Defaults to `'noop'`. Can be `'throw'` or a custom handler function.

### Reactive Store Methods (`db.storeName.*`)

These methods return a `LiveQuery` object containing reactive `$state` fields: `current`, `loading`, and `error`.

| Method             | Description                                            | Return Type                 |
| :----------------- | :----------------------------------------------------- | :-------------------------- |
| **`liveAll()`**    | Reactively lists all records in the store.             | `LiveQuery<T[]>`            |
| **`liveGet(key)`** | Reactively fetches a single record by its primary key. | `LiveQuery<T \| undefined>` |
| **`liveCount()`**  | Reactively tracks the total number of records.         | `LiveQuery<number>`         |

### Standard Store Methods (`db.storeName.*`)

All standard mutations automatically notify active LiveQueries to trigger Svelte updates. They return Promises.

| Method            | Description                                            |
| :---------------- | :----------------------------------------------------- |
| **`add(value)`**  | Inserts a new record. Fails if the key already exists. |
| **`put(value)`**  | Inserts or updates a record (upsert).                  |
| **`delete(key)`** | Removes a record by primary key.                       |
| **`clear()`**     | Removes all records from the store.                    |
| **`get(key)`**    | Fetches a single record (non-reactive).                |
| **`getAll()`**    | Fetches all records (non-reactive).                    |
| **`where(index)`** | Starts an indexed query builder (non-reactive MVP).   |

### Query Builder Methods (`db.storeName.where(indexName).*`)

The current query builder is a core-only MVP for secondary index reads.

| Method                    | Description                                              |
| :------------------------ | :------------------------------------------------------- |
| **`equals(value)`**       | Matches records with an exact index value.               |
| **`between(a, b)`**       | Matches records within an inclusive range by default.    |
| **`above(value)`**        | Matches records strictly greater than the value.         |
| **`aboveOrEqual(value)`** | Matches records greater than or equal to the value.      |
| **`below(value)`**        | Matches records strictly less than the value.            |
| **`belowOrEqual(value)`** | Matches records less than or equal to the value.         |
| **`toArray()`**           | Returns all matching records.                            |
| **`first()`**             | Returns the first matching record in index order.        |
| **`count()`**             | Returns the count of matching records.                   |

---

## 🛠️ Advanced

### Secondary Indexes

You can define secondary indexes in your schema to enable querying by properties other than the primary key.

```typescript
const db = createReactiveDB({
  name: 'my-app-db',
  version: 1,
  stores: {
    users: {
      keyPath: 'id',
      indexes: {
        byEmail: { keyPath: 'email', unique: true },
        byAge: { keyPath: 'age' }
      }
    }
  }
});

// Query using the standard async method
const adults = await db.users.getAllFromIndex('byAge', IDBKeyRange.lowerBound(18));

// Query using the query builder MVP
const adultsViaBuilder = await db.users.where('byAge').aboveOrEqual(18).toArray();
```

_(Note: Reactive indexed queries are still planned. The current query builder is core-only.)_

### SSR Safety

Because `svelte-idb` is designed for SvelteKit, rendering on the server (SSR) will safely "no-op" by default instead of crashing with `window is not defined`.

- `liveAll().current` will cleanly return an empty array `[]` on the server.
- `loading` will be `false` during SSR so skeleton loaders aren't triggered server-side.
- Once the component mounts in the browser, the real IndexedDB connection is established and data hydrates automatically.

---

## 🧪 Testing

The project uses Vitest Browser Mode with Playwright for real browser IndexedDB coverage.

```bash
bun install
bunx playwright install chromium
bun run test:browser
```

For continuous validation, the CI workflow runs:

- `bun run check`
- `bun run package`
- `bun run test:browser`

---

## 🔮 Roadmap

- [ ] **Reactive Indexed Queries:** Extend indexed queries into the Svelte reactive layer.
- [ ] **Advanced Query Builder:** Add richer operators and collection-style pipelines.
- [ ] **Transactions:** Multi-store atomic operations with auto-rollback.
- [ ] **Bulk Operations:** `addMany`, `putMany`, and `deleteMany`.
- [ ] **Cross-tab Sync:** Automatic reactivity across different browser tabs using `BroadcastChannel`.
- [ ] **Migration Sugar:** Simplified API for adding columns or renaming stores.

## 📄 License

MIT © [Michael Obele](https://github.com/Michael-Obele)
