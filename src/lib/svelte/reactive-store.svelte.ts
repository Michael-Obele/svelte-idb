/**
 * svelte-idb — ReactiveStore<T>
 *
 * Extends Store<T> with live query methods:
 * liveAll(), liveGet(key), liveCount()
 *
 * Must live in a .svelte.ts file for runes compilation.
 */

import type { IStore, ILiveQuery, StoreConfig } from '../core/types.js';
import type { ChangeNotifier } from '../core/change-notifier.js';
import { LiveQuery } from './live-query.svelte.js';

/**
 * Wraps a core Store<T> with Svelte 5 reactive live query methods.
 */
export class ReactiveStore<T> {
	private store: IStore<T>;
	private notifier: ChangeNotifier;
	private _storeName: string;

	constructor(store: IStore<T>, notifier: ChangeNotifier) {
		this.store = store;
		this.notifier = notifier;
		this._storeName = store.storeName;
	}

	// ─── Passthrough CRUD ─────────────────────────────────────

	get storeName(): string {
		return this._storeName;
	}

	add(value: T): Promise<IDBValidKey> {
		return this.store.add(value);
	}

	put(value: T): Promise<IDBValidKey> {
		return this.store.put(value);
	}

	get(key: IDBValidKey): Promise<T | undefined> {
		return this.store.get(key);
	}

	getAll(): Promise<T[]> {
		return this.store.getAll();
	}

	getAllFromIndex(
		indexName: string,
		query?: IDBValidKey | IDBKeyRange,
		count?: number
	): Promise<T[]> {
		return this.store.getAllFromIndex(indexName, query, count);
	}

	delete(key: IDBValidKey): Promise<void> {
		return this.store.delete(key);
	}

	clear(): Promise<void> {
		return this.store.clear();
	}

	count(): Promise<number> {
		return this.store.count();
	}

	// ─── Live Queries ─────────────────────────────────────────

	/**
	 * Returns a reactive LiveQuery that auto-updates with all records.
	 */
	liveAll(): ILiveQuery<T[]> {
		return new LiveQuery<T[]>(() => this.store.getAll(), [this._storeName], this.notifier, []);
	}

	/**
	 * Returns a reactive LiveQuery for a single record by key.
	 */
	liveGet(key: IDBValidKey): ILiveQuery<T | undefined> {
		return new LiveQuery<T | undefined>(
			() => this.store.get(key),
			[this._storeName],
			this.notifier,
			undefined
		);
	}

	/**
	 * Returns a reactive LiveQuery for the record count.
	 */
	liveCount(): ILiveQuery<number> {
		return new LiveQuery<number>(() => this.store.count(), [this._storeName], this.notifier, 0);
	}
}
