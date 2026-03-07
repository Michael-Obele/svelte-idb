<script lang="ts">
	import { Button } from '$ui/components/ui/button/index.js';
	import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '$ui/components/ui/sheet/index.js';
	import DocSidebar from '$components/doc-sidebar.svelte';
	import { Menu, ArrowLeft } from '@lucide/svelte';
	import { MediaQuery } from 'svelte/reactivity';

	const large = new MediaQuery('min-width: 1024px');
	const { children } = $props();
</script>

<div class="flex min-h-screen bg-background">
	<!-- Desktop sidebar -->
	<aside class="hidden w-72 shrink-0 border-r border-slate-700/50 bg-slate-900/40 lg:block">
		<div class="sticky top-0 h-screen overflow-y-auto px-4 py-6">
			<div class="mb-6 px-4">
				<a href="/" class="flex items-center gap-3 transition-opacity hover:opacity-80">
					<img src="/favicon-database.svg" alt="svelte-idb" class="h-8 w-8" />
					<span class="font-bold text-slate-200">svelte-idb docs</span>
				</a>
			</div>
			<DocSidebar />
		</div>
	</aside>

	<!-- Mobile sidebar (Sheet) -->
	<div class="fixed top-4 left-4 z-50 lg:hidden">
		<Sheet>
			<SheetTrigger>
				{#snippet child({ props })}
					<Button
						variant="outline"
						size="icon"
						class="border-slate-700 bg-slate-900/90 text-slate-300 backdrop-blur-sm"
						{...props}
					>
						<Menu size={18} />
					</Button>
				{/snippet}
			</SheetTrigger>
			<SheetContent side="left" class="w-72 border-slate-700/50 bg-slate-900 p-0">
				<SheetTitle class="sr-only">Documentation Navigation</SheetTitle>
				<div class="px-4 py-6">
					<div class="mb-6 px-4">
						<a href="/" class="flex items-center gap-3 transition-opacity hover:opacity-80">
							<img src="/favicon-database.svg" alt="svelte-idb" class="h-8 w-8" />
							<span class="font-bold text-slate-200">svelte-idb docs</span>
						</a>
					</div>
					<DocSidebar />
				</div>
			</SheetContent>
		</Sheet>
	</div>

	<!-- Main content -->
	<main class="min-w-0 flex-1">
		<div class="mx-auto max-w-4xl px-6 py-8 lg:px-12 lg:py-12">
			<div class="mb-6 flex {large.current ? 'justify-start' : 'justify-end'}">
				<a
					href="/"
					class="inline-flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-sky-400"
				>
					<ArrowLeft size={14} />
					Back to Home
				</a>
			</div>
			{@render children()}

			<footer
				class="mt-20 flex flex-col items-center justify-between gap-4 border-t border-slate-800/50 py-10 text-xs text-slate-500 sm:flex-row"
			>
				<div class="flex items-center gap-1.5">
					Built for Svelte 5 by <a
						href="https://github.com/Michael-Obele"
						class="text-slate-400 underline underline-offset-4 decoration-slate-700 hover:text-sky-400 hover:decoration-sky-400"
						>Michael Obele</a
					>
				</div>
				<nav class="flex items-center gap-6">
					<a href="/" class="transition-colors hover:text-slate-300">Home</a>
					<a
						href="https://github.com/Michael-Obele/svelte-idb"
						class="transition-colors hover:text-slate-300"
						target="_blank"
						rel="noopener noreferrer">GitHub</a
					>
					<a href="/sitemap.xml" class="transition-colors hover:text-slate-300">Sitemap</a>
				</nav>
			</footer>
		</div>
	</main>
</div>
