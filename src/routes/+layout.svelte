<script lang="ts">
	import './layout.css';

	const { children } = $props();
</script>

<svelte:head>
	<!-- Base Meta Tags -->
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<meta name="theme-color" content="#0f172a" />
	<meta name="format-detection" content="telephone=no" />
	
	<!-- Favicon & Icons -->
	<link rel="icon" href="/favicon.ico" />
	
	<!-- Open Graph Meta Tags -->
	<meta property="og:site_name" content="svelte-idb" />
	<meta property="og:locale" content="en_US" />
	
	<!-- Additional SEO -->
	<meta name="robots" content="index, follow" />
	<meta name="language" content="English" />
</svelte:head>

<div class="min-h-screen">
	{@render children()}
</div>
