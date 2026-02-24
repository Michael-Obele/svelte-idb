<script lang="ts">
	import { createReactiveDB } from '$lib/svelte/index.js';
	import type { ILiveQuery } from '$lib/core/types.js';
	import {
		Package,
		Zap,
		ShieldCheck,
		Sparkles,
		Braces,
		Trash2,
		CircleX,
		Heart,
		ExternalLink
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
	let selectedColor = $state('#38BDF8'); // Default sky blue

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
</script>

<svelte:head>
	<title>svelte-idb — Zero-dependency, SSR-safe IndexedDB wrapper</title>
	<meta
		name="description"
		content="Zero-dependency, SSR-safe, Svelte 5 runes-native IndexedDB wrapper"
	/>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<main class="mx-auto max-w-5xl px-6 py-16">
	<header class="mb-20 flex flex-col items-center gap-4 text-center">
		<div
			class="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-sm font-semibold text-sky-400"
		>
			v{data.npmVersion}
		</div>
		<h1
			class="bg-linear-to-br from-sky-400 to-purple-500 bg-clip-text text-6xl font-bold tracking-tight text-transparent"
		>
			svelte-idb
		</h1>
		<p class="max-w-2xl text-xl text-slate-400">
			Zero-dependency, SSR-safe, Svelte 5 runes-native IndexedDB wrapper
		</p>
		<div class="mt-6 flex gap-4">
			<a
				href="https://github.com/Michael-Obele/svelte-idb"
				class="inline-flex items-center justify-center rounded-lg bg-slate-50 px-6 py-3 text-lg font-semibold text-slate-900 transition-all hover:-translate-y-0.5 hover:bg-slate-200"
			>
				<ExternalLink size={18} class="mr-2" />
				GitHub
			</a>
			<button
				class="inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-800 px-6 py-3 text-lg font-semibold text-slate-50 transition-all hover:-translate-y-0.5 hover:border-slate-600 hover:bg-slate-700"
				onclick={copyInstall}
			>
				<Package size={18} class="mr-2" />
				{copied ? 'Copied!' : 'npm i svelte-idb'}
			</button>
		</div>
	</header>

	<section class="mb-20 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
		<div
			class="rounded-2xl border border-slate-700 bg-slate-800 p-6 transition-all hover:-translate-y-1 hover:border-slate-600"
		>
			<div
				class="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-slate-700 bg-slate-900"
			>
				<Zap size={24} class="text-sky-400" strokeWidth={2.5} />
			</div>
			<h3 class="mb-2 text-lg font-bold text-slate-50">Zero Dependencies</h3>
			<p class="text-sm leading-relaxed text-slate-400">
				Lightweight and fast. No external libraries required.
			</p>
		</div>
		<div
			class="rounded-2xl border border-slate-700 bg-slate-800 p-6 transition-all hover:-translate-y-1 hover:border-slate-600"
		>
			<div
				class="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-slate-700 bg-slate-900"
			>
				<ShieldCheck size={24} class="text-sky-400" strokeWidth={2.5} />
			</div>
			<h3 class="mb-2 text-lg font-bold text-slate-50">SSR Safe</h3>
			<p class="text-sm leading-relaxed text-slate-400">
				Works seamlessly with SvelteKit server-side rendering.
			</p>
		</div>
		<div
			class="rounded-2xl border border-slate-700 bg-slate-800 p-6 transition-all hover:-translate-y-1 hover:border-slate-600"
		>
			<div
				class="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-slate-700 bg-slate-900"
			>
				<Sparkles size={24} class="text-sky-400" strokeWidth={2.5} />
			</div>
			<h3 class="mb-2 text-lg font-bold text-slate-50">Svelte 5 Runes</h3>
			<p class="text-sm leading-relaxed text-slate-400">
				Native reactivity using $state and $effect under the hood.
			</p>
		</div>
		<div
			class="rounded-2xl border border-slate-700 bg-slate-800 p-6 transition-all hover:-translate-y-1 hover:border-slate-600"
		>
			<div
				class="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-slate-700 bg-slate-900"
			>
				<Braces size={24} class="text-sky-400" strokeWidth={2.5} />
			</div>
			<h3 class="mb-2 text-lg font-bold text-slate-50">TypeScript</h3>
			<p class="text-sm leading-relaxed text-slate-400">
				Fully typed schema and queries for excellent developer experience.
			</p>
		</div>
	</section>

	<section class="mb-20">
		<div class="mb-8 flex items-center justify-between">
			<h2 class="text-2xl font-bold">Interactive Demo: Notes</h2>
			<div class="flex items-center gap-4">
				<div
					class="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-sm text-slate-400"
				>
					<strong class="text-sky-400">{totalCount.current}</strong> notes
				</div>
				{#if totalCount.current > 0}
					<button
						class="flex items-center gap-1 rounded-full border border-red-900 bg-transparent px-3 py-1 text-sm text-red-500 transition-all hover:bg-red-950"
						onclick={clearAll}
					>
						<CircleX size={14} />
						Clear All
					</button>
				{/if}
			</div>
		</div>

		<div class="grid grid-cols-1 items-start gap-8 md:grid-cols-[300px_1fr]">
			<form
				class="sticky top-8 flex flex-col gap-4 rounded-2xl border border-slate-700 bg-slate-800 p-6 shadow-xl"
				onsubmit={addNote}
			>
				<h3 class="text-lg font-bold">New Note</h3>
				<input
					type="text"
					bind:value={newTitle}
					placeholder="Title"
					class="rounded-lg border border-slate-700 bg-slate-900 p-3 text-slate-50 focus:border-sky-400 focus:ring-2 focus:ring-sky-500/20 focus:outline-none"
				/>
				<textarea
					bind:value={newContent}
					placeholder="Take a note..."
					rows="4"
					class="rounded-lg border border-slate-700 bg-slate-900 p-3 text-slate-50 focus:border-sky-400 focus:ring-2 focus:ring-sky-500/20 focus:outline-none"
				></textarea>
				<div class="flex gap-2">
					{#each colors as color (color)}
						<button
							type="button"
							class="h-8 w-8 rounded-full border-2 border-transparent transition-transform hover:scale-110"
							class:!border-slate-50={selectedColor === color}
							class:scale-110={selectedColor === color}
							style="background-color: {color}"
							onclick={() => (selectedColor = color)}
							aria-label="Select color {color}"
						></button>
					{/each}
				</div>
				<button
					type="submit"
					class="w-full rounded-lg bg-slate-50 py-3 font-bold text-slate-900 transition-all hover:bg-slate-200 active:scale-[0.98]"
				>
					Add Note
				</button>
			</form>

			<div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
				{#if notes.loading}
					<div
						class="col-span-full rounded-2xl border border-dashed border-slate-700 bg-slate-800 p-12 text-center text-slate-400"
					>
						Loading notes...
					</div>
				{:else if notes.error}
					<div
						class="col-span-full rounded-2xl border border-dashed border-red-900 bg-slate-800 p-12 text-center text-red-500"
					>
						Error: {notes.error.message}
					</div>
				{:else if notes.current.length === 0}
					<div
						class="col-span-full rounded-2xl border border-dashed border-slate-700 bg-slate-800 p-12 text-center text-slate-400"
					>
						No notes yet. Create one!
					</div>
				{:else}
					{#each notes.current as note (note.id)}
						<div
							class="flex flex-col gap-3 rounded-xl border border-t-4 border-slate-700 bg-slate-800 p-5 transition-all hover:-translate-y-1 hover:shadow-lg"
							style="border-top-color: {note.color}"
						>
							<div class="flex items-start justify-between">
								<h4 class="text-lg font-bold wrap-break-word">{note.title}</h4>
								<button
									class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-all hover:bg-slate-700 hover:text-red-500"
									onclick={() => deleteNote(note.id!)}
									aria-label="Delete note"
								>
									<Trash2 size={16} />
								</button>
							</div>
							<p class="grow text-sm wrap-break-word whitespace-pre-wrap text-slate-300">
								{note.content}
							</p>
							<span class="text-xs text-slate-500"
								>{new Date(note.createdAt).toLocaleDateString()}</span
							>
						</div>
					{/each}
				{/if}
			</div>
		</div>
	</section>

	<section class="mb-20">
		<h2 class="mb-6 text-2xl font-bold">Simple API</h2>
		<div class="overflow-hidden rounded-2xl border border-slate-700 bg-slate-800 shadow-2xl">
			<div class="flex items-center gap-2 border-b border-slate-700 bg-slate-900 px-4 py-3">
				<span class="h-3 w-3 rounded-full bg-red-500"></span>
				<span class="h-3 w-3 rounded-full bg-amber-500"></span>
				<span class="h-3 w-3 rounded-full bg-emerald-500"></span>
				<span class="ml-4 font-mono text-sm text-slate-400">app.ts</span>
			</div>
			<div class="p-6">
				<pre class="overflow-x-auto"><code class="font-mono text-sm leading-relaxed text-slate-200"
						>{`import { createReactiveDB } from 'svelte-idb/svelte';

const db = createReactiveDB({
  name: 'my-app',
  version: 1,
  stores: {
    notes: { keyPath: 'id', autoIncrement: true }
  }
});

// Reactive — auto-updates on mutations
const notes = db.notes.liveAll();

await db.notes.add({ title: 'Hello', content: 'World' });
// notes.current updates automatically!`}</code
					></pre>
			</div>
		</div>
	</section>

	<footer
		class="mt-20 flex items-center justify-center gap-1 border-t border-slate-800 py-8 text-sm text-slate-500"
	>
		Built with <Heart size={14} class="fill-red-500 text-red-500" /> for the Svelte community.
	</footer>
</main>
