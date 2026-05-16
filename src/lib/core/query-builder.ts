import type { IQueryBuilder } from './types.js';

import { wrapIDBError } from './errors.js';

export class QueryBuilder<T> implements IQueryBuilder<T> {
	private storeName: string;
	private indexName: string;
	private dbPromise: Promise<IDBDatabase>;
	private query?: IDBValidKey | IDBKeyRange;

	constructor(
		storeName: string,
		indexName: string,
		dbPromise: Promise<IDBDatabase>,
		query?: IDBValidKey | IDBKeyRange
	) {
		this.storeName = storeName;
		this.indexName = indexName;
		this.dbPromise = dbPromise;
		this.query = query;
	}

	equals(value: IDBValidKey): IQueryBuilder<T> {
		return this.clone(IDBKeyRange.only(value));
	}

	between(
		lower: IDBValidKey,
		upper: IDBValidKey,
		lowerOpen: boolean = false,
		upperOpen: boolean = false
	): IQueryBuilder<T> {
		return this.clone(IDBKeyRange.bound(lower, upper, lowerOpen, upperOpen));
	}

	above(value: IDBValidKey): IQueryBuilder<T> {
		return this.clone(IDBKeyRange.lowerBound(value, true));
	}

	aboveOrEqual(value: IDBValidKey): IQueryBuilder<T> {
		return this.clone(IDBKeyRange.lowerBound(value));
	}

	below(value: IDBValidKey): IQueryBuilder<T> {
		return this.clone(IDBKeyRange.upperBound(value, true));
	}

	belowOrEqual(value: IDBValidKey): IQueryBuilder<T> {
		return this.clone(IDBKeyRange.upperBound(value));
	}

	async toArray(): Promise<T[]> {
		try {
			const db = await this.dbPromise;
			return await this.request<T[]>(db, (index) => index.getAll(this.query));
		} catch (error) {
			throw wrapIDBError(error, `${this.storeName}.where(${this.indexName}).toArray`);
		}
	}

	async first(): Promise<T | undefined> {
		try {
			const db = await this.dbPromise;

			if (this.query) {
				return await this.request<T | undefined>(db, (index) => index.get(this.query!));
			}

			return await this.request<T | undefined>(db, (index) => index.openCursor(), (result) => {
				const cursor = result as IDBCursorWithValue | null;
				return cursor?.value as T | undefined;
			});
		} catch (error) {
			throw wrapIDBError(error, `${this.storeName}.where(${this.indexName}).first`);
		}
	}

	async count(): Promise<number> {
		try {
			const db = await this.dbPromise;
			return await this.request<number>(db, (index) => index.count(this.query));
		} catch (error) {
			throw wrapIDBError(error, `${this.storeName}.where(${this.indexName}).count`);
		}
	}

	private clone(query?: IDBValidKey | IDBKeyRange): QueryBuilder<T> {
		return new QueryBuilder<T>(this.storeName, this.indexName, this.dbPromise, query);
	}

	private request<R>(
		db: IDBDatabase,
		operation: (index: IDBIndex) => IDBRequest,
		transform?: (result: unknown) => R
	): Promise<R> {
		return new Promise<R>((resolve, reject) => {
			const tx = db.transaction(this.storeName, 'readonly');
			const store = tx.objectStore(this.storeName);
			const index = store.index(this.indexName);
			const request = operation(index);

			request.onsuccess = () => {
				const result = transform ? transform(request.result) : (request.result as R);
				resolve(result);
			};
			request.onerror = () => reject(request.error);
			tx.onerror = () => reject(tx.error);
		});
	}
}