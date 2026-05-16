import { playwright } from '@vitest/browser-playwright';
import { mergeConfig } from 'vite';
import { defineConfig } from 'vitest/config';

import viteConfig from './vite.config';

const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH;

export default mergeConfig(
	viteConfig,
	defineConfig({
		test: {
			include: ['tests/browser/**/*.test.ts'],
			browser: {
				enabled: true,
				headless: true,
				provider: playwright(
					executablePath ? { launchOptions: { executablePath } } : undefined
				),
				instances: [{ browser: 'chromium' }]
			},
			testTimeout: 10_000
		}
	})
);