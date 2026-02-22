/**
 * svelte-idb — Schema Manager
 *
 * Translates the declarative StoreConfig schema into imperative
 * IndexedDB `onupgradeneeded` operations.
 */

import type { DBSchema, StoreConfig, DatabaseConfig } from './types.js';

/**
 * Apply the schema definition inside an `onupgradeneeded` handler.
 * Creates or updates object stores and their indexes.
 */
export function applySchema<TSchema extends DBSchema>(
	db: IDBDatabase,
	transaction: IDBTransaction,
	config: DatabaseConfig<TSchema>
): void {
	const stores = config.stores;

	for (const [storeName, storeConfig] of Object.entries(stores) as [string, StoreConfig][]) {
		let objectStore: IDBObjectStore;

		// Create the store if it doesn't exist
		if (!db.objectStoreNames.contains(storeName)) {
			objectStore = db.createObjectStore(storeName, {
				keyPath: storeConfig.keyPath,
				autoIncrement: storeConfig.autoIncrement ?? false
			});
		} else {
			objectStore = transaction.objectStore(storeName);
		}

		// Create indexes
		if (storeConfig.indexes) {
			for (const [indexName, indexConfig] of Object.entries(storeConfig.indexes)) {
				// Skip if already exists
				if (objectStore.indexNames.contains(indexName)) {
					continue;
				}

				objectStore.createIndex(indexName, indexConfig.keyPath, {
					unique: indexConfig.unique ?? false,
					multiEntry: indexConfig.multiEntry ?? false
				});
			}
		}
	}
}
