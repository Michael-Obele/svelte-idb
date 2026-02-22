/**
 * svelte-idb — Core Type Definitions
 *
 * All public and internal types for the library.
 * No runtime code — pure type declarations.
 */

// ─── Schema Definition Types ──────────────────────────────────

/** Configuration for a secondary index on an object store. */
export interface IndexConfig {
	/** Property path(s) to index. */
	keyPath: string | string[];
	/** Enforce unique values. */
	unique?: boolean;
	/** Index arrays of values (multiEntry). */
	multiEntry?: boolean;
}

/** Configuration for a single object store. */
export interface StoreConfig {
	/** Property name used as the primary key. */
	keyPath: string;
	/** Auto-generate numeric keys for new records. */
	autoIncrement?: boolean;
	/** Secondary indexes for querying. */
	indexes?: Record<string, IndexConfig>;
}

/** A schema is a map of store names to their configurations. */
export type DBSchema = Record<string, StoreConfig>;

// ─── Database Configuration ───────────────────────────────────

/** SSR behavior strategy. */
export type SSRStrategy = 'noop' | 'throw' | ((operation: string) => void);

/** Configuration passed to `createDB()`. */
export interface DatabaseConfig<TSchema extends DBSchema> {
	/** Database name (must be unique per origin). */
	name: string;
	/** Schema version — increment on every schema change. */
	version: number;
	/** Store definitions. */
	stores: TSchema;
	/** SSR behavior: 'noop' (default), 'throw', or custom handler. */
	ssr?: SSRStrategy;
	/** Migration function called during version upgrades. */
	onUpgrade?: (
		db: IDBDatabase,
		oldVersion: number,
		newVersion: number,
		transaction: IDBTransaction
	) => void;
	/** Called when another tab requests a version upgrade. */
	onBlocked?: () => void;
	/** Debug mode — logs all operations to console. */
	debug?: boolean;
}

// ─── Change Notification Types ────────────────────────────────

/** The type of mutation that occurred. */
export type ChangeType = 'add' | 'put' | 'delete' | 'clear' | 'batch';

/** Event emitted when a store is mutated. */
export interface ChangeEvent {
	type: ChangeType;
	key?: IDBValidKey;
}

/** A function that listens for change events. */
export type ChangeSubscriber = (event: ChangeEvent) => void;

// ─── Store Interface ──────────────────────────────────────────

/** Public interface for a typed object store. */
export interface IStore<T> {
	readonly storeName: string;
	add(value: T): Promise<IDBValidKey>;
	put(value: T): Promise<IDBValidKey>;
	get(key: IDBValidKey): Promise<T | undefined>;
	getAll(): Promise<T[]>;
	getAllFromIndex(
		indexName: string,
		query?: IDBValidKey | IDBKeyRange,
		count?: number
	): Promise<T[]>;
	delete(key: IDBValidKey): Promise<void>;
	clear(): Promise<void>;
	count(): Promise<number>;
}

// ─── Database Interface ───────────────────────────────────────

/** The returned database object — stores are accessed as properties. */
export type Database<TSchema extends DBSchema> = {
	[K in keyof TSchema]: IStore<Record<string, unknown>>;
} & {
	/** Access the raw IDBDatabase promise. */
	getRawDB(): Promise<IDBDatabase>;
	/** Close the database connection. */
	close(): Promise<void>;
};

// ─── Utility Types ────────────────────────────────────────────

/** Record with a guaranteed key (after insert). */
export type WithId<T, K extends keyof T = 'id' extends keyof T ? 'id' : never> = T &
	Required<Pick<T, K>>;

/** Record without the key field (before insert). */
export type WithoutId<T, K extends keyof T = 'id' extends keyof T ? 'id' : never> = Omit<T, K>;

// ─── LiveQuery Interface ──────────────────────────────────────

/** The shape returned by reactive query functions. */
export interface ILiveQuery<T> {
	/** The current query result (reactive via $state). */
	readonly current: T;
	/** Whether the query is currently executing. */
	readonly loading: boolean;
	/** The last error, if any. */
	readonly error: Error | null;
	/** Manually trigger a re-query. */
	refresh(): Promise<void>;
	/** Stop observing changes (cleanup). */
	destroy(): void;
}
