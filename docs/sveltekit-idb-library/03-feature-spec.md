# 03 — Feature Specification

> Complete feature list, API surface, and design decisions for `svelte-idb`.

**← [02 Competitive Landscape](./02-competitive-landscape.md)** | **[Next → 04 Svelte 5 Reactivity](./04-svelte5-reactivity.md)**

---

## Feature Tiers

### 🟢 Tier 1 — MVP (v0.1)

These are non-negotiable for the first usable release.

| Feature                    | Description                                                           | Inspired By                                                                                    |
| -------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **`createDB()`**           | Factory function to define a typed database                           | Our [`db.native.ts`](https://github.com/Michael-Obele/tif/blob/master/src/lib/db/db.native.ts) |
| **Declarative Schema**     | Define stores, key paths, indexes via a config object                 | Our `SCHEMA` pattern                                                                           |
| **Generic `Store<T>`**     | Typed CRUD: `add`, `put`, `get`, `getAll`, `delete`, `clear`, `count` | Our `NativeStore<T>`                                                                           |
| **SSR Safety**             | Auto-detect server vs. browser; no-op on server without errors        | Our SSR guard                                                                                  |
| **Index Queries**          | `getAllFromIndex()` with key range support                            | Our implementation                                                                             |
| **AutoIncrement Handling** | Automatically strip `undefined` key fields before insert              | Our `prepareValue()`                                                                           |
| **Version Migrations**     | Schema versioning with `onupgradeneeded` handler                      | Our migration pattern                                                                          |
| **TypeScript-First**       | Full generic inference — schema defines the types                     | `idb`'s `DBSchema`                                                                             |

### 🟡 Tier 2 — Reactivity (v0.2)

The killer differentiator — live queries via Svelte 5 runes.

| Feature                      | Description                                                                  | Inspired By             |
| ---------------------------- | ---------------------------------------------------------------------------- | ----------------------- |
| **`liveQuery()`**            | Returns a `$state`-backed reactive value that auto-updates when data changes | Dexie's `liveQuery()`   |
| **`liveGet()`**              | Reactive single-record fetch by key                                          | Novel                   |
| **`liveCount()`**            | Reactive record count                                                        | Novel                   |
| **Change Notifications**     | Internal pub/sub that fires when any store is mutated                        | Dexie's change tracking |
| **Mutation Invalidation**    | After `add`/`put`/`delete`/`clear`, re-run affected live queries             | Dexie's range tree      |
| **Svelte Component Helpers** | Optional `<IDBProvider>` context component                                   | SignalDB's pattern      |

### 🔵 Tier 3 — DX Polish (v0.3)

Developer experience improvements that make the library a joy to use.

| Feature              | Description                                                          | Inspired By             |
| -------------------- | -------------------------------------------------------------------- | ----------------------- |
| **Query Builder**    | Chainable: `db.invoices.where('status').equals('paid').toArray()`    | Dexie                   |
| **Transactions**     | `db.transaction(['invoices', 'clients'], async (tx) => { ... })`     | `idb` / Dexie           |
| **Cursor Iteration** | `for await (const record of db.invoices.iterate())`                  | `idb`'s async iterators |
| **Typed Errors**     | `IDBNotFoundError`, `IDBConstraintError`, etc. with context          | Novel                   |
| **Middleware Hooks** | `onCreate`, `onUpdate`, `onDelete` per-store event hooks             | Dexie's middleware      |
| **Key-Value Mode**   | `db.kv.get('theme')` / `db.kv.set('theme', 'dark')` — simplified API | `idb-keyval`            |

### 🟣 Tier 4 — Advanced (v1.0)

Features for production-grade applications.

| Feature                  | Description                                                      | Inspired By           |
| ------------------------ | ---------------------------------------------------------------- | --------------------- |
| **Bulk Operations**      | `addMany()`, `putMany()`, `deleteMany()` with single transaction | Dexie                 |
| **Pagination**           | `getPage(offset, limit)` and cursor-based pagination             | Novel                 |
| **Migration Helpers**    | `addColumn()`, `removeColumn()`, `renameStore()` sugar           | Prisma Migrate        |
| **Export/Import**        | `db.export()` → JSON, `db.import(json)` for backup/restore       | Novel                 |
| **Encryption Plugin**    | Optional AES encryption for sensitive fields                     | Novel                 |
| **Debug Mode**           | Console logging with `[svelte-idb]` prefix, toggleable           | Our `[NativeDB]` logs |
| **DevTools Integration** | Browser extension or panel for inspecting stores                 | Dexie DevTools        |

---

## Design Decisions

### Decision 1: Factory Function vs. Class

**Choice: Factory function `createDB()`**

```typescript
// ✓ Factory function — composable, tree-shakeable
const db = createDB({ name: 'myapp', version: 1, stores: { ... } });

// ✗ Class — harder to tree-shake, less ergonomic
const db = new SvelteIDB({ name: 'myapp', version: 1, stores: { ... } });
```

**Rationale:** Factory functions are more idiomatic in the Svelte ecosystem (see `writable()`, `readable()`, `derived()`). They also enable better tree-shaking because unused code paths can be eliminated.

### Decision 2: Schema Definition Style

**Choice: Object literal with TypeScript generic inference**

```typescript
const db = createDB({
	name: 'myapp',
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
			keyPath: 'key',
			autoIncrement: false
		}
	}
});
```

**Rationale:** This mirrors our [`db.native.ts`](https://github.com/Michael-Obele/tif/blob/master/src/lib/db/db.native.ts) `SCHEMA` pattern but adds TypeScript generics so that `db.users` is automatically typed as `Store<User>`. Avoids Dexie's string-based schema (`"++id, name, age"`) which loses type information.

### Decision 3: SSR Behavior

**Choice: Configurable — default to silent no-op, option to throw**

```typescript
// Default: operations return undefined/empty on server (no crash)
const db = createDB({ ..., ssr: 'noop' });

// Strict: throw an error if DB is accessed on server
const db = createDB({ ..., ssr: 'throw' });

// Custom: provide your own handler
const db = createDB({ ..., ssr: (operation) => console.warn(`SSR: ${operation}`) });
```

**Rationale:** Our current implementation uses a never-resolving promise, which works but can cause subtle hangs if a load function accidentally awaits it. A no-op that returns `undefined`/`[]` is safer and more debuggable.

### Decision 4: Reactivity Model

**Choice: Store-level change tracking with selective re-query**

When a mutation occurs on a store:

1. The store emits a change event with the affected key(s)
2. All active `liveQuery()` subscriptions for that store check if they're affected
3. Affected queries re-execute and update their `$state` value

This is simpler than Dexie's binary range tree approach but covers 95% of real-world use cases.

See [04 — Svelte 5 Reactivity](./04-svelte5-reactivity.md) for the full design.

### Decision 5: Bundle Target

**Choice: ESM-only, no CommonJS**

```json
{
	"type": "module",
	"exports": {
		".": {
			"types": "./dist/index.d.ts",
			"svelte": "./dist/index.js",
			"default": "./dist/index.js"
		}
	}
}
```

**Rationale:** SvelteKit is ESM-only. The target audience exclusively uses modern bundlers. Shipping CJS adds complexity and bundle size for zero benefit.

### Decision 6: Framework Coupling

**Choice: Core is framework-agnostic, Svelte integration is a separate export**

```
svelte-idb/           → Core CRUD, schema, SSR safety (works anywhere)
svelte-idb/svelte     → liveQuery(), liveGet(), Svelte 5 runes integration
```

**Rationale:** The core IndexedDB wrapper has value outside Svelte. Keeping it separate allows:

- Using the core in vanilla JS/TS
- Future adapters for React, Vue, etc. (stretch goal)
- Smaller bundle for users who don't need reactivity

---

## Non-Goals (Explicitly Out of Scope)

| Feature                   | Why Not                                                     |
| ------------------------- | ----------------------------------------------------------- |
| **CouchDB/Cloud sync**    | Massive scope — use PouchDB or Dexie Cloud                  |
| **WebSQL fallback**       | WebSQL is deprecated and removed from all browsers          |
| **localStorage fallback** | Different API semantics; would complicate the core          |
| **Full-text search**      | IndexedDB doesn't support it natively; use a search library |
| **Relations/Joins**       | IndexedDB is a key-value store, not relational              |
| **Web Worker support**    | Future consideration but out of v1 scope                    |
| **React/Vue adapters**    | Svelte-first; other frameworks can use the core package     |

---

**← [02 Competitive Landscape](./02-competitive-landscape.md)** | **[Next → 04 Svelte 5 Reactivity](./04-svelte5-reactivity.md)**
