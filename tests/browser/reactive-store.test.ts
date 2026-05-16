import { afterEach, describe, expect, test } from 'vitest';

import type { ILiveQuery } from '../../src/lib/core/types.ts';
import { createReactiveDB } from '../../src/lib/svelte/index.ts';

function createReactiveTestDB(name: string) {
	return createReactiveDB({
		name,
		version: 1,
		stores: {
			todos: {
				keyPath: 'id',
				autoIncrement: true,
				indexes: {
					byDone: { keyPath: 'done' }
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

async function waitForIdle<T>(query: ILiveQuery<T>): Promise<void> {
	await expect.poll(() => query.loading).toBe(false);
}

describe('reactive store browser behavior', () => {
	let dbName = '';
	let db: ReturnType<typeof createReactiveTestDB> | undefined;

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

	test('createReactiveDB exposes reactive store methods and liveAll reacts to mutations', async () => {
		dbName = `svelte-idb-reactive-${crypto.randomUUID()}`;
		db = createReactiveTestDB(dbName);

		await db.todos.add({ text: 'Initial', done: false });

		const allTodos = db.todos.liveAll();
		expect(typeof db.todos.liveAll).toBe('function');
		expect(typeof db.todos.liveGet).toBe('function');
		expect(typeof db.todos.liveCount).toBe('function');
		expect(allTodos.loading).toBe(true);

		await waitForIdle(allTodos);
		expect(allTodos.current).toEqual([{ id: 1, text: 'Initial', done: false }]);

		await db.todos.add({ text: 'Follow-up', done: true });
		await expect.poll(() => allTodos.current.length).toBe(2);

		allTodos.destroy();
		await db.todos.add({ text: 'Ignored', done: false });
		await new Promise((resolve) => window.setTimeout(resolve, 25));
		expect(allTodos.current).toHaveLength(2);
	});

	test('liveGet and liveCount update after put, delete, and clear', async () => {
		dbName = `svelte-idb-reactive-${crypto.randomUUID()}`;
		db = createReactiveTestDB(dbName);

		const key = await db.todos.add({ text: 'Track me', done: false });
		const singleTodo = db.todos.liveGet(key);
		const todoCount = db.todos.liveCount();

		await waitForIdle(singleTodo);
		await waitForIdle(todoCount);

		expect(singleTodo.current).toEqual({ id: 1, text: 'Track me', done: false });
		expect(todoCount.current).toBe(1);

		await db.todos.put({ id: key, text: 'Track me', done: true });
		await expect.poll(() => (singleTodo.current as { done?: boolean } | undefined)?.done).toBe(true);

		await db.todos.delete(key);
		await expect.poll(() => singleTodo.current).toBeUndefined();
		await expect.poll(() => todoCount.current).toBe(0);

		await db.todos.add({ text: 'One', done: false });
		await db.todos.add({ text: 'Two', done: true });
		await expect.poll(() => todoCount.current).toBe(2);

		await db.todos.clear();
		await expect.poll(() => todoCount.current).toBe(0);
	});

	test('custom liveQuery surfaces error state and supports refresh', async () => {
		dbName = `svelte-idb-reactive-${crypto.randomUUID()}`;
		db = createReactiveTestDB(dbName);

		let shouldFail = true;
		let calls = 0;

		const query = db.liveQuery(async () => {
			calls += 1;
			if (shouldFail) {
				throw new Error('boom');
			}

			return calls;
		}, ['todos']);

		await waitForIdle(query);
		expect(query.error?.message).toBe('boom');
		expect(query.loading).toBe(false);

		shouldFail = false;
		await query.refresh();
		await waitForIdle(query);

		expect(query.error).toBeNull();
		expect(query.current).toBeGreaterThanOrEqual(2);
	});
});