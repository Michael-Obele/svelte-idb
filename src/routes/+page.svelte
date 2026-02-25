<script lang="ts">
	import { createReactiveDB } from '$lib/svelte/index.js';
	import type { ILiveQuery } from '$lib/core/types.js';
	import { Button } from '$ui/components/ui/button/index.js';
	import { Badge } from '$ui/components/ui/badge/index.js';
	import { Input } from '$ui/components/ui/input/index.js';
	import { Textarea } from '$ui/components/ui/textarea/index.js';
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
	import { cn } from '$ui/utils.js';
	import { slide, scale, fade } from 'svelte/transition';
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
		Eye,
		Search,
		PenTool,
		Pin,
		PinOff,
		LayoutGrid
	} from '@lucide/svelte';

	let { data } = $props();

	interface Note {
		id?: number;
		title: string;
		content: string;
		color: string;
		pinned?: boolean;
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

	// App State
	let searchQuery = $state('');
	let isFocused = $state(false);

	// Form State
	let newTitle = $state('');
	let newContent = $state('');
	let selectedColor = $state('#38BDF8');
	let isNewPinned = $state(false);

	const colors = [
		{ value: '#38BDF8', label: 'Idea' },
		{ value: '#F97316', label: 'Work' },
		{ value: '#22C55E', label: 'Personal' },
		{ value: '#A855F7', label: 'Journal' },
		{ value: '#EC4899', label: 'Important' }
	];

	// Derived State
	const filteredNotes = $derived(
		(notes.current || [])
			.filter((note) => {
				if (!searchQuery) return true;
				const q = searchQuery.toLowerCase();
				return note.title?.toLowerCase().includes(q) || note.content?.toLowerCase().includes(q);
			})
			.sort((a, b) => {
				// Sort by pinned (true first), then by date (newest first)
				if (a.pinned === b.pinned) {
					return b.createdAt - a.createdAt;
				}
				return a.pinned ? -1 : 1;
			})
	);

	async function addNote(e?: Event) {
		if (e) e.preventDefault();
		const title = newTitle.trim();
		const content = newContent.trim();
		if (!title && !content) return;

		await db.notes.add({
			title: title || '',
			content,
			color: selectedColor,
			pinned: isNewPinned,
			createdAt: Date.now()
		});

		newTitle = '';
		newContent = '';
		isNewPinned = false;
		isFocused = false;
	}

	async function togglePin(note: Note) {
		if (note.id === undefined) return;
		// Create a copy to update
		const updated = { ...note, pinned: !note.pinned };
		await db.notes.put(updated);
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

		<div class="relative mt-2">
			<div class="absolute -inset-4 z-0 rounded-full bg-sky-500/20 blur-2xl"></div>
			<img
				src="/favicon-database.svg"
				alt="svelte-idb logo"
				class="relative z-10 h-24 w-24 drop-shadow-2xl md:h-28 md:w-28"
			/>
		</div>

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
	<section class="relative mb-24 scroll-mt-20" id="demo">
		<!-- Background glow -->
		<div
			class="pointer-events-none absolute top-1/2 left-1/2 -z-10 size-125 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-500/5 blur-[120px]"
		></div>

		<div class="mb-12 flex flex-col items-center gap-4 text-center">
			<Badge
				variant="outline"
				class="border-sky-500/20 bg-sky-500/5 px-4 py-1.5 text-sky-400 backdrop-blur-md"
			>
				Live Demonstration
			</Badge>
			<h2 class="text-3xl font-bold tracking-tight text-slate-100 sm:text-4xl">
				Interactive Playground
			</h2>
			<p class="max-w-lg text-slate-500">
				Data persists securely in your local browser's IndexedDB. Experience zero-latency reactivity
				with a fully functional note-taking app.
			</p>
		</div>

		<!-- ─── Interactive Demo — Redesigned ─── -->
		<div
			class="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900/60 shadow-2xl ring-1 ring-slate-800 backdrop-blur-3xl"
		>
			<!-- ─── Dashboard Header ─── -->
			<div
				class="sticky top-0 z-20 flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-6 py-3 backdrop-blur-md"
			>
				<div class="flex items-center gap-3">
					<div
						class="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400 ring-1 ring-sky-500/20"
					>
						<Sparkles size={16} />
					</div>
					<div>
						<h3 class="text-sm font-semibold text-slate-200">My Notes</h3>
					</div>
				</div>

				<div class="flex items-center gap-3">
					<div class="relative w-48 md:w-64">
						<Search class="absolute top-1/2 left-2.5 -translate-y-1/2 text-slate-500" size={14} />
						<Input
							type="text"
							placeholder="Search..."
							bind:value={searchQuery}
							class="h-8 rounded-md border-slate-800 bg-slate-900 pl-8 text-xs text-slate-300 placeholder:text-slate-600 focus:border-sky-500/40 focus:ring-sky-500/20"
						/>
					</div>
					<Badge
						variant="outline"
						class="h-8 border-slate-800 bg-slate-900 font-mono text-xs text-slate-400"
					>
						{filteredNotes.length}
					</Badge>
				</div>
			</div>

			<div class="min-h-125 bg-slate-950/30 p-6">
				<!-- ─── Quick Add Bar ─── -->
				<div class="mx-auto mb-8 max-w-xl">
					<div
						class={cn(
							'group relative overflow-hidden rounded-xl border bg-slate-900 shadow-lg transition-all duration-300',
							isFocused
								? 'border-sky-500/40 ring-4 ring-sky-500/10'
								: 'border-slate-800 hover:border-slate-700'
						)}
					>
						<form onsubmit={addNote} class="relative z-10">
							{#if !isFocused && !newContent && !newTitle}
								<div
									class="absolute inset-0 flex cursor-text items-center px-4 text-sm font-medium text-slate-500"
									onclick={() => (isFocused = true)}
									aria-hidden="true"
								>
									Take a note...
								</div>
							{/if}

							{#if isFocused || newTitle || newContent}
								<input
									type="text"
									bind:value={newTitle}
									placeholder="Title"
									class="w-full bg-transparent px-4 py-3 text-base font-medium text-slate-200 placeholder:text-slate-600 focus:outline-none"
									onfocus={() => (isFocused = true)}
								/>
							{/if}

							<textarea
								bind:value={newContent}
								placeholder={isFocused ? 'Take a note...' : ''}
								rows={isFocused ? 3 : 1}
								class={cn(
									'w-full resize-none bg-transparent px-4 text-sm leading-relaxed text-slate-300 placeholder:text-slate-500 focus:outline-none',
									isFocused ? 'pb-3' : 'min-h-11.5 py-3'
								)}
								onfocus={() => (isFocused = true)}
								onblur={() => {
									if (!newTitle && !newContent) isFocused = false;
								}}
							></textarea>

							{#if isFocused || newTitle || newContent}
								<div
									in:slide={{ duration: 150 }}
									class="flex items-center justify-between border-t border-slate-800 bg-slate-900/50 px-3 py-2"
								>
									<div class="flex items-center gap-4">
										<div class="flex gap-1">
											{#each colors as color (color.value)}
												<button
													type="button"
													class={cn(
														'group flex h-6 w-6 items-center justify-center rounded-full transition-all hover:scale-110',
														selectedColor === color.value &&
															'ring-2 ring-slate-400 ring-offset-2 ring-offset-slate-900'
													)}
													onclick={() => (selectedColor = color.value)}
													title={color.label}
												>
													<div
														class="h-4 w-4 rounded-full border border-white/10 shadow-sm"
														style="background-color: {color.value}"
													></div>
												</button>
											{/each}
										</div>
										<button
											type="button"
											class={cn(
												'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors',
												isNewPinned
													? 'bg-sky-500/10 text-sky-400'
													: 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'
											)}
											onclick={() => (isNewPinned = !isNewPinned)}
										>
											<Pin size={12} class={isNewPinned ? 'fill-current' : ''} />
											{isNewPinned ? 'Pinned' : 'Pin'}
										</button>
									</div>

									<div class="flex items-center gap-2">
										<Button
											type="button"
											variant="ghost"
											size="sm"
											class="h-7 px-3 text-xs text-slate-400 hover:text-slate-200"
											onclick={() => {
												isFocused = false;
												newTitle = '';
												newContent = '';
											}}
										>
											Close
										</Button>
										<Button
											type="submit"
											size="sm"
											class="h-7 gap-1.5 rounded-md bg-sky-600 px-4 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-50"
											disabled={!newContent.trim() && !newTitle.trim()}
										>
											Add Note
										</Button>
									</div>
								</div>
							{/if}
						</form>
					</div>
				</div>

				<!-- ─── Notes Grid ─── -->
				{#if notes.loading}
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{#each Array(6) as _}
							<div
								class="h-40 animate-pulse rounded-xl border border-slate-800 bg-slate-800/20"
							></div>
						{/each}
					</div>
				{:else if filteredNotes.length === 0}
					<div class="flex flex-col items-center justify-center py-20 text-center opacity-60">
						<div class="mb-4 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
							{#if searchQuery}
								<Search size={24} class="text-slate-600" />
							{:else}
								<LayoutGrid size={24} class="text-slate-600" />
							{/if}
						</div>
						<p class="text-base font-medium text-slate-400">
							{searchQuery
								? `No notes matching "${searchQuery}"`
								: 'Your personal knowledge base is empty'}
						</p>
						<p class="mt-1 text-xs text-slate-600">
							{searchQuery ? 'Try a different keyword' : 'Start by adding a quick note above'}
						</p>
					</div>
				{:else}
					<div class="columns-1 gap-4 space-y-4 sm:columns-2 lg:columns-3">
						{#each filteredNotes as note (note.id)}
							<div
								in:scale={{ duration: 200, start: 0.98 }}
								class={cn(
									'group break-inside-avoid overflow-hidden rounded-xl border bg-slate-900/80 shadow-sm backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md',
									note.pinned
										? 'border-sky-500/20 shadow-sky-500/5'
										: 'border-slate-800 hover:border-slate-700'
								)}
							>
								<!-- Label Stripe -->
								<div
									class="h-1 w-full"
									style="background-color: {note.color}; opacity: {note.pinned ? 0.8 : 0.5}"
								></div>

								<div class="p-4">
									<div class="mb-3 flex items-start justify-between gap-3">
										<h4 class="line-clamp-1 text-sm font-semibold text-slate-200">
											{#if note.title}
												<!-- Search Highlighting -->
												{#if searchQuery}
													{@const parts = note.title.split(new RegExp(`(${searchQuery})`, 'gi'))}
													{#each parts as part}
														{#if part.toLowerCase() === searchQuery.toLowerCase()}
															<span class="rounded-[2px] bg-yellow-500/20 text-yellow-200"
																>{part}</span
															>
														{:else}
															{part}
														{/if}
													{/each}
												{:else}
													{note.title}
												{/if}
											{:else}
												<span class="text-slate-600 italic">Untitled</span>
											{/if}
										</h4>

										<!-- Actions (Visible on Hover) -->
										<div
											class="-mt-1 -mr-2 flex items-center opacity-0 transition-opacity group-hover:opacity-100"
										>
											<button
												class={cn(
													'rounded-md p-1.5 transition-colors',
													note.pinned
														? 'text-sky-400 hover:bg-sky-500/10'
														: 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'
												)}
												onclick={() => togglePin(note)}
												title={note.pinned ? 'Unpin' : 'Pin'}
											>
												<Pin size={13} class={note.pinned ? 'fill-current' : ''} />
											</button>
											<button
												class="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
												onclick={() => deleteNote(note.id!)}
												title="Delete"
											>
												<Trash2 size={13} />
											</button>
										</div>
									</div>

									<p class="text-xs leading-relaxed whitespace-pre-wrap text-slate-400">
										{#if searchQuery && note.content}
											{@const parts = note.content.split(new RegExp(`(${searchQuery})`, 'gi'))}
											{#each parts as part}
												{#if part.toLowerCase() === searchQuery.toLowerCase()}
													<span class="rounded-[2px] bg-yellow-500/20 text-yellow-200">{part}</span>
												{:else}
													{part}
												{/if}
											{/each}
										{:else}
											{note.content}
										{/if}
									</p>

									<div class="mt-4 flex items-center justify-between">
										<Badge
											variant="secondary"
											class="h-5 border-none bg-slate-800 px-1.5 text-[10px] text-slate-500"
										>
											{colors.find((c) => c.value === note.color)?.label}
										</Badge>
										<span class="font-mono text-[10px] text-slate-600">
											{new Date(note.createdAt).toLocaleDateString(undefined, {
												month: 'short',
												day: 'numeric'
											})}
										</span>
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Footer Stats -->
			{#if (notes.current || []).length > 0}
				<div class="flex justify-end border-t border-slate-800 bg-slate-950/60 px-4 py-2">
					<button
						class="flex items-center gap-1.5 text-[10px] font-medium text-slate-600 opacity-60 transition-colors hover:text-red-400 hover:opacity-100"
						onclick={clearAll}
					>
						<Trash2 size={10} />
						Clear All
					</button>
				</div>
			{/if}
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
