<script lang="ts">
	import type { ApiItem } from '../docs-data.js';

	let { items }: { items: ApiItem[] } = $props();
</script>

<div class="overflow-x-auto rounded-xl border border-slate-700/50 bg-slate-900/60">
	<table class="w-full text-left text-sm">
		<thead>
			<tr class="border-b border-slate-700/50 bg-slate-800/50">
				<th class="px-4 py-3 font-semibold text-slate-300">Name</th>
				<th class="px-4 py-3 font-semibold text-slate-300">Type</th>
				<th class="px-4 py-3 font-semibold text-slate-300">Description</th>
			</tr>
		</thead>
		<tbody>
			{#each items as item, i (item.name)}
				<tr class="border-b border-slate-700/20 transition-colors hover:bg-slate-800/30 {i % 2 === 0 ? 'bg-slate-800/10' : ''}">
					<td class="px-4 py-3">
						<code class="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-xs text-sky-400">{item.name}</code>
						{#if item.required}
							<span class="ml-1.5 text-xs text-red-400">*</span>
						{/if}
					</td>
					<td class="px-4 py-3">
						<code class="font-mono text-xs text-purple-400">{item.type}</code>
					</td>
					<td class="px-4 py-3 text-slate-400">
						{item.description}
						{#if item.default}
							<span class="ml-1 text-xs text-slate-500">(default: <code class="text-slate-400">{item.default}</code>)</span>
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
