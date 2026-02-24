<script lang="ts">
	import './layout.css';

	const { children } = $props();
</script>

<div class="min-h-screen">
	{@render children()}
</div>
