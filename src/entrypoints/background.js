import {defineBackground} from 'wxt/sandbox';
import {browser} from 'wxt/browser';
import {defineJobScheduler} from '@webext-core/job-scheduler';
import GitHubBookmarksLoader from '@/utils/github-bookmarks-loader.js';
import {registerSyncBookmarks, getSyncBookmarks} from '@/utils/bookmarksync.js';

export default defineBackground({
	persistent: false,
	type: 'module',

	main() {
		registerSyncBookmarks(new GitHubBookmarksLoader());

		const bookmarkSyncService = getSyncBookmarks();

		const jobs = defineJobScheduler();

		console.log('💈 Background script loaded for', chrome.runtime.getManifest().name);

		browser.runtime.onInstalled.addListener(details => {
			console.log('Extension installed:', details);
			bookmarkSyncService.synchronizeBookmarks();
		});

		jobs.scheduleJob({
			id: 'sync-bookmarks',
			type: 'interval',
			duration: 1000 * 3600, // Runs hourly
			execute() {
				console.log('Scheduled sync bookmarks job');
				bookmarkSyncService.synchronizeBookmarks();
			},
		});

		jobs.scheduleJob({
			id: 'startup-sync-bookmarks',
			type: 'once',
			date: Date.now() + (1000 * 30), // 30 seconds after extension init (browser start)
			execute() {
				console.log('Syncing bookmarks on browser startup');
				bookmarkSyncService.synchronizeBookmarks();
			},
		});
	},
});
