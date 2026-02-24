import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types.js';
import { getDocBySlug, getAdjacentDocs } from '../docs-data.js';

export const load: PageLoad = ({ params }) => {
	const doc = getDocBySlug(params.slug);

	if (!doc) {
		error(404, { message: `Documentation page "${params.slug}" not found.` });
	}

	const adjacent = getAdjacentDocs(params.slug);

	return {
		doc,
		prev: adjacent.prev,
		next: adjacent.next
	};
};
