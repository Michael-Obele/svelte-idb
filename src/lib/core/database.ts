/**
 * svelte-idb — createDB() Factory
 *
 * The primary entry point for the library.
 * Opens an IndexedDB connection, applies schema, creates typed Store instances.
 */

import type { DBSchema, DatabaseConfig, Database, IStore } from './types.js';
import { Store } from './store.js';
import { ChangeNotifier } from './change-notifier.js';
import { applySchema } from './schema-manager.js';
import { isBrowser, handleSSR } from '../utils/ssr.js';
import { wrapIDBError } from './errors.js';

/**
 * Creates a typed IndexedDB database instance.
 *
 * @example
 * ```ts
 * const db = createDB({
 *   name: 'my-app',
 *   version: 1,
 *   stores: {
 *     users: { keyPath: 'id', autoIncrement: true }
 *   }
 * });
 *
 * await db.users.add({ name: 'Alice' });
 * ```
 */
export function createDB<TSchema extends DBSchema>(
	config: DatabaseConfig<TSchema>
): Database<TSchema> {
	const notifier = new ChangeNotifier();
	const debug = config.debug ?? false;

	// SSR: return a proxy that safely no-ops
	if (!isBrowser()) {
		return createSSRDatabase<TSchema>(config, notifier);
	}

	// Browser: open real connection
	const dbPromise = openDatabase(config, notifier);
	return createBrowserDatabase<TSchema>(config, dbPromise, notifier, debug);
}

// ─── Browser Database ─────────────────────────────────────────

function openDatabase<TSchema extends DBSchema>(
	config: DatabaseConfig<TSchema>,
	_notifier: ChangeNotifier
): Promise<IDBDatabase> {
	return new Promise<IDBDatabase>((resolve, reject) => {
		let request: IDBOpenDBRequest;

		try {
			request = indexedDB.open(config.name, config.version);
		} catch (error) {
			reject(wrapIDBError(error, 'openDatabase'));
			return;
		}

		request.onupgradeneeded = (event) => {
			const db = request.result;
			const tx = request.transaction!;

			// Apply declarative schema
			applySchema(db, tx, config);

			// Call custom migration if provided
			if (config.onUpgrade) {
				config.onUpgrade(db, event.oldVersion, event.newVersion ?? config.version, tx);
			}
		};

		request.onsuccess = () => {
			const db = request.result;

			// Handle blocked event (another tab needs upgrade)
			db.onversionchange = () => {
				db.close();
			};

			resolve(db);
		};

		request.onerror = () => reject(wrapIDBError(request.error, 'openDatabase'));

		request.onblocked = () => {
			if (config.onBlocked) {
				config.onBlocked();
			}
		};
	});
}

function createBrowserDatabase<TSchema extends DBSchema>(
	config: DatabaseConfig<TSchema>,
	dbPromise: Promise<IDBDatabase>,
	notifier: ChangeNotifier,
	debug: boolean
): Database<TSchema> {
	const stores: Record<string, Store<unknown>> = {};

	for (const [name, storeConfig] of Object.entries(config.stores)) {
		stores[name] = new Store(name, dbPromise, notifier, storeConfig, debug);
	}

	const database = {
		getRawDB: () => dbPromise,
		close: async () => {
			const db = await dbPromise;
			db.close();
		},
		// Expose the notifier for the reactive layer
		__notifier: notifier
	};

	// Merge stores onto the database object
	return Object.assign(database, stores) as unknown as Database<TSchema>;
}

// ─── SSR Database ─────────────────────────────────────────────

function createSSRDatabase<TSchema extends DBSchema>(
	config: DatabaseConfig<TSchema>,
	_notifier: ChangeNotifier
): Database<TSchema> {
	const ssrStore: IStore<unknown> = {
		storeName: '',
		add: () => Promise.resolve(handleSSR(config.ssr, 'add', 0 as IDBValidKey)),
		put: () => Promise.resolve(handleSSR(config.ssr, 'put', 0 as IDBValidKey)),
		get: () => Promise.resolve(handleSSR(config.ssr, 'get', undefined)),
		getAll: () => Promise.resolve(handleSSR(config.ssr, 'getAll', [])),
		getAllFromIndex: () => Promise.resolve(handleSSR(config.ssr, 'getAllFromIndex', [])),
		delete: () => Promise.resolve(handleSSR(config.ssr, 'delete', undefined)),
		clear: () => Promise.resolve(handleSSR(config.ssr, 'clear', undefined)),
		count: () => Promise.resolve(handleSSR(config.ssr, 'count', 0))
	};

	const stores: Record<string, IStore<unknown>> = {};

	for (const name of Object.keys(config.stores)) {
		stores[name] = { ...ssrStore, storeName: name };
	}

	const database = {
		getRawDB: () => new Promise<IDBDatabase>(() => {}), // Never resolves on SSR
		close: () => Promise.resolve(),
		__notifier: _notifier
	};

	return Object.assign(database, stores) as unknown as Database<TSchema>;
}
