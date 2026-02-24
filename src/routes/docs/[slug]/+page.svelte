<script lang="ts">
	import { Badge } from '$ui/components/ui/badge/index.js';
	import { Separator } from '$ui/components/ui/separator/index.js';
	import { Button } from '$ui/components/ui/button/index.js';
	import CodeBlock from '$components/code-block.svelte';
	import ApiTable from '$components/api-table.svelte';
	import { ArrowLeft, ArrowRight, Info } from '@lucide/svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>{data.doc.title} — svelte-idb docs</title>
	<meta name="description" content={data.doc.description} />
	<meta property="og:title" content={data.doc.title} />
	<meta property="og:description" content={data.doc.description} />
	<meta property="og:type" content="article" />
	<meta property="og:site_name" content="svelte-idb Documentation" />
	<meta name="twitter:card" content="summary" />
	<meta name="twitter:title" content={data.doc.title} />
	<meta name="twitter:description" content={data.doc.description} />
	<meta name="keywords" content="IndexedDB, Svelte, SvelteKit, database, tutorial, docs" />
</svelte:head>

<article class="animate-in duration-300 fade-in">
	<!-- Header -->
	<header class="mb-10">
		<Badge variant="secondary" class="mb-3 border-sky-500/20 bg-sky-500/10 text-sky-400">
			{data.doc.category}
		</Badge>
		<h1 class="mb-3 text-4xl font-bold tracking-tight text-slate-50">
			{data.doc.title}
		</h1>
		<p class="text-lg text-slate-400">
			{data.doc.description}
		</p>
	</header>

	<Separator class="mb-10 bg-slate-700/50" />

	<!-- Content sections -->
	<div class="flex flex-col gap-10">
		{#each data.doc.sections as section, i (i)}
			<section>
				<h2 class="mb-4 text-2xl font-bold text-slate-100">
					{section.heading}
				</h2>

				{#if section.text}
					<p class="mb-5 leading-relaxed text-slate-400">
						{section.text}
					</p>
				{/if}

				{#if section.apiTable}
					<div class="mb-5">
						<ApiTable items={section.apiTable} />
					</div>
				{/if}

				{#if section.code}
					<div class="mb-5">
						<CodeBlock
							code={section.code.code}
							title={section.code.title}
							language={section.code.language}
						/>
					</div>
				{/if}

				{#if section.note}
					<div class="flex gap-3 rounded-xl border border-sky-500/20 bg-sky-500/5 px-4 py-3">
						<Info size={18} class="mt-0.5 shrink-0 text-sky-400" />
						<p class="text-sm leading-relaxed text-slate-300">
							{section.note}
						</p>
					</div>
				{/if}
			</section>
		{/each}
	</div>

	<!-- Navigation -->
	<Separator class="mt-12 mb-8 bg-slate-700/50" />

	<nav class="grid grid-cols-2 gap-4 md:flex md:items-center md:justify-between">
		{#if data.prev}
			<Button
				href="/docs/{data.prev.slug}"
				class="group col-span-1 flex h-auto flex-col items-start justify-center gap-1 rounded-lg border border-slate-700/50 bg-slate-800/50 px-4 py-3 text-left transition-all hover:border-slate-600 hover:bg-slate-800 md:col-auto md:flex-row md:items-center md:gap-3"
			>
				<ArrowLeft
					size={16}
					class="text-slate-500 transition-transform group-hover:-translate-x-1"
				/>
				<div class="flex flex-col">
					<span class="text-xs font-medium uppercase tracking-wider text-slate-500">Previous</span>
					<span class="line-clamp-1 text-sm font-semibold text-slate-200">{data.prev.title}</span>
				</div>
			</Button>
		{:else}
			<div></div>
		{/if}

		{#if data.next}
			<Button
				href="/docs/{data.next.slug}"
				class="group col-span-1 flex h-auto flex-col items-end justify-center gap-1 rounded-lg border border-slate-700/50 bg-slate-800/50 px-4 py-3 text-right transition-all hover:border-slate-600 hover:bg-slate-800 md:col-auto md:flex-row-reverse md:items-center md:gap-3"
			>
				<ArrowRight
					size={16}
					class="text-slate-500 transition-transform group-hover:translate-x-1"
				/>
				<div class="flex flex-col">
					<span class="text-xs font-medium uppercase tracking-wider text-slate-500">Next</span>
					<span class="line-clamp-1 text-sm font-semibold text-slate-200">{data.next.title}</span>
				</div>
			</Button>
		{/if}
	</nav>
</article>
