/**
 * svelte-idb — Store<T>
 *
 * Generic CRUD layer over a single IndexedDB object store.
 * Every mutation notifies the ChangeNotifier for reactive updates.
 */

import type { IStore, StoreConfig } from './types.js';
import type { ChangeNotifier } from './change-notifier.js';
import { prepareForInsert } from '../utils/prepare-value.js';
import { wrapIDBError } from './errors.js';

export class Store<T> implements IStore<T> {
	readonly storeName: string;
	private dbPromise: Promise<IDBDatabase>;
	private notifier: ChangeNotifier;
	private config: StoreConfig;
	private debug: boolean;

	constructor(
		storeName: string,
		dbPromise: Promise<IDBDatabase>,
		notifier: ChangeNotifier,
		config: StoreConfig,
		debug: boolean = false
	) {
		this.storeName = storeName;
		this.dbPromise = dbPromise;
		this.notifier = notifier;
		this.config = config;
		this.debug = debug;
	}

	private log(method: string, ...args: unknown[]): void {
		if (this.debug) {
			console.log(`[svelte-idb] ${this.storeName}.${method}`, ...args);
		}
	}

	/**
	 * Insert a new record. Fails if the key already exists.
	 */
	async add(value: T): Promise<IDBValidKey> {
		this.log('add', value);
		try {
			const db = await this.dbPromise;
			const prepared = prepareForInsert(
				value,
				this.config.keyPath,
				this.config.autoIncrement ?? false
			);

			const key = await this.request<IDBValidKey>(db, 'readwrite', (store) =>
				store.add(prepared as unknown as Record<string, unknown>)
			);

			this.notifier.notify(this.storeName, { type: 'add', key });
			this.log('add → key', key);
			return key;
		} catch (error) {
			throw wrapIDBError(error, `${this.storeName}.add`);
		}
	}

	/**
	 * Insert or update a record (upsert).
	 */
	async put(value: T): Promise<IDBValidKey> {
		this.log('put', value);
		try {
			const db = await this.dbPromise;
			const prepared = prepareForInsert(
				value,
				this.config.keyPath,
				this.config.autoIncrement ?? false
			);

			const key = await this.request<IDBValidKey>(db, 'readwrite', (store) =>
				store.put(prepared as unknown as Record<string, unknown>)
			);

			this.notifier.notify(this.storeName, { type: 'put', key });
			this.log('put → key', key);
			return key;
		} catch (error) {
			throw wrapIDBError(error, `${this.storeName}.put`);
		}
	}

	/**
	 * Retrieve a single record by primary key.
	 */
	async get(key: IDBValidKey): Promise<T | undefined> {
		this.log('get', key);
		try {
			const db = await this.dbPromise;
			return await this.request<T | undefined>(db, 'readonly', (store) => store.get(key));
		} catch (error) {
			throw wrapIDBError(error, `${this.storeName}.get`);
		}
	}

	/**
	 * Retrieve all records in the store.
	 */
	async getAll(): Promise<T[]> {
		this.log('getAll');
		try {
			const db = await this.dbPromise;
			return await this.request<T[]>(db, 'readonly', (store) => store.getAll());
		} catch (error) {
			throw wrapIDBError(error, `${this.storeName}.getAll`);
		}
	}

	/**
	 * Query records via a secondary index.
	 */
	async getAllFromIndex(
		indexName: string,
		query?: IDBValidKey | IDBKeyRange,
		count?: number
	): Promise<T[]> {
		this.log('getAllFromIndex', indexName, query, count);
		try {
			const db = await this.dbPromise;
			return await this.request<T[]>(db, 'readonly', (store) => {
				const index = store.index(indexName);
				return index.getAll(query, count);
			});
		} catch (error) {
			throw wrapIDBError(error, `${this.storeName}.getAllFromIndex`);
		}
	}

	/**
	 * Remove a record by primary key.
	 */
	async delete(key: IDBValidKey): Promise<void> {
		this.log('delete', key);
		try {
			const db = await this.dbPromise;
			await this.request<undefined>(db, 'readwrite', (store) => store.delete(key));
			this.notifier.notify(this.storeName, { type: 'delete', key });
		} catch (error) {
			throw wrapIDBError(error, `${this.storeName}.delete`);
		}
	}

	/**
	 * Remove all records from the store.
	 */
	async clear(): Promise<void> {
		this.log('clear');
		try {
			const db = await this.dbPromise;
			await this.request<undefined>(db, 'readwrite', (store) => store.clear());
			this.notifier.notify(this.storeName, { type: 'clear' });
		} catch (error) {
			throw wrapIDBError(error, `${this.storeName}.clear`);
		}
	}

	/**
	 * Count records in the store.
	 */
	async count(): Promise<number> {
		this.log('count');
		try {
			const db = await this.dbPromise;
			return await this.request<number>(db, 'readonly', (store) => store.count());
		} catch (error) {
			throw wrapIDBError(error, `${this.storeName}.count`);
		}
	}

	/**
	 * Low-level helper: open a transaction, perform an operation, return a promise.
	 */
	private request<R>(
		db: IDBDatabase,
		mode: IDBTransactionMode,
		operation: (store: IDBObjectStore) => IDBRequest
	): Promise<R> {
		return new Promise<R>((resolve, reject) => {
			const tx = db.transaction(this.storeName, mode);
			const store = tx.objectStore(this.storeName);
			const request = operation(store);

			request.onsuccess = () => resolve(request.result as R);
			request.onerror = () => reject(request.error);
			tx.onerror = () => reject(tx.error);
		});
	}
}
