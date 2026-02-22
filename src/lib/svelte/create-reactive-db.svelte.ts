/**
 * svelte-idb — createReactiveDB()
 *
 * Wraps createDB() to return a database where every store
 * is a ReactiveStore with liveAll(), liveGet(), liveCount().
 *
 * Must live in a .svelte.ts file for runes compilation.
 */

import type { DBSchema, DatabaseConfig, ILiveQuery } from '../core/types.js';
import type { ChangeNotifier } from '../core/change-notifier.js';
import { createDB } from '../core/database.js';
import { ReactiveStore } from './reactive-store.svelte.js';
import { LiveQuery } from './live-query.svelte.js';

/** A database where every store supports reactive live queries. */
export type ReactiveDatabase<TSchema extends DBSchema> = {
	[K in keyof TSchema]: ReactiveStore<Record<string, unknown>>;
} & {
	getRawDB(): Promise<IDBDatabase>;
	close(): Promise<void>;
	/** Custom reactive query across multiple stores. */
	liveQuery<T>(queryFn: () => Promise<T>, storeNames: string[]): ILiveQuery<T>;
};

/**
 * Creates a reactive database with live query support on every store.
 *
 * @example
 * ```ts
 * import { createReactiveDB } from 'svelte-idb/svelte';
 *
 * const db = createReactiveDB({
 *   name: 'my-app',
 *   version: 1,
 *   stores: {
 *     users: { keyPath: 'id', autoIncrement: true }
 *   }
 * });
 *
 * const users = db.users.liveAll();
 * // users.current auto-updates when data changes
 * ```
 */
export function createReactiveDB<TSchema extends DBSchema>(
	config: DatabaseConfig<TSchema>
): ReactiveDatabase<TSchema> {
	const rawDB = createDB(config);

	// Extract the internal notifier
	const notifier = (rawDB as unknown as { __notifier: ChangeNotifier }).__notifier;

	const reactiveStores: Record<string, ReactiveStore<unknown>> = {};

	for (const name of Object.keys(config.stores)) {
		const coreStore = (rawDB as unknown as Record<string, unknown>)[name] as {
			storeName: string;
			add: (v: unknown) => Promise<IDBValidKey>;
			put: (v: unknown) => Promise<IDBValidKey>;
			get: (k: IDBValidKey) => Promise<unknown>;
			getAll: () => Promise<unknown[]>;
			getAllFromIndex: (i: string, q?: IDBValidKey | IDBKeyRange, c?: number) => Promise<unknown[]>;
			delete: (k: IDBValidKey) => Promise<void>;
			clear: () => Promise<void>;
			count: () => Promise<number>;
		};

		reactiveStores[name] = new ReactiveStore(coreStore, notifier);
	}

	const database = {
		getRawDB: () => rawDB.getRawDB(),
		close: () => rawDB.close(),
		liveQuery<T>(queryFn: () => Promise<T>, storeNames: string[]): ILiveQuery<T> {
			return new LiveQuery<T>(queryFn, storeNames, notifier, undefined as T);
		}
	};

	return Object.assign(database, reactiveStores) as unknown as ReactiveDatabase<TSchema>;
}
