<script lang="ts">
	import { Button } from '$ui/components/ui/button/index.js';
	import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '$ui/components/ui/sheet/index.js';
	import DocSidebar from '$components/doc-sidebar.svelte';
	import { Menu, ArrowLeft } from '@lucide/svelte';

	const { children } = $props();
</script>

<div class="flex min-h-screen bg-background">
	<!-- Desktop sidebar -->
	<aside class="hidden w-72 shrink-0 border-r border-slate-700/50 bg-slate-900/40 lg:block">
		<div class="sticky top-0 h-screen overflow-y-auto px-4 py-6">
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
					<DocSidebar />
				</div>
			</SheetContent>
		</Sheet>
	</div>

	<!-- Main content -->
	<main class="min-w-0 flex-1">
		<div class="mx-auto max-w-4xl px-6 py-8 lg:px-12 lg:py-12">
			<div class="mb-6">
				<a
					href="/"
					class="inline-flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-sky-400"
				>
					<ArrowLeft size={14} />
					Back to Home
				</a>
			</div>
			{@render children()}
		</div>
	</main>
</div>
