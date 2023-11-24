/* eslint-disable @typescript-eslint/naming-convention */
import {defineConfig, type ConfigEnv, type UserManifest} from 'wxt';
import * as pkg from './package.json';

// See https://wxt.dev/api/config.html
export default defineConfig({
	srcDir: 'src',
	manifest: generateManifest,
	imports: false,
});

function generateManifest(env: ConfigEnv): UserManifest {
	const manifest: UserManifest = {
		name: 'Bookmark Sync for GitHub',
		description: pkg.description,
		homepage_url: 'https://github.com/frederikb/bookmarksync',
		permissions: [
			'storage',
			'bookmarks',
			'notifications',
			'alarms',
		],
	};

	if (env.browser === 'firefox') {
		manifest.browser_specific_settings = {
			gecko: {
				id: '{883c2986-80c3-41fc-9e24-8dd91b91444e}',
				strict_min_version: '115.0',
			},
		};
	}

	if (env.manifestVersion === 2) {
		manifest.permissions?.push('https://api.github.com/');
	}

	if (env.manifestVersion > 2) {
		manifest.host_permissions = [
			'https://api.github.com/',
		];
	}

	return manifest;
}
