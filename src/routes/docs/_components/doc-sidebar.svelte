<script lang="ts">
	import { page } from '$app/state';
	import { getCategories } from '../docs-data.js';
	import { Book, ChevronRight } from '@lucide/svelte';

	const categories = getCategories();

	let currentSlug = $derived(page.params.slug ?? '');
</script>

<nav class="flex flex-col gap-6">
	<a
		href="/docs/installation"
		class="flex items-center gap-2 px-3 pb-2 text-lg font-bold text-slate-100"
	>
		<Book size={20} class="text-sky-400" />
		Documentation
	</a>

	{#each categories as category (category.name)}
		<div>
			<h3 class="mb-2 px-3 text-xs font-semibold tracking-wider text-slate-500 uppercase">
				{category.name}
			</h3>
			<ul class="flex flex-col gap-0.5">
				{#each category.pages as doc (doc.slug)}
					<li>
						<a
							href="/docs/{doc.slug}"
							class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors {currentSlug ===
							doc.slug
								? 'bg-sky-500/10 font-medium text-sky-400'
								: 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}"
						>
							{#if currentSlug === doc.slug}
								<ChevronRight size={14} class="text-sky-400" />
							{/if}
							<span>{doc.title}</span>
						</a>
					</li>
				{/each}
			</ul>
		</div>
	{/each}
</nav>
