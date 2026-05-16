import { afterEach, describe, expect, test } from 'vitest';

import { createDB } from '../../src/lib/index.ts';

function createCrudDB(name: string) {
	return createDB({
		name,
		version: 1,
		stores: {
			todos: {
				keyPath: 'id',
				autoIncrement: true,
				indexes: {
					byStatus: { keyPath: 'status' }
				}
			}
		}
	});
}

function deleteDatabase(name: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.deleteDatabase(name);

		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error);
		request.onblocked = () => resolve();
	});
}

describe('core store CRUD', () => {
	let dbName = '';
	let db: ReturnType<typeof createCrudDB> | undefined;

	afterEach(async () => {
		if (db) {
			await db.close();
			db = undefined;
		}

		if (dbName) {
			await deleteDatabase(dbName);
			dbName = '';
		}
	});

	test('covers add, get, getAll, count, delete, clear, and getAllFromIndex', async () => {
		dbName = `svelte-idb-core-crud-${crypto.randomUUID()}`;
		db = createCrudDB(dbName);

		const firstKey = await db.todos.add({ text: 'Write tests', done: false, status: 'todo' });
		const secondKey = await db.todos.add({ text: 'Ship release', done: true, status: 'done' });

		expect(firstKey).toBe(1);
		expect(secondKey).toBe(2);

		await expect(db.todos.get(firstKey)).resolves.toEqual({
			id: 1,
			text: 'Write tests',
			done: false,
			status: 'todo'
		});

		await expect(db.todos.getAll()).resolves.toEqual([
			{ id: 1, text: 'Write tests', done: false, status: 'todo' },
			{ id: 2, text: 'Ship release', done: true, status: 'done' }
		]);

		await expect(db.todos.count()).resolves.toBe(2);

		await expect(db.todos.getAllFromIndex('byStatus', IDBKeyRange.only('done'))).resolves.toEqual([
			{ id: 2, text: 'Ship release', done: true, status: 'done' }
		]);

		await db.todos.delete(firstKey);
		await expect(db.todos.getAll()).resolves.toEqual([
			{ id: 2, text: 'Ship release', done: true, status: 'done' }
		]);
		await expect(db.todos.count()).resolves.toBe(1);

		await db.todos.clear();
		await expect(db.todos.getAll()).resolves.toEqual([]);
		await expect(db.todos.count()).resolves.toBe(0);
	});

	test('covers put as an upsert and update path', async () => {
		dbName = `svelte-idb-core-crud-${crypto.randomUUID()}`;
		db = createCrudDB(dbName);

		const key = await db.todos.add({ text: 'Draft docs', done: false, status: 'todo' });
		await expect(db.todos.get(key)).resolves.toEqual({
			id: 1,
			text: 'Draft docs',
			done: false,
			status: 'todo'
		});

		await db.todos.put({ id: key, text: 'Draft docs', done: true, status: 'done' });
		await expect(db.todos.get(key)).resolves.toEqual({
			id: 1,
			text: 'Draft docs',
			done: true,
			status: 'done'
		});

		const upsertedKey = await db.todos.put({
			id: 10,
			text: 'Late insert',
			done: false,
			status: 'todo'
		});
		expect(upsertedKey).toBe(10);

		await expect(db.todos.getAll()).resolves.toEqual([
			{ id: 1, text: 'Draft docs', done: true, status: 'done' },
			{ id: 10, text: 'Late insert', done: false, status: 'todo' }
		]);
	});
});