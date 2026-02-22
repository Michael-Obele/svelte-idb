/**
 * svelte-idb — Main Entry Point (Core)
 *
 * import { createDB, type DBSchema, ... } from 'svelte-idb';
 */

// ─── Core API ─────────────────────────────────────────────────
export { createDB } from './core/database.js';

// ─── Types ────────────────────────────────────────────────────
export type {
	DBSchema,
	StoreConfig,
	IndexConfig,
	DatabaseConfig,
	Database,
	IStore,
	SSRStrategy,
	ChangeEvent,
	ChangeType,
	ChangeSubscriber,
	ILiveQuery,
	WithId,
	WithoutId
} from './core/types.js';

// ─── Errors ───────────────────────────────────────────────────
export {
	IDBError,
	IDBNotFoundError,
	IDBConstraintError,
	IDBVersionError,
	IDBAbortError,
	IDBTimeoutError
} from './core/errors.js';

// ─── Utilities ────────────────────────────────────────────────
export { prepareForInsert } from './utils/prepare-value.js';
export { isBrowser } from './utils/ssr.js';
