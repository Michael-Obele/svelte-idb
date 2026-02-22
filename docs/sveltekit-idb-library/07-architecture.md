# 07 — Architecture

> Internal architecture, module structure, and dependency graph.

**← [06 API Design](./06-api-design.md)** | **[Next → 08 Implementation Roadmap](./08-implementation-roadmap.md)**

---

## Module Dependency Graph

```
                    ┌──────────────────┐
                    │   Consumer App    │
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
    ┌─────────────┐  ┌─────────────┐  ┌──────────┐
    │ svelte-idb  │  │ svelte-idb/ │  │  Types   │
    │  (core)     │  │   svelte    │  │  (.d.ts) │
    └──────┬──────┘  └──────┬──────┘  └──────────┘
           │                │
           │         ┌──────┴──────┐
           │         │  LiveQuery  │  ← .svelte.ts (runes)
           │         │  LiveGet    │
           │         │  LiveCount  │
           │         └──────┬──────┘
           │                │
           ▼                ▼
    ┌─────────────────────────────┐
    │        Core Engine          │
    │  ┌───────────────────────┐  │
    │  │  Database             │  │
    │  │  ├── Store<T>         │  │
    │  │  ├── ChangeNotifier   │  │
    │  │  ├── SchemaManager    │  │
    │  │  └── SSRGuard         │  │
    │  └───────────────────────┘  │
    └──────────────┬──────────────┘
                   │
                   ▼
    ┌─────────────────────────────┐
    │    Native IndexedDB API     │
    │    (browser built-in)       │
    └─────────────────────────────┘
```

---

## Layer Responsibilities

### Layer 1: Native IndexedDB API

The browser's built-in API. We never abstract it away entirely — power users can always access `db.getRawDB()`.

### Layer 2: Core Engine (Pure TypeScript)

Framework-agnostic. No Svelte imports. Could theoretically work with React, Vue, or vanilla JS.

| Module               | Responsibility                                                                    |
| -------------------- | --------------------------------------------------------------------------------- |
| `database.ts`        | `createDB()` factory — opens connection, applies schema, returns typed `Database` |
| `store.ts`           | `Store<T>` — CRUD operations with promise wrapping                                |
| `schema-manager.ts`  | Parses `StoreConfig` into `onupgradeneeded` imperative calls                      |
| `change-notifier.ts` | Pub/sub system for mutation events with microtask batching                        |
| `ssr-guard.ts`       | Detects server environment, applies SSR strategy                                  |
| `errors.ts`          | Typed error hierarchy wrapping `DOMException`                                     |
| `types.ts`           | Shared TypeScript type definitions                                                |
| `prepare-value.ts`   | Strips `undefined` keys for autoIncrement stores                                  |

### Layer 3: Svelte Reactive Layer (`.svelte.ts`)

Depends on Svelte 5 runes. Lives in `.svelte.ts` files so the Svelte compiler processes them.

| Module                 | Responsibility                                                |
| ---------------------- | ------------------------------------------------------------- |
| `live-query.svelte.ts` | `LiveQuery<T>` class with `$state`-backed reactive properties |
| `live-get.svelte.ts`   | `liveGet()` — reactive single-record observation              |
| `live-count.svelte.ts` | `liveCount()` — reactive count observation                    |

### Layer 4: Consumer App

The end user's SvelteKit application. Imports from `svelte-idb` and `svelte-idb/svelte`.

---

## File-Level Architecture

```
src/lib/
├── index.ts                      ← Re-exports core API
│   export { createDB } from './core/database'
│   export type { ... } from './core/types'
│
├── core/
│   ├── database.ts               ← 🏗️ createDB() factory
│   │   ├── Opens IDBDatabase connection
│   │   ├── Applies schema via SchemaManager
│   │   ├── Creates Store<T> instances
│   │   ├── Creates ChangeNotifier
│   │   └── Returns Database<TSchema> proxy
│   │
│   ├── store.ts                  ← 📦 Store<T> class
│   │   ├── add(value) → wraps IDBObjectStore.add()
│   │   ├── put(value) → wraps IDBObjectStore.put()
│   │   ├── get(key) → wraps IDBObjectStore.get()
│   │   ├── getAll() → wraps IDBObjectStore.getAll()
│   │   ├── getAllFromIndex() → wraps IDBIndex.getAll()
│   │   ├── delete(key) → wraps IDBObjectStore.delete()
│   │   ├── clear() → wraps IDBObjectStore.clear()
│   │   ├── count() → wraps IDBObjectStore.count()
│   │   └── Calls notifier.notify() after each mutation
│   │
│   ├── schema-manager.ts        ← 📐 Schema → IDB setup
│   │   ├── Parses StoreConfig objects
│   │   ├── Creates object stores in onupgradeneeded
│   │   ├── Creates/updates indexes
│   │   ├── Handles store existence checks
│   │   └── Calls onUpgrade callback for custom migration logic
│   │
│   ├── change-notifier.ts       ← 📢 Pub/sub with batching
│   │   ├── subscribe(storeName, callback) → unsubscribe fn
│   │   ├── notify(storeName, event) → queues to microtask
│   │   └── flush() → fires all pending notifications (deduplicated)
│   │
│   ├── ssr-guard.ts             ← 🛡️ SSR detection
│   │   ├── isBrowser() → boolean
│   │   ├── createSSRProxy() → returns no-op promises/values
│   │   └── Configurable: 'noop' | 'throw' | custom
│   │
│   ├── errors.ts                ← ❌ Typed error classes
│   │   ├── IDBError (base)
│   │   ├── IDBNotFoundError
│   │   ├── IDBConstraintError
│   │   ├── IDBVersionError
│   │   └── IDBAbortError
│   │
│   ├── prepare-value.ts         ← 🔧 Key preparation utility
│   │   └── prepareForInsert() → strips undefined key fields
│   │
│   └── types.ts                 ← 📝 Type definitions
│       ├── DBSchema, StoreConfig, IndexConfig
│       ├── DatabaseConfig
│       ├── Database<TSchema>
│       ├── Store<T>
│       ├── ChangeEvent
│       ├── WithId<T>, WithoutId<T>
│       └── LiveQuery<T>
│
└── svelte/
    ├── index.ts                  ← Re-exports Svelte-specific API
    │   export { LiveQuery } from './live-query.svelte'
    │
    ├── live-query.svelte.ts      ← 🔴 LiveQuery<T> class
    │   ├── current = $state(initialValue)
    │   ├── loading = $state(true)
    │   ├── error = $state(null)
    │   ├── Subscribes to ChangeNotifier
    │   ├── Re-queries on change
    │   └── SSR: returns initial value, no subscription
    │
    ├── live-get.svelte.ts        ← 🟢 Convenience wrapper
    │   └── LiveQuery specialized for single-record gets
    │
    └── live-count.svelte.ts      ← 🔵 Convenience wrapper
        └── LiveQuery specialized for count()
```

---

## Data Flow: Write Path

```
User Action
    │
    ▼
db.users.add({ name: 'Alice' })
    │
    ▼
Store.add()
    ├── 1. prepareValue() → strip undefined id
    ├── 2. Open IDB transaction (readwrite)
    ├── 3. objectStore.add(value)
    ├── 4. Await request.onsuccess
    ├── 5. notifier.notify('users', { type: 'add', key: 1 })
    │       └── Queued to microtask (batched)
    └── 6. Return key (1)

... microtask fires ...

ChangeNotifier.flush()
    │
    ├── LiveQuery A (watching 'users') → re-queries → updates $state
    ├── LiveQuery B (watching 'users') → re-queries → updates $state
    └── LiveQuery C (watching 'settings') → NOT affected, skipped
```

---

## Data Flow: Read Path (Reactive)

```
Component mounts
    │
    ▼
const users = db.users.liveAll()
    │
    ▼
LiveQuery constructor
    ├── 1. Set loading = true
    ├── 2. Subscribe to ChangeNotifier for 'users'
    ├── 3. Execute queryFn: db.users.getAll()
    ├── 4. On resolve: update current = $state(result), loading = false
    └── Return LiveQuery { current, loading, error }

Component renders
    │
    ▼
{#each users.current as user}
    ├── Svelte tracks $state dependency
    └── Re-renders automatically when current changes
```

---

## SSR Flow

```
Server-side render
    │
    ▼
createDB({ ssr: 'noop' })
    │
    ▼
SSRGuard detects !browser
    ├── Returns SSR proxy
    ├── db.users.getAll() → resolves to []
    ├── db.users.get(1) → resolves to undefined
    ├── db.users.add(val) → resolves to 0
    └── db.users.count() → resolves to 0

LiveQuery in SSR
    ├── current = initialValue ([] or undefined)
    ├── loading = false
    ├── No subscriptions created
    └── No IDB access attempted

Client hydration
    │
    ▼
Browser takes over
    ├── createDB() detects browser environment
    ├── Opens real IDB connection
    ├── LiveQuery subscribes + executes initial query
    └── Component re-renders with real data
```

---

## Size Budget

| Module                  | Target Size (min+gz) | Notes                   |
| ----------------------- | -------------------- | ----------------------- |
| Core (CRUD + schema)    | ~2KB                 | Must stay tiny          |
| SSR guard               | ~200B                | Just a few conditionals |
| Change notifier         | ~500B                | Simple pub/sub          |
| Errors                  | ~300B                | Class hierarchy         |
| **Core Total**          | **~3KB**             |                         |
| LiveQuery (svelte)      | ~800B                | $state + subscribe      |
| Helpers (liveGet, etc.) | ~200B                | Thin wrappers           |
| **Svelte Total**        | **~1KB**             |                         |
| **Full Library**        | **~4KB**             |                         |

For reference:

- `idb`: ~1.2KB brotli (core only, no reactivity)
- `Dexie`: ~25KB min+gz (everything included)
- Our target: ~4KB for full reactive IndexedDB

---

## Extension Points

### Middleware Hooks (Tier 3)

```typescript
const db = createDB({
	// ...
	hooks: {
		users: {
			beforeAdd: (value) => {
				// Add timestamps
				return { ...value, createdAt: new Date(), updatedAt: new Date() };
			},
			beforePut: (value) => {
				return { ...value, updatedAt: new Date() };
			},
			afterDelete: (key) => {
				console.log(`User ${key} deleted`);
			}
		}
	}
});
```

### Plugin System (Future)

```typescript
import { encryption } from 'svelte-idb/plugins/encryption';
import { sync } from 'svelte-idb/plugins/sync';

const db = createDB({
	// ...
	plugins: [
		encryption({ fields: ['ssn', 'creditCard'] }),
		sync({ endpoint: 'https://api.example.com/sync' })
	]
});
```

---

**← [06 API Design](./06-api-design.md)** | **[Next → 08 Implementation Roadmap](./08-implementation-roadmap.md)**
