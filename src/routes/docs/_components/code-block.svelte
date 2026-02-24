<script lang="ts">
	import { Check, Copy } from '@lucide/svelte';
	import CodeBlock from 'shiki-block-svelte';
	import type { BundledLanguage } from 'shiki';

	let {
		code,
		title = '',
		language = 'typescript'
	}: { code: string; title?: string; language?: string } = $props();

	// Map common language aliases to shiki lang identifiers
	const langMap: Record<string, BundledLanguage> = {
		typescript: 'typescript',
		ts: 'typescript',
		javascript: 'javascript',
		js: 'javascript',
		svelte: 'svelte',
		bash: 'bash',
		shell: 'bash',
		json: 'json',
		html: 'html',
		css: 'css'
	};

	let lang: BundledLanguage = $derived(langMap[language] ?? 'typescript');
	let copied = $state(false);

	function copyCode() {
		navigator.clipboard.writeText(code);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}
</script>

<div
	class="group relative overflow-hidden rounded-xl border border-slate-700/50 bg-slate-900/80 shadow-lg"
>
	{#if title}
		<div
			class="flex items-center justify-between border-b border-slate-700/50 bg-slate-900 px-4 py-2.5"
		>
			<div class="flex items-center gap-2">
				<span class="h-3 w-3 rounded-full bg-red-500/80"></span>
				<span class="h-3 w-3 rounded-full bg-amber-500/80"></span>
				<span class="h-3 w-3 rounded-full bg-emerald-500/80"></span>
				<span class="ml-3 font-mono text-xs text-slate-500">{title}</span>
			</div>
			<button
				class="flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-xs text-slate-500 opacity-0 transition-all group-hover:opacity-100 hover:bg-slate-800 hover:text-slate-300"
				onclick={copyCode}
			>
				{#if copied}
					<Check size={12} />
					<span>Copied</span>
				{:else}
					<Copy size={12} />
					<span>Copy</span>
				{/if}
			</button>
		</div>
	{/if}
	<div class="shiki-wrapper overflow-x-auto p-5">
		<CodeBlock {lang} theme="github-dark" {code} />
	</div>
</div>

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
