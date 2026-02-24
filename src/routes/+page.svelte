<script lang="ts">
	import { createReactiveDB } from '$lib/svelte/index.js';
	import type { ILiveQuery } from '$lib/core/types.js';
	import { Button } from '$ui/components/ui/button/index.js';
	import { Badge } from '$ui/components/ui/badge/index.js';
	import {
		Card,
		CardContent,
		CardHeader,
		CardTitle,
		CardDescription
	} from '$ui/components/ui/card/index.js';
	import { Separator } from '$ui/components/ui/separator/index.js';
	import { Tabs, TabsContent, TabsList, TabsTrigger } from '$ui/components/ui/tabs/index.js';
	import CodeBlockShiki from 'shiki-block-svelte';
	import {
		Zap,
		ShieldCheck,
		Sparkles,
		Braces,
		Trash2,
		CircleX,
		Heart,
		ExternalLink,
		BookOpen,
		ArrowRight,
		Copy,
		Check,
		Database,
		RefreshCw,
		Eye
	} from '@lucide/svelte';

	let { data } = $props();

	interface Note {
		id?: number;
		title: string;
		content: string;
		color: string;
		createdAt: number;
	}

	const db = createReactiveDB({
		name: 'svelte-idb-demo-notes',
		version: 1,
		debug: true,
		stores: {
			notes: {
				keyPath: 'id',
				autoIncrement: true
			}
		}
	});

	const notes = db.notes.liveAll() as unknown as ILiveQuery<Note[]>;
	const totalCount = db.notes.liveCount();

	let newTitle = $state('');
	let newContent = $state('');
	let selectedColor = $state('#38BDF8');

	const colors = ['#38BDF8', '#F97316', '#22C55E', '#A855F7', '#EC4899'];

	async function addNote(e: Event) {
		e.preventDefault();
		const title = newTitle.trim();
		const content = newContent.trim();
		if (!title && !content) return;

		await db.notes.add({
			title: title || 'Untitled',
			content,
			color: selectedColor,
			createdAt: Date.now()
		});

		newTitle = '';
		newContent = '';
	}

	async function deleteNote(id: number) {
		await db.notes.delete(id);
	}

	async function clearAll() {
		await db.notes.clear();
	}

	let copied = $state(false);
	function copyInstall() {
		navigator.clipboard.writeText('npm i svelte-idb');
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}

	const features = [
		{
			icon: Zap,
			title: 'Zero Dependencies',
			description: 'Lightweight and fast. No external runtime libraries required.'
		},
		{
			icon: ShieldCheck,
			title: 'SSR Safe',
			description: 'Works seamlessly with SvelteKit server-side rendering out of the box.'
		},
		{
			icon: Sparkles,
			title: 'Svelte 5 Runes',
			description: 'Native reactivity using $state and $effect under the hood.'
		},
		{
			icon: Braces,
			title: 'Fully Typed',
			description: 'Complete TypeScript support with generic schema inference.'
		},
		{
			icon: RefreshCw,
			title: 'Live Queries',
			description: 'Auto-updating queries with microtask batching for performance.'
		},
		{
			icon: Database,
			title: 'Schema Migrations',
			description: 'Declarative schema with versioned upgrades and custom migrations.'
		}
	];

	const codeReactive = `import { createReactiveDB } from 'svelte-idb/svelte';

const db = createReactiveDB({
  name: 'my-app',
  version: 1,
  stores: {
    todos: { keyPath: 'id', autoIncrement: true }
  }
});

// Live queries — auto-update on mutations
const todos = db.todos.liveAll();
const count = db.todos.liveCount();

await db.todos.add({ text: 'Hello', done: false });
// todos.current & count.current update automatically!`;

	const codeCore = `import { createDB } from 'svelte-idb';

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
    }
  }
});

await db.users.add({ name: 'Alice', email: 'alice@example.com' });
const user = await db.users.get(1);
const all = await db.users.getAll();`;

	const codeSchema = `import { createReactiveDB } from 'svelte-idb/svelte';

// Full schema with indexes and migrations
const db = createReactiveDB({
  name: 'blog',
  version: 2,
  debug: true,
  stores: {
    posts: {
      keyPath: 'id',
      autoIncrement: true,
      indexes: {
        byAuthor: { keyPath: 'authorId' },
        bySlug: { keyPath: 'slug', unique: true }
      }
    },
    comments: {
      keyPath: 'id',
      autoIncrement: true,
      indexes: {
        byPost: { keyPath: 'postId' }
      }
    }
  },
  onUpgrade(db, oldVersion) {
    if (oldVersion < 2) {
      // Custom migration logic
    }
  }
});`;
</script>

<svelte:head>
	<title>svelte-idb — Zero-dependency, SSR-safe IndexedDB wrapper for Svelte 5</title>
	<meta
		name="description"
		content="Zero-dependency, SSR-safe, Svelte 5 runes-native IndexedDB wrapper with live queries and TypeScript support."
	/>
	<meta property="og:title" content="svelte-idb — Zero-dependency IndexedDB wrapper for Svelte 5" />
	<meta
		property="og:description"
		content="Build Svelte apps with powerful, type-safe IndexedDB support. Live queries, reactive updates, and TypeScript."
	/>
	<meta property="og:type" content="website" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="svelte-idb" />
	<meta
		name="twitter:description"
		content="A modern IndexedDB wrapper for Svelte 5 with live reactive queries and zero dependencies."
	/>
	<meta
		name="keywords"
		content="IndexedDB, Svelte, SvelteKit, database, TypeScript, runes, browser storage"
	/>
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<link rel="canonical" href="https://idb.svelte-apps.me" />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<main class="mx-auto max-w-6xl px-6 py-16">
	<!-- ═══ HERO ═══ -->
	<header class="mb-24 flex flex-col items-center gap-5 text-center">
		<Badge variant="secondary" class="border-sky-500/20 bg-sky-500/10 text-sky-400">
			v{data.npmVersion} — Now Available
		</Badge>

		<h1
			class="max-w-3xl bg-linear-to-br from-slate-100 via-sky-400 to-purple-500 bg-clip-text text-6xl font-bold tracking-tight text-transparent md:text-7xl"
		>
			svelte-idb
		</h1>
		<p class="max-w-2xl text-xl leading-relaxed text-slate-400">
			Zero-dependency, SSR-safe IndexedDB wrapper built for
			<span class="font-semibold text-slate-200">Svelte 5 runes</span>. Live queries that update
			automatically.
		</p>

		<div class="mt-6 flex flex-wrap items-center justify-center gap-3">
			<a href="/docs/installation">
				<Button size="lg" class="gap-2 bg-sky-500 text-slate-950 hover:bg-sky-400">
					<BookOpen size={18} />
					Documentation
					<ArrowRight size={16} />
				</Button>
			</a>
			<a href="https://github.com/Michael-Obele/svelte-idb" target="_blank" rel="noopener">
				<Button
					variant="outline"
					size="lg"
					class="gap-2 border-slate-700 text-slate-200 hover:border-slate-500 hover:bg-slate-800"
				>
					<ExternalLink size={18} />
					GitHub
				</Button>
			</a>
			<Button
				variant="secondary"
				size="lg"
				class="gap-2 border-slate-700 bg-slate-800 font-mono text-slate-200 hover:bg-slate-700"
				onclick={copyInstall}
			>
				{#if copied}
					<Check size={16} class="text-emerald-400" />
					Copied!
				{:else}
					<Copy size={16} />
					npm i svelte-idb
				{/if}
			</Button>
		</div>
	</header>

	<!-- ═══ FEATURES ═══ -->
	<section class="mb-24">
		<div class="mb-10 text-center">
			<h2 class="mb-2 text-3xl font-bold text-slate-100">Why svelte-idb?</h2>
			<p class="text-slate-500">Everything you need for client-side persistence in Svelte.</p>
		</div>
		<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
			{#each features as feature (feature.title)}
				<Card
					class="border-slate-700/50 bg-slate-800/50 transition-all hover:-translate-y-0.5 hover:border-slate-600 hover:bg-slate-800/80"
				>
					<CardHeader class="pb-3">
						<div
							class="mb-2 flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700/50 bg-slate-900/80"
						>
							<feature.icon size={20} class="text-sky-400" strokeWidth={2} />
						</div>
						<CardTitle class="text-base text-slate-100">{feature.title}</CardTitle>
					</CardHeader>
					<CardContent>
						<CardDescription class="text-slate-400">{feature.description}</CardDescription>
					</CardContent>
				</Card>
			{/each}
		</div>
	</section>

	<!-- ═══ CODE EXAMPLES ═══ -->
	<section class="mb-24">
		<div class="mb-10 text-center">
			<h2 class="mb-2 text-3xl font-bold text-slate-100">Simple, Powerful API</h2>
			<p class="text-slate-500">Get started in seconds. Scale to complex use cases.</p>
		</div>

		<Tabs value="reactive" class="w-full">
			<TabsList class="mb-6 w-full justify-start border-b border-slate-700/50 bg-transparent p-0">
				<TabsTrigger
					value="reactive"
					class="rounded-none border-b-2 border-transparent bg-transparent px-4 py-3 text-slate-400 data-[state=active]:border-sky-400 data-[state=active]:bg-transparent data-[state=active]:text-sky-400 data-[state=active]:shadow-none"
				>
					<Eye size={14} class="mr-2" />
					Reactive
				</TabsTrigger>
				<TabsTrigger
					value="core"
					class="rounded-none border-b-2 border-transparent bg-transparent px-4 py-3 text-slate-400 data-[state=active]:border-sky-400 data-[state=active]:bg-transparent data-[state=active]:text-sky-400 data-[state=active]:shadow-none"
				>
					<Database size={14} class="mr-2" />
					Core
				</TabsTrigger>
				<TabsTrigger
					value="schema"
					class="rounded-none border-b-2 border-transparent bg-transparent px-4 py-3 text-slate-400 data-[state=active]:border-sky-400 data-[state=active]:bg-transparent data-[state=active]:text-sky-400 data-[state=active]:shadow-none"
				>
					<Braces size={14} class="mr-2" />
					Schema
				</TabsTrigger>
			</TabsList>

			<TabsContent value="reactive">
				<div
					class="overflow-hidden rounded-xl border border-slate-700/50 bg-slate-900/80 shadow-2xl"
				>
					<div class="flex items-center gap-2 border-b border-slate-700/50 bg-slate-900 px-4 py-3">
						<span class="h-3 w-3 rounded-full bg-red-500/80"></span>
						<span class="h-3 w-3 rounded-full bg-amber-500/80"></span>
						<span class="h-3 w-3 rounded-full bg-emerald-500/80"></span>
						<span class="ml-4 font-mono text-xs text-slate-500">+page.svelte</span>
					</div>
					<div class="shiki-wrapper overflow-x-auto p-6">
						<CodeBlockShiki lang="typescript" theme="github-dark" code={codeReactive} />
					</div>
				</div>
			</TabsContent>

			<TabsContent value="core">
				<div
					class="overflow-hidden rounded-xl border border-slate-700/50 bg-slate-900/80 shadow-2xl"
				>
					<div class="flex items-center gap-2 border-b border-slate-700/50 bg-slate-900 px-4 py-3">
						<span class="h-3 w-3 rounded-full bg-red-500/80"></span>
						<span class="h-3 w-3 rounded-full bg-amber-500/80"></span>
						<span class="h-3 w-3 rounded-full bg-emerald-500/80"></span>
						<span class="ml-4 font-mono text-xs text-slate-500">database.ts</span>
					</div>
					<div class="shiki-wrapper overflow-x-auto p-6">
						<CodeBlockShiki lang="typescript" theme="github-dark" code={codeCore} />
					</div>
				</div>
			</TabsContent>

			<TabsContent value="schema">
				<div
					class="overflow-hidden rounded-xl border border-slate-700/50 bg-slate-900/80 shadow-2xl"
				>
					<div class="flex items-center gap-2 border-b border-slate-700/50 bg-slate-900 px-4 py-3">
						<span class="h-3 w-3 rounded-full bg-red-500/80"></span>
						<span class="h-3 w-3 rounded-full bg-amber-500/80"></span>
						<span class="h-3 w-3 rounded-full bg-emerald-500/80"></span>
						<span class="ml-4 font-mono text-xs text-slate-500">schema.ts</span>
					</div>
					<div class="shiki-wrapper overflow-x-auto p-6">
						<CodeBlockShiki lang="typescript" theme="github-dark" code={codeSchema} />
					</div>
				</div>
			</TabsContent>
		</Tabs>

		<div class="mt-6 text-center">
			<a href="/docs/quick-start">
				<Button variant="link" class="gap-2 text-sky-400 hover:text-sky-300">
					See full examples in the docs
					<ArrowRight size={14} />
				</Button>
			</a>
		</div>
	</section>

	<!-- ═══ INTERACTIVE DEMO ═══ -->
	<section class="mb-24">
		<div class="mb-8 flex items-center justify-between">
			<div>
				<h2 class="text-2xl font-bold text-slate-100">Interactive Demo</h2>
				<p class="mt-1 text-sm text-slate-500">
					Try it live — data persists in your browser's IndexedDB
				</p>
			</div>
			<div class="flex items-center gap-3">
				<Badge variant="outline" class="border-slate-700 text-slate-400">
					<strong class="mr-1 text-sky-400">{totalCount.current}</strong> notes
				</Badge>
				{#if totalCount.current > 0}
					<Button
						variant="ghost"
						size="sm"
						class="gap-1.5 text-red-400 hover:bg-red-500/10 hover:text-red-300"
						onclick={clearAll}
					>
						<CircleX size={14} />
						Clear All
					</Button>
				{/if}
			</div>
		</div>

		<div class="grid grid-cols-1 items-start gap-6 md:grid-cols-[320px_1fr]">
			<form
				class="sticky top-8 flex flex-col gap-4 rounded-xl border border-slate-700/50 bg-slate-800/50 p-5"
				onsubmit={addNote}
			>
				<h3 class="text-base font-semibold text-slate-200">New Note</h3>
				<input
					type="text"
					bind:value={newTitle}
					placeholder="Title"
					class="rounded-lg border border-slate-700/50 bg-slate-900/80 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-sky-500/50 focus:ring-2 focus:ring-sky-500/20 focus:outline-none"
				/>
				<textarea
					bind:value={newContent}
					placeholder="Take a note..."
					rows="3"
					class="rounded-lg border border-slate-700/50 bg-slate-900/80 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-sky-500/50 focus:ring-2 focus:ring-sky-500/20 focus:outline-none"
				></textarea>
				<div class="flex gap-2">
					{#each colors as color (color)}
						<button
							type="button"
							class="h-7 w-7 cursor-pointer rounded-full border-2 border-transparent transition-transform hover:scale-110"
							class:!border-slate-50={selectedColor === color}
							class:scale-110={selectedColor === color}
							style="background-color: {color}"
							onclick={() => (selectedColor = color)}
							aria-label="Select color {color}"
						></button>
					{/each}
				</div>
				<Button
					type="submit"
					class="w-full bg-sky-500 font-semibold text-slate-950 hover:bg-sky-400"
				>
					Add Note
				</Button>
			</form>

			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				{#if notes.loading}
					<div
						class="col-span-full rounded-xl border border-dashed border-slate-700/50 bg-slate-800/30 p-10 text-center text-slate-500"
					>
						Loading notes...
					</div>
				{:else if notes.error}
					<div
						class="col-span-full rounded-xl border border-dashed border-red-900/50 bg-red-950/20 p-10 text-center text-red-400"
					>
						Error: {notes.error.message}
					</div>
				{:else if notes.current.length === 0}
					<div
						class="col-span-full rounded-xl border border-dashed border-slate-700/50 bg-slate-800/30 p-10 text-center text-slate-500"
					>
						No notes yet. Create one to see live queries in action!
					</div>
				{:else}
					{#each notes.current as note (note.id)}
						<div
							class="flex flex-col gap-2 rounded-xl border border-t-4 border-slate-700/50 bg-slate-800/50 p-4 transition-all hover:-translate-y-0.5 hover:bg-slate-800/80 hover:shadow-lg"
							style="border-top-color: {note.color}"
						>
							<div class="flex items-start justify-between">
								<h4 class="text-sm font-semibold wrap-break-word text-slate-200">{note.title}</h4>
								<button
									class="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-slate-600 transition-all hover:bg-slate-700 hover:text-red-400"
									onclick={() => deleteNote(note.id!)}
									aria-label="Delete note"
								>
									<Trash2 size={14} />
								</button>
							</div>
							{#if note.content}
								<p class="grow text-xs wrap-break-word whitespace-pre-wrap text-slate-400">
									{note.content}
								</p>
							{/if}
							<span class="text-[10px] text-slate-600"
								>{new Date(note.createdAt).toLocaleDateString()}</span
							>
						</div>
					{/each}
				{/if}
			</div>
		</div>
	</section>

	<!-- ═══ CTA ═══ -->
	<section
		class="mb-16 rounded-2xl border border-slate-700/50 bg-linear-to-br from-slate-800/80 to-slate-900/80 p-10 text-center"
	>
		<h2 class="mb-3 text-2xl font-bold text-slate-100">Ready to get started?</h2>
		<p class="mb-6 text-slate-400">
			Read the docs, explore examples, and start building with svelte-idb.
		</p>
		<div class="flex flex-wrap items-center justify-center gap-3">
			<a href="/docs/installation">
				<Button size="lg" class="gap-2 bg-sky-500 text-slate-950 hover:bg-sky-400">
					<BookOpen size={18} />
					Read the Docs
				</Button>
			</a>
			<a href="/docs/quick-start">
				<Button
					variant="outline"
					size="lg"
					class="gap-2 border-slate-600 text-slate-200 hover:bg-slate-800"
				>
					Quick Start Guide
					<ArrowRight size={16} />
				</Button>
			</a>
		</div>
	</section>

	<!-- ═══ FOOTER ═══ -->
	<footer
		class="flex items-center justify-center gap-1 border-t border-slate-800 py-8 text-sm text-slate-600"
	>
		Built with <Heart size={14} class="fill-red-500 text-red-500" /> for the Svelte community.
	</footer>
</main>

<style>
	.shiki-wrapper :global(pre) {
		margin: 0;
		padding: 0;
		background: transparent !important;
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.875rem;
		line-height: 1.625;
	}
	.shiki-wrapper :global(code) {
		font-family: 'JetBrains Mono', monospace;
	}
	.shiki-wrapper :global(.shiki) {
		background: transparent !important;
	}
</style>
