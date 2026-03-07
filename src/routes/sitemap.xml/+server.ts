import type { RequestHandler } from '@sveltejs/kit';
import { docs } from '../docs/docs-data.js';
import type { DocPage } from '../docs/docs-data.js';

const baseUrl = 'https://idb.svelte-apps.me';

export const GET: RequestHandler = async () => {
	const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
        <loc>${baseUrl}</loc>
        <changefreq>weekly</changefreq>
        <priority>1.0</priority>
    </url>
    <url>
        <loc>${baseUrl}/docs/installation</loc>
        <changefreq>weekly</changefreq>
        <priority>0.8</priority>
    </url>
${docs
	.map(
		(page: DocPage) => `    <url>
        <loc>${baseUrl}/docs/${page.slug}</loc>
        <changefreq>weekly</changefreq>
        <priority>0.7</priority>
    </url>`
	)
	.join('\n')}
</urlset>`.trim();

	return new Response(sitemap, {
		headers: {
			'Content-Type': 'application/xml',
			'Cache-Control': 'max-age=0, s-maxage=3600'
		}
	});
};
