# 01 — Origin & Analysis

> Deep dive into [`src/lib/db/db.native.ts`](https://github.com/Michael-Obele/tif/blob/master/src/lib/db/db.native.ts) — the seed code for this library.

**← [README](./README.md)** | **[Next → 02 Competitive Landscape](./02-competitive-landscape.md)**

---

## Source File

**File:** [`src/lib/db/db.native.ts`](https://github.com/Michael-Obele/tif/blob/master/src/lib/db/db.native.ts) (308 lines, ~9KB)
**Re-export:** `src/lib/db/db.ts` — single-line barrel export

---

## What It Does

A hand-rolled, promise-based wrapper around the native IndexedDB Web API, purpose-built for the Tech Invoice Forge (TIF) application. Zero external dependencies.

### Class Structure

```
TechInvoiceForgeNativeDB (singleton)
├── dbPromise: Promise<IDBDatabase>    ← SSR-safe connection
├── senders: NativeStore<Sender>
├── clients: NativeStore<Client>
├── serviceItems: NativeStore<ServiceItem>
├── invoices: NativeStore<Invoice>
└── settings: NativeStore<AppSettings>
```

### `NativeStore<T>` — Generic CRUD Layer

| Method            | Signature                                           | Notes                               |
| ----------------- | --------------------------------------------------- | ----------------------------------- |
| `add`             | `(value: T) → Promise<IDBValidKey>`                 | Insert only; fails on duplicate key |
| `put`             | `(value: T) → Promise<IDBValidKey>`                 | Upsert — insert or update           |
| `get`             | `(key: number \| string) → Promise<T \| undefined>` | Single record by primary key        |
| `getAll`          | `() → Promise<T[]>`                                 | All records in the store            |
| `getAllFromIndex` | `(indexName, query?, count?) → Promise<T[]>`        | Query via secondary index           |
| `delete`          | `(key: number \| string) → Promise<void>`           | Remove by key                       |
| `clear`           | `() → Promise<void>`                                | Wipe entire store                   |
| `count`           | `() → Promise<number>`                              | Record count                        |

### Schema Definition (Declarative)

```typescript
const SCHEMA: Record<string, StoreSchema> = {
  senders:      { keyPath: 'id', autoIncrement: true, indexes: [...] },
  clients:      { keyPath: 'id', autoIncrement: true, indexes: [...] },
  serviceItems: { keyPath: 'id', autoIncrement: true },
  invoices:     { keyPath: 'id', autoIncrement: true, indexes: [...] },
  settings:     { keyPath: 'id', autoIncrement: false }
};
```

This is already a strong pattern — the schema is **data-driven**, not imperative. The library should adopt and extend this.

---

## Strengths (To Preserve)

| Strength                    | Detail                                                                   |
| --------------------------- | ------------------------------------------------------------------------ |
| **Zero dependencies**       | Only uses `$app/environment` for SSR detection                           |
| **SSR-safe**                | Never-resolving promise on server — operations simply hang without error |
| **Generic typed stores**    | `NativeStore<T>` gives per-store type safety                             |
| **Declarative schema**      | Schema is a plain object, easy to introspect and migrate                 |
| **Auto-increment handling** | `prepareValue()` strips `undefined` IDs before insert                    |
| **Version migration**       | `onupgradeneeded` handles store creation + data migration                |
| **Minimal footprint**       | ~3KB of source, compiles to very little                                  |

---

## Weaknesses (To Fix in Library)

| Weakness                   | Impact                                            | Library Solution                                  |
| -------------------------- | ------------------------------------------------- | ------------------------------------------------- |
| **No reactivity**          | Components must manually re-fetch after mutations | Live queries via `$state` / `$effect`             |
| **No transaction support** | Multi-store operations aren't atomic              | `db.transaction()` API                            |
| **No cursor iteration**    | Can't stream large datasets                       | `iterate()` with async generators                 |
| **No query builder**       | Only raw index queries                            | Composable `where().equals().toArray()`           |
| **App-specific schema**    | Hardcoded to TIF types                            | Generic schema definition via TypeScript generics |
| **No error recovery**      | Errors propagate as raw `DOMException`            | Typed error classes with context                  |
| **No event system**        | No hooks for middleware/plugins                   | `onCreate`, `onUpdate`, `onDelete` hooks          |
| **Singleton only**         | One global instance                               | Factory function `createDB()`                     |
| **SvelteKit coupling**     | Uses `$app/environment` directly                  | Framework-agnostic SSR detection                  |

---

## Patterns Worth Extracting

### 1. The `prepareValue` Pattern

```typescript
private prepareValue(value: T): T {
  const clone = { ...value } as any;
  if (clone.id === undefined) {
    delete clone.id;
  }
  return clone as T;
}
```

**Why it matters:** IndexedDB `autoIncrement` requires the key field to be absent, not `undefined`. This is a gotcha that no other library documents well.

### 2. The SSR Guard Pattern

```typescript
if (!browser) {
	this.dbPromise = new Promise(() => {}); // Never resolves
} else {
	this.dbPromise = this.openDatabase();
}
```

**Why it matters:** This is more elegant than throwing errors. Operations simply await forever on the server, meaning SSR code can reference the DB without crashes. The library should make this configurable.

### 3. Declarative Schema → Imperative DB Setup

The `SCHEMA` object is iterated in `onupgradeneeded` to create stores and indexes. This pattern can be generalized into a type-safe schema builder.

---

## Type Analysis

The types imported from `$lib/types` use **optional `id` fields** (`id?: number`):

```typescript
export interface Sender {
	id?: number;
	businessName: string;
	// ...
}
```

This is the correct pattern for IndexedDB with `autoIncrement`:

- **Before insert:** `id` is `undefined` (or absent)
- **After insert:** `id` is a `number`

The library should formalize this with `WithId<T>` and `WithoutId<T>` utility types.

---

## Lines of Code Breakdown

| Section                    | Lines   | Purpose                              |
| -------------------------- | ------- | ------------------------------------ |
| Imports + Config           | 1–13    | DB name, version, SvelteKit import   |
| Schema Definition          | 14–51   | Declarative schema object            |
| `NativeStore<T>`           | 57–202  | Generic CRUD class                   |
| `TechInvoiceForgeNativeDB` | 207–303 | DB class with connection + migration |
| Export                     | 306–307 | Singleton `db` instance              |

---

## Key Insight

The entire value of this file is that it **already solves the hard problems** (SSR safety, autoIncrement key handling, declarative schema, version migrations) in ~300 lines. The library's job is to:

1. Generalize these patterns (remove TIF-specific types)
2. Add reactivity (live queries with Svelte 5 runes)
3. Add developer ergonomics (query builder, typed errors, hooks)
4. Package it properly (`@sveltejs/package`)

---

**← [README](./README.md)** | **[Next → 02 Competitive Landscape](./02-competitive-landscape.md)**
