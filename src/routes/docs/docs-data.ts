/**
 * svelte-idb Documentation Data
 *
 * Central registry for all documentation pages.
 * Each page has a slug, title, description, and content sections.
 */

export interface CodeExample {
	title: string;
	language: string;
	code: string;
	description?: string;
}

export interface ApiItem {
	name: string;
	type: string;
	description: string;
	required?: boolean;
	default?: string;
}

export interface ContentSection {
	heading: string;
	text?: string;
	code?: CodeExample;
	apiTable?: ApiItem[];
	note?: string;
}

export interface DocPage {
	slug: string;
	title: string;
	description: string;
	category: string;
	order: number;
	sections: ContentSection[];
}

export interface DocCategory {
	name: string;
	order: number;
	pages: DocPage[];
}

// ─── Documentation Pages ──────────────────────────────────────

export const docs: DocPage[] = [
	// ═══════════════════════════════════════
	//  GETTING STARTED
	// ═══════════════════════════════════════
	{
		slug: 'installation',
		title: 'Installation',
		description: 'Get started with svelte-idb in your SvelteKit project.',
		category: 'Getting Started',
		order: 0,
		sections: [
			{
				heading: 'Install the package',
				text: 'Install svelte-idb using your preferred package manager.',
				code: {
					title: 'Terminal',
					language: 'bash',
					code: `# npm
npm install svelte-idb

# pnpm
pnpm add svelte-idb

# bun
bun add svelte-idb`
				}
			},
			{
				heading: 'Requirements',
				text: 'svelte-idb requires Svelte 5 (runes mode) and works with SvelteKit out of the box. It has zero runtime dependencies.',
				apiTable: [
					{
						name: 'Svelte',
						type: '^5.0.0',
						description: 'Svelte 5 with runes support',
						required: true
					},
					{
						name: 'SvelteKit',
						type: 'Any',
						description: 'Optional — SSR safety is built-in',
						required: false
					},
					{
						name: 'TypeScript',
						type: 'Recommended',
						description: 'Full type inference for schemas',
						required: false
					}
				]
			},
			{
				heading: 'Two entry points',
				text: 'The library provides two import paths for different use cases.',
				code: {
					title: 'imports.ts',
					language: 'typescript',
					code: `// Core — framework-agnostic, no Svelte dependency
import { createDB } from 'svelte-idb';

// Reactive — Svelte 5 runes integration
import { createReactiveDB } from 'svelte-idb/svelte';`
				},
				note: 'Use the reactive entry point for Svelte projects. The core entry point is useful for shared logic or non-Svelte contexts.'
			}
		]
	},
	{
		slug: 'quick-start',
		title: 'Quick Start',
		description: 'Create your first reactive IndexedDB database in under a minute.',
		category: 'Getting Started',
		order: 1,
		sections: [
			{
				heading: 'Define your database',
				text: 'Use createReactiveDB() to define your database schema and get back a fully typed, reactive database instance.',
				code: {
					title: '+page.svelte',
					language: 'svelte',
					code: `<script lang="ts">
  import { createReactiveDB } from 'svelte-idb/svelte';

  const db = createReactiveDB({
    name: 'my-app',
    version: 1,
    stores: {
      todos: { keyPath: 'id', autoIncrement: true }
    }
  });
</script>`
				}
			},
			{
				heading: 'Create a live query',
				text: 'Live queries automatically update when data changes — no manual refreshing needed.',
				code: {
					title: '+page.svelte',
					language: 'svelte',
					code: `<script lang="ts">
  // ... db definition above

  interface Todo {
    id?: number;
    text: string;
    done: boolean;
  }

  const todos = db.todos.liveAll();

  async function addTodo(text: string) {
    await db.todos.add({ text, done: false });
    // todos.current updates automatically!
  }
</script>

<ul>
  {#each todos.current as todo (todo.id)}
    <li>{todo.text}</li>
  {/each}
</ul>`
				}
			},
			{
				heading: 'Full example',
				text: 'Here is a complete working example of a todo app with add, toggle, and delete functionality.',
				code: {
					title: 'todo-app.svelte',
					language: 'svelte',
					code: `<script lang="ts">
  import { createReactiveDB } from 'svelte-idb/svelte';

  interface Todo {
    id?: number;
    text: string;
    done: boolean;
  }

  const db = createReactiveDB({
    name: 'todo-app',
    version: 1,
    stores: {
      todos: { keyPath: 'id', autoIncrement: true }
    }
  });

  const todos = db.todos.liveAll();
  const count = db.todos.liveCount();
  let newText = $state('');

  async function addTodo() {
    if (!newText.trim()) return;
    await db.todos.add({ text: newText, done: false });
    newText = '';
  }

  async function toggleTodo(todo: Todo) {
    await db.todos.put({ ...todo, done: !todo.done });
  }

  async function deleteTodo(id: number) {
    await db.todos.delete(id);
  }
</script>

<form onsubmit={(e) => { e.preventDefault(); addTodo(); }}>
  <input bind:value={newText} placeholder="What needs to be done?" />
  <button type="submit">Add ({count.current} total)</button>
</form>

<ul>
  {#each todos.current as todo (todo.id)}
    <li>
      <input type="checkbox"
        checked={todo.done}
        onchange={() => toggleTodo(todo)} />
      <span class:done={todo.done}>{todo.text}</span>
      <button onclick={() => deleteTodo(todo.id!)}>×</button>
    </li>
  {/each}
</ul>`
				}
			}
		]
	},

	// ═══════════════════════════════════════
	//  CORE API
	// ═══════════════════════════════════════
	{
		slug: 'create-db',
		title: 'createDB()',
		description:
			'The core factory function that opens an IndexedDB connection and creates typed Store instances.',
		category: 'Core API',
		order: 10,
		sections: [
			{
				heading: 'Usage',
				text: 'createDB() is the framework-agnostic entry point. It takes a DatabaseConfig object and returns a Database instance with typed store accessors.',
				code: {
					title: 'database.ts',
					language: 'typescript',
					code: `import { createDB } from 'svelte-idb';

const db = createDB({
  name: 'my-app',
  version: 1,
  stores: {
    users: {
      keyPath: 'id',
      autoIncrement: true,
      indexes: {
        byEmail: { keyPath: 'email', unique: true }
      }
    },
    posts: {
      keyPath: 'slug',
      autoIncrement: false
    }
  }
});

// Typed store access
await db.users.add({ name: 'Alice', email: 'alice@example.com' });
const user = await db.users.get(1);
const allPosts = await db.posts.getAll();`
				}
			},
			{
				heading: 'DatabaseConfig',
				text: 'The configuration object passed to createDB().',
				apiTable: [
					{
						name: 'name',
						type: 'string',
						description: 'Name of the IndexedDB database',
						required: true
					},
					{
						name: 'version',
						type: 'number',
						description: 'Schema version — increment when changing stores/indexes',
						required: true
					},
					{
						name: 'stores',
						type: 'DBSchema',
						description: 'Object mapping store names to their configuration',
						required: true
					},
					{
						name: 'ssr',
						type: 'SSRStrategy',
						description: 'How to handle server-side calls',
						required: false,
						default: "'noop'"
					},
					{
						name: 'onUpgrade',
						type: 'function',
						description: 'Custom migration callback for onupgradeneeded',
						required: false
					},
					{
						name: 'onBlocked',
						type: 'function',
						description: 'Called when another tab blocks version change',
						required: false
					},
					{
						name: 'debug',
						type: 'boolean',
						description: 'Enable console logging for all operations',
						required: false,
						default: 'false'
					}
				]
			},
			{
				heading: 'StoreConfig',
				text: 'Configuration for each object store.',
				apiTable: [
					{
						name: 'keyPath',
						type: 'string',
						description: 'The property used as the primary key',
						required: true
					},
					{
						name: 'autoIncrement',
						type: 'boolean',
						description: 'Auto-generate keys when not provided',
						required: false,
						default: 'false'
					},
					{
						name: 'indexes',
						type: 'Record<string, IndexConfig>',
						description: 'Secondary indexes for querying',
						required: false
					}
				]
			},
			{
				heading: 'IndexConfig',
				text: 'Configuration for secondary indexes on a store.',
				apiTable: [
					{
						name: 'keyPath',
						type: 'string | string[]',
						description: 'The property (or properties) to index',
						required: true
					},
					{
						name: 'unique',
						type: 'boolean',
						description: 'Whether indexed values must be unique',
						required: false,
						default: 'false'
					},
					{
						name: 'multiEntry',
						type: 'boolean',
						description: 'If keyPath is an array value, index each element',
						required: false,
						default: 'false'
					}
				]
			},
			{
				heading: 'Database methods',
				text: 'The returned Database object provides these utility methods in addition to the typed store accessors.',
				apiTable: [
					{
						name: 'getRawDB()',
						type: 'Promise<IDBDatabase>',
						description: 'Get the underlying native IDBDatabase instance'
					},
					{ name: 'close()', type: 'Promise<void>', description: 'Close the database connection' }
				]
			}
		]
	},
	{
		slug: 'store-operations',
		title: 'Store Operations',
		description:
			'CRUD operations available on every store: add, put, get, getAll, delete, clear, count.',
		category: 'Core API',
		order: 11,
		sections: [
			{
				heading: 'Overview',
				text: 'Every store in a svelte-idb database implements the IStore<T> interface, providing a complete set of CRUD operations. All operations return Promises and are fully type-safe.'
			},
			{
				heading: 'add(value)',
				text: 'Insert a new record. Throws IDBConstraintError if the key already exists.',
				code: {
					title: 'add.ts',
					language: 'typescript',
					code: `// With autoIncrement: true — id is generated
const key = await db.users.add({ name: 'Alice' });
console.log(key); // 1

// With autoIncrement: false — key must be in value
await db.posts.add({ slug: 'hello-world', title: 'Hello' });`
				}
			},
			{
				heading: 'put(value)',
				text: 'Insert or update a record. If a record with the same key exists, it is replaced.',
				code: {
					title: 'put.ts',
					language: 'typescript',
					code: `// Update an existing record
await db.users.put({ id: 1, name: 'Alice Updated' });

// Or insert a new one
await db.users.put({ name: 'Bob' }); // auto-generates id`
				}
			},
			{
				heading: 'get(key)',
				text: 'Retrieve a single record by its primary key. Returns undefined if not found.',
				code: {
					title: 'get.ts',
					language: 'typescript',
					code: `const user = await db.users.get(1);
if (user) {
  console.log(user.name); // "Alice"
}`
				}
			},
			{
				heading: 'getAll()',
				text: 'Retrieve all records from the store.',
				code: {
					title: 'getAll.ts',
					language: 'typescript',
					code: `const users = await db.users.getAll();
console.log(users.length); // number of records`
				}
			},
			{
				heading: 'getAllFromIndex(indexName, query?, count?)',
				text: 'Query records using a secondary index.',
				code: {
					title: 'getAllFromIndex.ts',
					language: 'typescript',
					code: `// Get user by email index
const results = await db.users.getAllFromIndex(
  'byEmail',
  'alice@example.com'
);

// Get users with IDBKeyRange
const range = IDBKeyRange.bound('a', 'b');
const filtered = await db.users.getAllFromIndex('byEmail', range);`
				}
			},
			{
				heading: 'delete(key)',
				text: 'Remove a single record by its primary key.',
				code: {
					title: 'delete.ts',
					language: 'typescript',
					code: `await db.users.delete(1);`
				}
			},
			{
				heading: 'clear()',
				text: 'Remove all records from the store.',
				code: {
					title: 'clear.ts',
					language: 'typescript',
					code: `await db.users.clear();`
				}
			},
			{
				heading: 'count()',
				text: 'Get the number of records in the store.',
				code: {
					title: 'count.ts',
					language: 'typescript',
					code: `const total = await db.users.count();
console.log(\`\${total} users in database\`);`
				}
			},
			{
				heading: 'API Reference',
				apiTable: [
					{
						name: 'add(value)',
						type: 'Promise<IDBValidKey>',
						description: 'Insert a new record, returns the generated key'
					},
					{
						name: 'put(value)',
						type: 'Promise<IDBValidKey>',
						description: 'Insert or replace a record'
					},
					{
						name: 'get(key)',
						type: 'Promise<T | undefined>',
						description: 'Retrieve a record by primary key'
					},
					{ name: 'getAll()', type: 'Promise<T[]>', description: 'Retrieve all records' },
					{
						name: 'getAllFromIndex()',
						type: 'Promise<T[]>',
						description: 'Query records via a secondary index'
					},
					{ name: 'delete(key)', type: 'Promise<void>', description: 'Remove a record by key' },
					{ name: 'clear()', type: 'Promise<void>', description: 'Remove all records' },
					{ name: 'count()', type: 'Promise<number>', description: 'Count total records' }
				]
			}
		]
	},

	// ═══════════════════════════════════════
	//  REACTIVE LAYER
	// ═══════════════════════════════════════
	{
		slug: 'create-reactive-db',
		title: 'createReactiveDB()',
		description: 'The Svelte 5 reactive wrapper that adds live queries to every store.',
		category: 'Reactive Layer',
		order: 20,
		sections: [
			{
				heading: 'Overview',
				text: 'createReactiveDB() wraps createDB() and returns a ReactiveDatabase where every store is a ReactiveStore with liveAll(), liveGet(), and liveCount() methods. These live queries use Svelte 5 $state runes under the hood, so your UI updates automatically when data changes.'
			},
			{
				heading: 'Usage',
				code: {
					title: '+page.svelte',
					language: 'svelte',
					code: `<script lang="ts">
  import { createReactiveDB } from 'svelte-idb/svelte';

  const db = createReactiveDB({
    name: 'my-app',
    version: 1,
    stores: {
      notes: { keyPath: 'id', autoIncrement: true },
      tags: { keyPath: 'name' }
    }
  });

  // Every store gets reactive methods
  const allNotes = db.notes.liveAll();
  const noteCount = db.notes.liveCount();
  const singleNote = db.notes.liveGet(1);
</script>

<p>Total: {noteCount.current}</p>

{#each allNotes.current as note (note.id)}
  <div>{note.title}</div>
{/each}`
				}
			},
			{
				heading: 'ReactiveDatabase type',
				text: 'The returned type extends the base Database with reactive stores and a liveQuery() method.',
				apiTable: [
					{
						name: '[storeName]',
						type: 'ReactiveStore<T>',
						description: 'Each store from your schema becomes a ReactiveStore'
					},
					{
						name: 'getRawDB()',
						type: 'Promise<IDBDatabase>',
						description: 'Access the underlying IndexedDB instance'
					},
					{ name: 'close()', type: 'Promise<void>', description: 'Close the database connection' },
					{
						name: 'liveQuery(fn, stores)',
						type: 'ILiveQuery<T>',
						description: 'Create a custom live query across multiple stores'
					}
				]
			},
			{
				heading: 'Custom live queries',
				text: 'Use liveQuery() for complex queries that span multiple stores or need custom logic.',
				code: {
					title: 'custom-query.svelte',
					language: 'svelte',
					code: `<script lang="ts">
  const db = createReactiveDB({
    name: 'blog',
    version: 1,
    stores: {
      posts: { keyPath: 'id', autoIncrement: true },
      comments: { keyPath: 'id', autoIncrement: true }
    }
  });

  // Custom query that reacts to changes in both stores
  const stats = db.liveQuery(
    async () => {
      const posts = await db.posts.getAll();
      const comments = await db.comments.getAll();
      return {
        postCount: posts.length,
        commentCount: comments.length
      };
    },
    ['posts', 'comments']
  );
</script>

<p>{stats.current.postCount} posts, {stats.current.commentCount} comments</p>`
				}
			}
		]
	},
	{
		slug: 'live-query',
		title: 'LiveQuery',
		description: 'The reactive primitive that keeps query results in sync with $state.',
		category: 'Reactive Layer',
		order: 21,
		sections: [
			{
				heading: 'How it works',
				text: 'LiveQuery<T> is a class that wraps an async query function and automatically re-executes it whenever the underlying store data changes. It uses Svelte 5 $state runes internally, so any component reading .current will re-render when the data updates. The ChangeNotifier system uses microtask batching, so multiple rapid mutations result in a single re-query.'
			},
			{
				heading: 'Properties',
				apiTable: [
					{
						name: 'current',
						type: 'T',
						description: 'The current query result (reactive via $state)'
					},
					{ name: 'loading', type: 'boolean', description: 'True while the query is executing' },
					{
						name: 'error',
						type: 'Error | null',
						description: 'The last error, or null if successful'
					}
				]
			},
			{
				heading: 'Methods',
				apiTable: [
					{
						name: 'refresh()',
						type: 'Promise<void>',
						description: 'Manually re-execute the query'
					},
					{
						name: 'destroy()',
						type: 'void',
						description: 'Unsubscribe from change notifications and stop updating'
					}
				]
			},
			{
				heading: 'Loading and error states',
				code: {
					title: 'states.svelte',
					language: 'svelte',
					code: `<script lang="ts">
  const items = db.items.liveAll();
</script>

{#if items.loading}
  <p>Loading...</p>
{:else if items.error}
  <p>Error: {items.error.message}</p>
{:else if items.current.length === 0}
  <p>No items yet.</p>
{:else}
  {#each items.current as item (item.id)}
    <div>{item.name}</div>
  {/each}
{/if}`
				}
			},
			{
				heading: 'Reactive store methods',
				text: 'ReactiveStore provides three convenience methods that return LiveQuery instances.',
				apiTable: [
					{
						name: 'liveAll()',
						type: 'ILiveQuery<T[]>',
						description: 'Live query for all records — updates on any mutation'
					},
					{
						name: 'liveGet(key)',
						type: 'ILiveQuery<T | undefined>',
						description: 'Live query for a single record by key'
					},
					{
						name: 'liveCount()',
						type: 'ILiveQuery<number>',
						description: 'Live count of records in the store'
					}
				]
			}
		]
	},

	// ═══════════════════════════════════════
	//  TYPES
	// ═══════════════════════════════════════
	{
		slug: 'types',
		title: 'TypeScript Types',
		description: 'All public types exported by svelte-idb for full type safety.',
		category: 'Types & Config',
		order: 30,
		sections: [
			{
				heading: 'Schema types',
				apiTable: [
					{
						name: 'DBSchema',
						type: 'Record<string, StoreConfig>',
						description: 'Maps store names to their configuration'
					},
					{
						name: 'StoreConfig',
						type: 'object',
						description: 'keyPath, autoIncrement, indexes for a store'
					},
					{
						name: 'IndexConfig',
						type: 'object',
						description: 'keyPath, unique, multiEntry for an index'
					},
					{
						name: 'DatabaseConfig<T>',
						type: 'object',
						description: 'Full config object passed to createDB'
					}
				]
			},
			{
				heading: 'Store & database types',
				apiTable: [
					{
						name: 'IStore<T>',
						type: 'interface',
						description: 'The store interface with all CRUD methods'
					},
					{
						name: 'Database<T>',
						type: 'type',
						description: 'Mapped type — stores + getRawDB + close'
					},
					{
						name: 'ReactiveStore<T>',
						type: 'class',
						description: 'Store with liveAll, liveGet, liveCount'
					},
					{
						name: 'ReactiveDatabase<T>',
						type: 'type',
						description: 'Database with reactive stores + liveQuery'
					}
				]
			},
			{
				heading: 'Reactive types',
				apiTable: [
					{
						name: 'ILiveQuery<T>',
						type: 'interface',
						description: 'current, loading, error, refresh(), destroy()'
					},
					{
						name: 'ChangeEvent',
						type: 'interface',
						description: 'type: add | put | delete | clear | batch'
					},
					{
						name: 'ChangeType',
						type: 'union',
						description: "'add' | 'put' | 'delete' | 'clear' | 'batch'"
					},
					{
						name: 'ChangeSubscriber',
						type: 'function',
						description: '(event: ChangeEvent) => void'
					}
				]
			},
			{
				heading: 'Utility types',
				text: 'Helper types for working with records that may or may not have an id field.',
				code: {
					title: 'utility-types.ts',
					language: 'typescript',
					code: `import type { WithId, WithoutId } from 'svelte-idb';

interface User {
  id?: number;
  name: string;
  email: string;
}

// WithId<User> = { id: number; name: string; email: string; }
// WithoutId<User> = { name: string; email: string; }

function displayUser(user: WithId<User>) {
  console.log(\`#\${user.id}: \${user.name}\`);
}

function createUser(data: WithoutId<User>) {
  return db.users.add(data);
}`
				}
			},
			{
				heading: 'SSR types',
				apiTable: [
					{
						name: 'SSRStrategy',
						type: "'noop' | 'throw' | function",
						description: 'Controls behavior when IndexedDB is accessed server-side'
					}
				]
			}
		]
	},

	// ═══════════════════════════════════════
	//  ERROR HANDLING
	// ═══════════════════════════════════════
	{
		slug: 'error-handling',
		title: 'Error Handling',
		description: 'Typed error classes that wrap native IndexedDB DOMExceptions.',
		category: 'Types & Config',
		order: 31,
		sections: [
			{
				heading: 'Error hierarchy',
				text: 'All errors extend the base IDBError class, which wraps native DOMException errors with better messages and context.',
				apiTable: [
					{
						name: 'IDBError',
						type: 'base',
						description: 'Base error — any unrecognized IndexedDB error'
					},
					{
						name: 'IDBNotFoundError',
						type: 'extends IDBError',
						description: 'Store or index not found'
					},
					{
						name: 'IDBConstraintError',
						type: 'extends IDBError',
						description: 'Unique constraint violated (duplicate key)'
					},
					{
						name: 'IDBVersionError',
						type: 'extends IDBError',
						description: 'Version mismatch or downgrade attempted'
					},
					{
						name: 'IDBAbortError',
						type: 'extends IDBError',
						description: 'Transaction was aborted'
					},
					{ name: 'IDBTimeoutError', type: 'extends IDBError', description: 'Operation timed out' }
				]
			},
			{
				heading: 'Catching errors',
				code: {
					title: 'error-handling.ts',
					language: 'typescript',
					code: `import {
  IDBConstraintError,
  IDBNotFoundError
} from 'svelte-idb';

try {
  await db.users.add({ id: 1, name: 'Alice' });
  await db.users.add({ id: 1, name: 'Bob' }); // duplicate!
} catch (error) {
  if (error instanceof IDBConstraintError) {
    console.error('Duplicate key:', error.key);
  } else if (error instanceof IDBNotFoundError) {
    console.error('Store missing:', error.storeName);
  } else {
    console.error('Unknown error:', error);
  }
}`
				}
			},
			{
				heading: 'Error properties',
				apiTable: [
					{
						name: 'message',
						type: 'string',
						description: 'Human-readable error message with context'
					},
					{
						name: 'cause',
						type: 'DOMException | undefined',
						description: 'The original native DOMException'
					},
					{
						name: 'name',
						type: 'string',
						description: 'Error class name (e.g. "IDBConstraintError")'
					}
				],
				note: 'IDBConstraintError also has a .key property, and IDBNotFoundError has a .storeName property.'
			}
		]
	},

	// ═══════════════════════════════════════
	//  SSR SAFETY
	// ═══════════════════════════════════════
	{
		slug: 'ssr-safety',
		title: 'SSR Safety',
		description: 'How svelte-idb safely handles server-side rendering without IndexedDB.',
		category: 'Advanced',
		order: 40,
		sections: [
			{
				heading: 'How it works',
				text: 'IndexedDB only exists in browsers. When your SvelteKit app renders on the server, svelte-idb detects the server environment and returns safe no-op implementations instead of throwing errors. This means you can use createDB() and createReactiveDB() directly in your components without wrapping them in onMount or browser checks.'
			},
			{
				heading: 'SSR strategies',
				text: 'Configure the ssr option in your database config to control server-side behavior.',
				apiTable: [
					{
						name: "'noop'",
						type: 'default',
						description: 'Return safe defaults (empty arrays, 0, undefined) on server'
					},
					{
						name: "'throw'",
						type: 'strict',
						description: 'Throw an error if any IndexedDB operation runs on the server'
					},
					{
						name: 'function',
						type: 'custom',
						description: 'Call a custom function with the operation name'
					}
				]
			},
			{
				heading: 'Configuration',
				code: {
					title: 'ssr-config.ts',
					language: 'typescript',
					code: `// Default: silently returns safe values
const db = createReactiveDB({
  name: 'my-app',
  version: 1,
  ssr: 'noop', // default
  stores: { /* ... */ }
});

// Strict: throws errors on the server
const db2 = createReactiveDB({
  name: 'my-app',
  version: 1,
  ssr: 'throw',
  stores: { /* ... */ }
});

// Custom: log and continue
const db3 = createReactiveDB({
  name: 'my-app',
  version: 1,
  ssr: (operation) => {
    console.warn(\`SSR: \${operation} was called on the server\`);
  },
  stores: { /* ... */ }
});`
				}
			},
			{
				heading: 'SSR return values',
				text: 'When using the default "noop" strategy, operations return these safe defaults on the server:',
				apiTable: [
					{ name: 'add()', type: 'IDBValidKey', description: 'Returns 0' },
					{ name: 'put()', type: 'IDBValidKey', description: 'Returns 0' },
					{ name: 'get()', type: 'T | undefined', description: 'Returns undefined' },
					{ name: 'getAll()', type: 'T[]', description: 'Returns []' },
					{ name: 'delete()', type: 'void', description: 'Returns undefined' },
					{ name: 'clear()', type: 'void', description: 'Returns undefined' },
					{ name: 'count()', type: 'number', description: 'Returns 0' }
				],
				note: 'LiveQuery instances created on the server will have loading: false, current set to their initial value, and will never re-query.'
			}
		]
	},

	// ═══════════════════════════════════════
	//  ADVANCED
	// ═══════════════════════════════════════
	{
		slug: 'schema-migrations',
		title: 'Schema & Migrations',
		description: 'How to evolve your database schema over time with versioned upgrades.',
		category: 'Advanced',
		order: 41,
		sections: [
			{
				heading: 'Automatic schema management',
				text: 'svelte-idb automatically creates object stores and indexes based on your declarative schema. When you increment the version number and change the stores config, it applies the necessary changes during the onupgradeneeded event.'
			},
			{
				heading: 'Adding a new store',
				code: {
					title: 'migration-v2.ts',
					language: 'typescript',
					code: `const db = createDB({
  name: 'my-app',
  version: 2, // bumped from 1
  stores: {
    users: { keyPath: 'id', autoIncrement: true },
    // New store added in v2
    settings: { keyPath: 'key' }
  }
});`
				}
			},
			{
				heading: 'Adding indexes',
				code: {
					title: 'migration-indexes.ts',
					language: 'typescript',
					code: `const db = createDB({
  name: 'my-app',
  version: 3, // bumped
  stores: {
    users: {
      keyPath: 'id',
      autoIncrement: true,
      indexes: {
        byEmail: { keyPath: 'email', unique: true },
        byRole: { keyPath: 'role', unique: false }
      }
    }
  }
});`
				}
			},
			{
				heading: 'Custom migrations',
				text: 'For complex migrations (data transforms, removing stores), use the onUpgrade callback.',
				code: {
					title: 'custom-migration.ts',
					language: 'typescript',
					code: `const db = createDB({
  name: 'my-app',
  version: 4,
  stores: {
    users: { keyPath: 'id', autoIncrement: true }
  },
  onUpgrade(db, oldVersion, newVersion, transaction) {
    if (oldVersion < 3) {
      // Remove an old store
      if (db.objectStoreNames.contains('legacy_data')) {
        db.deleteObjectStore('legacy_data');
      }
    }
    if (oldVersion < 4) {
      // Migrate data in existing store
      const store = transaction.objectStore('users');
      const request = store.openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const user = cursor.value;
          user.displayName = user.name; // add new field
          cursor.update(user);
          cursor.continue();
        }
      };
    }
  }
});`
				}
			}
		]
	},
	{
		slug: 'change-notifier',
		title: 'ChangeNotifier',
		description: 'The pub/sub system that powers reactive updates with microtask batching.',
		category: 'Advanced',
		order: 42,
		sections: [
			{
				heading: 'How it works',
				text: 'Every mutation (add, put, delete, clear) on a Store emits a change event through the ChangeNotifier. The notifier uses microtask batching — multiple rapid mutations in the same execution context result in a single "batch" notification, preventing unnecessary re-queries.'
			},
			{
				heading: 'Batching example',
				text: 'When you perform multiple operations in a loop, the notifier batches them into a single update.',
				code: {
					title: 'batching.ts',
					language: 'typescript',
					code: `// These 100 adds result in only ONE re-query
for (let i = 0; i < 100; i++) {
  await db.items.add({ name: \`Item \${i}\` });
}
// The UI updates once after all 100 items are added`
				},
				note: 'The batching uses queueMicrotask(), so the flush happens after all synchronous code in the current microtask completes.'
			},
			{
				heading: 'Architecture',
				text: 'The ChangeNotifier is a map of store names to subscriber sets. When a store mutation occurs, the store name is added to a pending set. On the next microtask, all pending stores are flushed and their subscribers notified with a "batch" event.'
			}
		]
	},
	{
		slug: 'debug-mode',
		title: 'Debug Mode',
		description: 'Enable console logging to trace all IndexedDB operations.',
		category: 'Advanced',
		order: 43,
		sections: [
			{
				heading: 'Enable debug mode',
				text: 'Set debug: true in your database configuration to log all store operations to the console.',
				code: {
					title: 'debug.ts',
					language: 'typescript',
					code: `const db = createReactiveDB({
  name: 'my-app',
  version: 1,
  debug: true, // enables logging
  stores: {
    users: { keyPath: 'id', autoIncrement: true }
  }
});

await db.users.add({ name: 'Alice' });
// Console: [svelte-idb] users.add { name: "Alice" }
// Console: [svelte-idb] users.add → key 1`
				}
			},
			{
				heading: 'What gets logged',
				apiTable: [
					{
						name: 'add(value)',
						type: 'input + key',
						description: 'Logs the value and the generated key'
					},
					{ name: 'put(value)', type: 'input + key', description: 'Logs the value and the key' },
					{ name: 'get(key)', type: 'key', description: 'Logs the key being retrieved' },
					{ name: 'getAll()', type: 'call', description: 'Logs that getAll was called' },
					{ name: 'delete(key)', type: 'key', description: 'Logs the key being deleted' },
					{ name: 'clear()', type: 'call', description: 'Logs that clear was called' },
					{ name: 'count()', type: 'call', description: 'Logs that count was called' }
				],
				note: 'Debug mode is disabled by default. Remember to turn it off in production!'
			}
		]
	},
	{
		slug: 'coming-soon',
		title: 'Coming Soon',
		description: 'Exciting new features and improvements in active development.',
		category: 'Roadmap',
		order: 100,
		sections: [
			{
				heading: 'v2 Features in Development',
				text: "We're actively working on the following features to make svelte-idb even more powerful and developer-friendly. Check back soon for updates!",
				note: 'This roadmap is subject to change based on community feedback and priorities.'
			},
			{
				heading: 'Query Builder',
				text: 'A fluent, TypeScript-safe query builder API for more expressive database queries.',
				code: {
					title: 'query-builder.ts',
					language: 'typescript',
					code: `// Coming soon
const results = await db.users
  .where('age').greaterThan(18)
  .and('status').equals('active')
  .orderBy('name')
  .limit(10)
  .toArray();`
				}
			},
			{
				heading: 'Transaction Support',
				text: 'Multi-store transactions with automatic rollback on errors for maintaining data consistency.',
				code: {
					title: 'transactions.ts',
					language: 'typescript',
					code: `// Coming soon
await db.transaction('readwrite', ['users', 'posts'], async (tx) => {
  const user = await tx.users.get(1);
  await tx.posts.add({ userId: 1, title: 'New Post' });
});`
				}
			},
			{
				heading: 'Advanced Indexing',
				text: 'Multi-key indexes, compound keys, and index optimization tools to improve query performance on large datasets.',
				apiTable: [
					{
						name: 'Multi-key indexes',
						type: 'Feature',
						description: 'Index multiple properties simultaneously for complex queries'
					},
					{
						name: 'Compound keys',
						type: 'Feature',
						description: 'Combine multiple fields into a single sortable key'
					},
					{
						name: 'Index hints',
						type: 'Feature',
						description: 'Manually optimize query execution paths'
					}
				]
			},
			{
				heading: 'Time-Travel Debugging',
				text: 'Step through database state changes with automatic snapshots and a visual timeline of mutations.',
				note: 'Perfect for development and testing workflows to understand how your data evolved.'
			},
			{
				heading: 'Full-Text Search',
				text: 'Native full-text search capabilities with ranking and highlighting for text-heavy applications.',
				code: {
					title: 'search.ts',
					language: 'typescript',
					code: `// Coming soon
const results = await db.articles.search('sveltekit database', {
  fields: ['title', 'content'],
  limit: 20,
  highlight: true
});`
				}
			},
			{
				heading: 'Export/Import',
				text: 'Easy data export to JSON or CSV formats, and import from external sources with validation.',
				code: {
					title: 'export-import.ts',
					language: 'typescript',
					code: `// Coming soon
// Export
const json = await db.export();
const csv = await db.users.exportAsCSV(['id', 'name', 'email']);

// Import
await db.import(jsonData, { merge: true });`
				}
			},
			{
				heading: 'Analytics Dashboard',
				text: 'Built-in tools to visualize database performance metrics, storage usage, and query statistics.',
				note: "Enable insights into your application's data access patterns and optimization opportunities."
			}
		]
	}
];

// ─── Helper Functions ─────────────────────────────────────────

export function getDocBySlug(slug: string): DocPage | undefined {
	return docs.find((d) => d.slug === slug);
}

export function getCategories(): DocCategory[] {
	const categoryMap = new Map<string, DocPage[]>();
	const categoryOrder = new Map<string, number>();

	for (const doc of docs) {
		if (!categoryMap.has(doc.category)) {
			categoryMap.set(doc.category, []);
			categoryOrder.set(doc.category, doc.order);
		}
		categoryMap.get(doc.category)!.push(doc);
	}

	const categories: DocCategory[] = [];
	for (const [name, pages] of categoryMap) {
		categories.push({
			name,
			order: categoryOrder.get(name)!,
			pages: pages.sort((a, b) => a.order - b.order)
		});
	}

	return categories.sort((a, b) => a.order - b.order);
}

export function getAllSlugs(): string[] {
	return docs.map((d) => d.slug);
}

export function getAdjacentDocs(slug: string): { prev?: DocPage; next?: DocPage } {
	const sorted = docs.sort((a, b) => a.order - b.order);
	const index = sorted.findIndex((d) => d.slug === slug);
	return {
		prev: index > 0 ? sorted[index - 1] : undefined,
		next: index < sorted.length - 1 ? sorted[index + 1] : undefined
	};
}
