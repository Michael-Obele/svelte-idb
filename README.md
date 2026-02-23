<div align="center">
  <h1>🗄️ svelte-idb</h1>
  <p><strong>Zero-dependency, SSR-safe, Svelte 5 runes-native IndexedDB wrapper</strong></p>
  
  [![npm version](https://badge.fury.io/js/svelte-idb.svg)](https://badge.fury.io/js/svelte-idb)
  [![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)](https://opensource.org/licenses/MIT)
</div>

<br />

`svelte-idb` bridges the gap between the imperative, asynchronous nature of IndexedDB and the synchronous, declarative world of Svelte 5. It provides a frictionless developer experience with fully typed schemas and automatic UI updates powered by `$state` runes.

## ✨ Features

- **⚡️ Svelte 5 Native:** Built from the ground up using `$state` runes for seamless, glitch-free reactivity.
- **🛡️ SSR Safe:** Safely use it in SvelteKit SSR environments (`+page.server.ts` or `+layout.ts`). Automatically no-ops or throws based on your config.
- **🎈 Zero Dependencies:** Extremely lightweight. No external libraries, just pure modern browser APIs.
- **🏷️ Fully Typed:** First-class TypeScript support. Define your schema once and enjoy autocomplete everywhere.
- **🔄 Live Queries:** Never manually re-fetch data. Mutations (`add`, `put`, `delete`) automatically trigger microtask-batched DOM updates.

---

## 📦 Installation

```bash
npm install svelte-idb
# or
bun add svelte-idb
# or
pnpm add svelte-idb
```

## 🚀 Quick Start

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
  <input bind:value={text} placeholder="New todo..." />
  <button onclick={addTodo}>Add</button>
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

---

## 🛠️ Advanced

### Secondary Indexes
You can define secondary indexes in your schema to enable querying by properties other than the primary key. *(Note: Reactive `liveQueryByIndex` is coming in Phase 3!)*

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
```

### SSR Safety
Because `svelte-idb` is designed for SvelteKit, rendering on the server (SSR) will safely "no-op" by default instead of crashing with `window is not defined`. 
- `liveAll().current` will cleanly return an empty array `[]` on the server.
- `loading` will be `false` during SSR so skeleton loaders aren't triggered server-side.
- Once the component mounts in the browser, the real IndexedDB connection is established and data hydrates automatically.

---

## 📄 License
MIT © Michael Obele
